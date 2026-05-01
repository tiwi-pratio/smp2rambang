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

  // Ambil jadwal hari ini
  const { data: jadwalRes } = await supabase
    .from("jadwal")
    .select("*, mata_pelajaran(id, nama_mapel, kode_mapel), guru(id, nama)")
    .eq("hari", hariIni)
    .limit(5);

  // Ambil nilai terbaru
  const { data: nilaiRes } = await supabase
    .from("nilai")
    .select("*, mata_pelajaran(id, nama_mapel, kode_mapel)")
    .order("id", { ascending: false })
    .limit(5);

  const rekap = { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 };

  res.json({
    nama_siswa: req.user!.full_name,
    kelas: "-",
    jadwal_hari_ini: jadwalRes || [],
    nilai_terbaru: nilaiRes || [],
    rekap_absensi_bulan_ini: rekap,
  });
});

export default router;
