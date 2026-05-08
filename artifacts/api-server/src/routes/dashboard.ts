import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/admin-stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  const [siswaRes, guruRes, kelasRes, mapelRes, absensiRes] = await Promise.all([
    supabase.from("siswa").select("id, kelas_id", { count: "exact" }),
    supabase.from("guru").select("id", { count: "exact" }),
    supabase.from("kelas").select("id", { count: "exact" }),
    supabase.from("mata_pelajaran").select("id", { count: "exact" }),
    supabase.from("absensi").select("id", { count: "exact" }).eq("tanggal", new Date().toISOString().split("T")[0]),
  ]);

  // Hitung siswa per kelas
  const siswaData = siswaRes.data || [];
  const kelasIds = [...new Set(siswaData.map((s: any) => s.kelas_id).filter(Boolean))];
  const kelasMap: Record<number, string> = {};

  if (kelasIds.length > 0) {
    const { data: kelasData } = await supabase.from("kelas").select("id, nama_kelas").in("id", kelasIds);
    for (const k of kelasData || []) {
      kelasMap[(k as any).id] = (k as any).nama_kelas;
    }
  }

  const siswaPerKelasMap: Record<string, number> = {};
  for (const s of siswaData) {
    const namaKelas = kelasMap[(s as any).kelas_id] || "Tanpa Kelas";
    siswaPerKelasMap[namaKelas] = (siswaPerKelasMap[namaKelas] || 0) + 1;
  }
  const siswaPerKelas = Object.entries(siswaPerKelasMap).map(([nama_kelas, jumlah]) => ({ nama_kelas, jumlah }));

  res.json({
    total_siswa: siswaRes.count || 0,
    total_guru: guruRes.count || 0,
    total_kelas: kelasRes.count || 0,
    total_mata_pelajaran: mapelRes.count || 0,
    absensi_hari_ini: absensiRes.count || 0,
    siswa_per_kelas: siswaPerKelas,
  });
});

router.get("/dashboard/guru-stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  const hariIni = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date().getDay()];

  // Ambil semua jadwal hari ini untuk demo (dalam implementasi nyata pakai profile_guru_id)
  const { data: jadwalRes } = await supabase
    .from("jadwal")
    .select("*, kelas(id, nama_kelas, tingkat, tahun_ajaran), mata_pelajaran(id, nama_mapel, kode_mapel), guru(id, nama, nip)")
    .eq("hari", hariIni)
    .limit(10);

  const { data: mapelRes } = await supabase
    .from("mata_pelajaran")
    .select("id, nama_mapel, kode_mapel")
    .limit(5);

  res.json({
    total_kelas_diajar: 3,
    total_siswa_diajar: 15,
    jadwal_hari_ini: jadwalRes || [],
    mata_pelajaran: mapelRes || [],
  });
});

router.get("/dashboard/siswa-stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  const hariIni = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date().getDay()];
  const bulanIni = new Date().toISOString().slice(0, 7);

  // Resolve siswa_id
  let siswaId: number | string | null = req.user!.siswa_id || null;
  if (!siswaId) {
    const { data: rows } = await supabase
      .from("siswa")
      .select("id")
      .eq("nama", req.user!.full_name)
      .limit(2);
    if (rows && rows.length === 1) siswaId = rows[0].id;
  }

  // Get siswa + kelas info
  let kelasId: number | null = null;
  let kelasNama = "-";
  if (siswaId) {
    const { data: siswa } = await supabase
      .from("siswa")
      .select("kelas_id")
      .eq("id", siswaId)
      .single();
    if (siswa?.kelas_id) {
      kelasId = siswa.kelas_id;
      const { data: kelas } = await supabase
        .from("kelas")
        .select("nama_kelas")
        .eq("id", siswa.kelas_id)
        .single();
      kelasNama = kelas?.nama_kelas || "-";
    }
  }

  // Jadwal hari ini untuk kelas siswa
  const jadwalQuery = supabase
    .from("jadwal")
    .select("*, mata_pelajaran(id, nama_mapel, kode_mapel), guru(id, nama)")
    .eq("hari", hariIni)
    .limit(8);
  const { data: jadwalRes } = kelasId
    ? await jadwalQuery.eq("kelas_id", kelasId)
    : await jadwalQuery;

  // Nilai terbaru untuk siswa ini
  const nilaiQuery = supabase
    .from("nilai")
    .select("*, mata_pelajaran(id, nama_mapel, kode_mapel)")
    .order("id", { ascending: false })
    .limit(5);
  const { data: nilaiRes } = siswaId
    ? await nilaiQuery.eq("siswa_id", siswaId)
    : { data: [] };

  // Rekap absensi bulan ini untuk siswa ini
  const rekap = { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 };
  if (siswaId) {
    const { data: absensiRes } = await supabase
      .from("absensi")
      .select("status")
      .eq("siswa_id", siswaId)
      .gte("tanggal", `${bulanIni}-01`)
      .lte("tanggal", `${bulanIni}-31`);
    for (const a of absensiRes || []) {
      rekap.total++;
      if (a.status === "hadir") rekap.hadir++;
      else if (a.status === "izin") rekap.izin++;
      else if (a.status === "sakit") rekap.sakit++;
      else if (a.status === "alfa") rekap.alfa++;
    }
  }

  res.json({
    nama_siswa: req.user!.full_name,
    kelas: kelasNama,
    jadwal_hari_ini: jadwalRes || [],
    nilai_terbaru: nilaiRes || [],
    rekap_absensi_bulan_ini: rekap,
  });
});

export default router;
