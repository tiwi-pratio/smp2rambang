import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

async function enrichAbsensi(absensiList: any[]) {
  if (!absensiList || absensiList.length === 0) return absensiList;

  const siswaIds = [...new Set(absensiList.map((a) => a.siswa_id).filter(Boolean))];
  const mapelIds = [...new Set(absensiList.map((a) => a.mata_pelajaran_id).filter(Boolean))];

  const [siswaData, mapelData] = await Promise.all([
    siswaIds.length > 0 ? supabase.from("siswa").select("id, nama, nis, nisn").in("id", siswaIds) : { data: [] },
    mapelIds.length > 0 ? supabase.from("mata_pelajaran").select("id, nama_mapel, kode_mapel").in("id", mapelIds) : { data: [] },
  ]);

  const siswaMap: Record<number, any> = {};
  const mapelMap: Record<number, any> = {};

  for (const s of siswaData.data || []) siswaMap[s.id] = s;
  for (const m of mapelData.data || []) mapelMap[m.id] = m;

  return absensiList.map((a) => ({
    ...a,
    siswa: siswaMap[a.siswa_id] || null,
    mata_pelajaran: mapelMap[a.mata_pelajaran_id] || null,
  }));
}

function parseSiswaHadirIds(raw: string): number[] {
  if (!raw) return [];
  return raw.split(",").map(Number).filter(Boolean);
}

function serializeSiswaHadirIds(ids: number[]): string {
  return [...new Set(ids)].join(",");
}

// ── SESI QR ENDPOINTS (tersimpan ke Supabase tabel sesi_absensi) ───────────

// POST /absensi/sesi — guru buka sesi baru
router.post("/absensi/sesi", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { kelas_id, mata_pelajaran_id, durasi_menit = 30 } = req.body;
  if (!kelas_id || !mata_pelajaran_id) {
    res.status(400).json({ error: "Bad Request", message: "kelas_id dan mata_pelajaran_id wajib diisi" });
    return;
  }

  const { randomUUID } = await import("crypto");
  const token = randomUUID();
  const tanggal = new Date().toISOString().split("T")[0];
  const expires_at = Date.now() + Number(durasi_menit) * 60 * 1000;

  // Pre-populate dengan siswa yang sudah hadir hari ini untuk mapel+kelas yang sama
  const { data: sudahHadir } = await supabase
    .from("absensi")
    .select("siswa_id")
    .eq("mata_pelajaran_id", Number(mata_pelajaran_id))
    .eq("tanggal", tanggal)
    .eq("status", "hadir");

  // Filter hanya siswa dari kelas ini
  const { data: siswaKelas } = await supabase
    .from("siswa")
    .select("id")
    .eq("kelas_id", Number(kelas_id));

  // Paksa ke Number untuk hindari type mismatch (supabase bisa return string atau number)
  const siswaKelasIds = new Set((siswaKelas || []).map((s: any) => Number(s.id)));
  const hadirIds = (sudahHadir || [])
    .map((a: any) => Number(a.siswa_id))
    .filter((id) => siswaKelasIds.has(id));

  const { error } = await supabase.from("sesi_absensi").insert({
    token,
    kelas_id: Number(kelas_id),
    mata_pelajaran_id: Number(mata_pelajaran_id),
    guru_id: req.user!.profile_id || null,
    tanggal,
    expires_at,
    siswa_hadir_ids: serializeSiswaHadirIds(hadirIds),
  });

  if (error) {
    res.status(500).json({ error: "Internal Server Error", message: `Gagal membuat sesi: ${error.message}` });
    return;
  }

  res.status(201).json({ token, tanggal, expires_at, kelas_id, mata_pelajaran_id });
});

// GET /absensi/sesi/:token — status sesi (guru polling)
router.get("/absensi/sesi/:token", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { data: sesi, error } = await supabase
    .from("sesi_absensi")
    .select("*")
    .eq("token", req.params.token)
    .single();

  if (error || !sesi) {
    res.status(404).json({ error: "Not Found", message: "Sesi tidak ditemukan atau sudah berakhir" });
    return;
  }

  const isExpired = Date.now() > Number(sesi.expires_at);
  if (isExpired) {
    supabase.from("sesi_absensi").delete().eq("token", sesi.token).then(() => {});
  }

  // Ambil dari sesi_absensi (scan realtime) PLUS absensi table (sudah tersimpan sebelumnya)
  // — gabungkan keduanya sebagai sumber kebenaran
  const sesiHadirIds = new Set(parseSiswaHadirIds(sesi.siswa_hadir_ids).map(Number));

  const [absensiRows, siswaKelasRows] = await Promise.all([
    supabase
      .from("absensi")
      .select("siswa_id")
      .eq("mata_pelajaran_id", sesi.mata_pelajaran_id)
      .eq("tanggal", sesi.tanggal)
      .eq("status", "hadir"),
    supabase.from("siswa").select("id", { count: "exact" }).eq("kelas_id", sesi.kelas_id),
  ]);

  // Gabungkan ID dari sesi dan dari absensi table
  const siswaKelasIds = new Set((siswaKelasRows.data || []).map((s: any) => Number(s.id)));
  for (const row of absensiRows.data || []) {
    const id = Number(row.siswa_id);
    if (siswaKelasIds.has(id)) sesiHadirIds.add(id);
  }

  const allHadirIds = [...sesiHadirIds];

  let siswaHadir: any[] = [];
  if (allHadirIds.length > 0) {
    const { data } = await supabase.from("siswa").select("id, nama, nis").in("id", allHadirIds);
    siswaHadir = data || [];
  }

  res.json({
    token: sesi.token,
    kelas_id: sesi.kelas_id,
    mata_pelajaran_id: sesi.mata_pelajaran_id,
    tanggal: sesi.tanggal,
    expires_at: Number(sesi.expires_at),
    is_expired: isExpired,
    total_siswa: siswaKelasRows.count || 0,
    jumlah_hadir: allHadirIds.length,
    siswa_hadir: siswaHadir,
  });
});

// DELETE /absensi/sesi/:token — guru tutup sesi, simpan alfa untuk yg belum hadir
router.delete("/absensi/sesi/:token", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { data: sesi, error } = await supabase
    .from("sesi_absensi")
    .select("*")
    .eq("token", req.params.token)
    .single();

  if (error || !sesi) {
    res.status(404).json({ error: "Not Found", message: "Sesi tidak ditemukan atau sudah berakhir" });
    return;
  }

  const hadirIds = parseSiswaHadirIds(sesi.siswa_hadir_ids);

  const { data: semuaSiswa } = await supabase.from("siswa").select("id").eq("kelas_id", sesi.kelas_id);
  const semuaIds = (semuaSiswa || []).map((s: any) => s.id);
  const alfaIds = semuaIds.filter((id: number) => !hadirIds.includes(id));

  const records: any[] = [
    ...hadirIds.map((id: number) => ({ siswa_id: id, mata_pelajaran_id: sesi.mata_pelajaran_id, tanggal: sesi.tanggal, status: "hadir", keterangan: "Via QR" })),
    ...alfaIds.map((id: number) => ({ siswa_id: id, mata_pelajaran_id: sesi.mata_pelajaran_id, tanggal: sesi.tanggal, status: "alfa", keterangan: "" })),
  ];

  if (records.length > 0) {
    await supabase.from("absensi").upsert(records, { onConflict: "siswa_id,mata_pelajaran_id,tanggal" });
  }

  await supabase.from("sesi_absensi").delete().eq("token", sesi.token);

  res.json({ success: true, message: "Sesi ditutup", jumlah_hadir: hadirIds.length, jumlah_alfa: alfaIds.length });
});

// POST /absensi/scan — siswa scan QR
router.post("/absensi/scan", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: "Bad Request", message: "Token wajib diisi" });
    return;
  }

  const { data: sesi, error } = await supabase
    .from("sesi_absensi")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !sesi) {
    res.status(404).json({ error: "Not Found", message: "Sesi tidak ditemukan atau sudah berakhir" });
    return;
  }

  if (Date.now() > Number(sesi.expires_at)) {
    supabase.from("sesi_absensi").delete().eq("token", token).then(() => {});
    res.status(410).json({ error: "Gone", message: "Sesi absensi sudah berakhir" });
    return;
  }

  let siswaId: number | null = null;
  if (req.user!.siswa_id) {
    siswaId = Number(req.user!.siswa_id);
  } else {
    const { data: rows } = await supabase.from("siswa").select("id").eq("nama", req.user!.full_name).limit(2);
    if (rows && rows.length === 1) siswaId = rows[0].id;
  }

  if (!siswaId) {
    res.status(403).json({ error: "Forbidden", message: "Data siswa tidak ditemukan untuk akun ini" });
    return;
  }

  const hadirIds = parseSiswaHadirIds(sesi.siswa_hadir_ids);

  if (hadirIds.includes(siswaId)) {
    res.json({ success: true, already: true, message: "Kamu sudah tercatat hadir sebelumnya" });
    return;
  }

  const updatedIds = serializeSiswaHadirIds([...hadirIds, siswaId]);
  await supabase.from("sesi_absensi").update({ siswa_hadir_ids: updatedIds }).eq("token", token);

  await supabase.from("absensi").upsert(
    [{ siswa_id: siswaId, mata_pelajaran_id: sesi.mata_pelajaran_id, tanggal: sesi.tanggal, status: "hadir", keterangan: "Via QR" }],
    { onConflict: "siswa_id,mata_pelajaran_id,tanggal" }
  );

  res.json({ success: true, already: false, message: "Berhasil tercatat hadir!" });
});

// ── END SESI QR ───────────────────────────────────────────────────────────

// GET /absensi/rekap-mapel — pivot table: siswa x pertemuan (tanggal) untuk 1 mapel
router.get("/absensi/rekap-mapel", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { kelas_id, mata_pelajaran_id, bulan } = req.query as Record<string, string>;

  if (!kelas_id || !mata_pelajaran_id || !bulan) {
    res.status(400).json({ error: "Bad Request", message: "kelas_id, mata_pelajaran_id, dan bulan wajib diisi" });
    return;
  }

  const [tahun, bln] = bulan.split("-");
  const startDate = `${bulan}-01`;
  const lastDay = new Date(parseInt(tahun), parseInt(bln), 0).getDate();
  const endDate = `${bulan}-${lastDay.toString().padStart(2, "0")}`;

  const { data: siswaList } = await supabase
    .from("siswa")
    .select("id, nama, nis")
    .eq("kelas_id", Number(kelas_id))
    .order("nama");

  const siswaIds = (siswaList || []).map((s: any) => s.id);
  if (siswaIds.length === 0) {
    res.json({ pertemuan: [], siswa: [] });
    return;
  }

  const { data: absensiList } = await supabase
    .from("absensi")
    .select("siswa_id, tanggal, status, keterangan")
    .in("siswa_id", siswaIds)
    .eq("mata_pelajaran_id", Number(mata_pelajaran_id))
    .gte("tanggal", startDate)
    .lte("tanggal", endDate)
    .order("tanggal");

  const pertemuanSet = new Set((absensiList || []).map((a: any) => a.tanggal));
  const pertemuan = [...pertemuanSet].sort() as string[];

  const siswa = (siswaList || []).map((s: any) => {
    const kehadiran: Record<string, string> = {};
    const rekap = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    for (const a of absensiList || []) {
      if (Number(a.siswa_id) === Number(s.id)) {
        kehadiran[a.tanggal] = a.status;
        if (a.status in rekap) rekap[a.status as keyof typeof rekap]++;
      }
    }
    const pct = pertemuan.length > 0 ? Math.round((rekap.hadir / pertemuan.length) * 100) : 0;
    return { id: s.id, nama: s.nama, nis: s.nis, kehadiran, rekap, pct };
  });

  res.json({ bulan, kelas_id: Number(kelas_id), mata_pelajaran_id: Number(mata_pelajaran_id), pertemuan, siswa });
});

// GET /absensi/mapel-list — daftar mapel beserta summary kehadiran untuk 1 kelas + bulan
router.get("/absensi/mapel-list", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { kelas_id, bulan } = req.query as Record<string, string>;

  if (!kelas_id || !bulan) {
    res.status(400).json({ error: "Bad Request", message: "kelas_id dan bulan wajib diisi" });
    return;
  }

  const [tahun, bln] = bulan.split("-");
  const startDate = `${bulan}-01`;
  const lastDay = new Date(parseInt(tahun), parseInt(bln), 0).getDate();
  const endDate = `${bulan}-${lastDay.toString().padStart(2, "0")}`;

  // Ambil jadwal kelas ini untuk tahu mapel apa saja yang diajarkan
  let jadwalQuery = supabase
    .from("jadwal")
    .select("mata_pelajaran_id, guru_id")
    .eq("kelas_id", Number(kelas_id));

  // Guru hanya lihat mapel yang dia ajar
  if (req.user!.role === "guru" && req.user!.profile_id) {
    jadwalQuery = jadwalQuery.eq("guru_id", req.user!.profile_id);
  }

  const { data: jadwalList } = await jadwalQuery;
  if (!jadwalList || jadwalList.length === 0) {
    res.json({ mapel: [] });
    return;
  }

  // Ambil mapel dan guru unik
  const uniqueMapelIds = [...new Set((jadwalList).map((j: any) => j.mata_pelajaran_id))];
  const uniqueGuruIds  = [...new Set((jadwalList).map((j: any) => j.guru_id).filter(Boolean))];

  const [{ data: mapelRows }, { data: guruRows }] = await Promise.all([
    supabase.from("mata_pelajaran").select("id, nama_mapel, kode_mapel").in("id", uniqueMapelIds),
    supabase.from("guru").select("id, nama").in("id", uniqueGuruIds),
  ]);

  const mapelById: Record<number, any> = {};
  for (const m of mapelRows || []) mapelById[m.id] = m;
  const guruById: Record<number, any> = {};
  for (const g of guruRows || []) guruById[g.id] = g;

  // Deduplikasi mapel — simpan guru pertama yang ditemukan
  const mapelMap: Record<number, any> = {};
  for (const j of jadwalList) {
    const mid = j.mata_pelajaran_id;
    if (!mapelMap[mid]) {
      const mp = mapelById[mid];
      if (mp) mapelMap[mid] = { ...mp, guru: guruById[j.guru_id] || null };
    }
  }
  const mapelList = Object.values(mapelMap);

  if (mapelList.length === 0) {
    res.json({ mapel: [] });
    return;
  }

  // Ambil siswa kelas ini
  const { data: siswaList } = await supabase.from("siswa").select("id").eq("kelas_id", Number(kelas_id));
  const siswaIds = (siswaList || []).map((s: any) => s.id);
  const totalSiswa = siswaIds.length;

  // Summary per mapel
  const mapelWithSummary = await Promise.all(
    mapelList.map(async (mp) => {
      if (siswaIds.length === 0) return { ...mp, pertemuan: 0, rata_hadir: 0, total_siswa: 0 };
      const { data: absensi } = await supabase
        .from("absensi")
        .select("tanggal, status")
        .in("siswa_id", siswaIds)
        .eq("mata_pelajaran_id", mp.id)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const pertemuanSet = new Set((absensi || []).map((a: any) => a.tanggal));
      const pertemuan = pertemuanSet.size;
      const totalHadir = (absensi || []).filter((a: any) => a.status === "hadir").length;
      const totalRecord = (absensi || []).length;
      const rataHadir = totalRecord > 0 ? Math.round((totalHadir / totalRecord) * 100) : 0;

      return { ...mp, pertemuan, rata_hadir: rataHadir, total_siswa: totalSiswa };
    })
  );

  res.json({ mapel: mapelWithSummary });
});

router.get("/absensi/rekap", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { siswa_id, bulan, kelas_id } = req.query as Record<string, string>;

  if (!bulan) {
    res.status(400).json({ error: "Bad Request", message: "Parameter bulan wajib diisi (format: YYYY-MM)" });
    return;
  }

  const [tahun, bln] = bulan.split("-");
  const startDate = `${bulan}-01`;
  const lastDay = new Date(parseInt(tahun), parseInt(bln), 0).getDate();
  const endDate = `${bulan}-${lastDay.toString().padStart(2, "0")}`;

  let siswaQuery = supabase.from("siswa").select("id, nama, nis");
  if (siswa_id) siswaQuery = siswaQuery.eq("id", siswa_id);
  if (kelas_id) siswaQuery = siswaQuery.eq("kelas_id", kelas_id);

  const { data: siswaList } = await siswaQuery;

  const siswaRekap = await Promise.all(
    (siswaList || []).map(async (s) => {
      const { data: absensi } = await supabase
        .from("absensi")
        .select("status")
        .eq("siswa_id", s.id)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const rekap = { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: (absensi || []).length };
      for (const a of absensi || []) {
        rekap[a.status as keyof typeof rekap]++;
      }
      return { siswa_id: s.id, nama: s.nama, nis: s.nis, rekap };
    })
  );

  res.json({ bulan, siswa: siswaRekap });
});

router.get("/absensi", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { siswa_id, kelas_id, mata_pelajaran_id, tanggal, bulan } = req.query as Record<string, string>;

  let siswaIds: number[] = [];
  if (kelas_id) {
    const { data: siswaKelas } = await supabase.from("siswa").select("id").eq("kelas_id", kelas_id);
    siswaIds = (siswaKelas || []).map((s: any) => s.id);
    if (siswaIds.length === 0) { res.json([]); return; }
  }

  let query = supabase.from("absensi").select("*").order("tanggal", { ascending: false });

  if (siswa_id) query = query.eq("siswa_id", siswa_id);
  else if (siswaIds.length > 0) query = query.in("siswa_id", siswaIds);
  if (mata_pelajaran_id) query = query.eq("mata_pelajaran_id", mata_pelajaran_id);
  if (tanggal) query = query.eq("tanggal", tanggal);
  if (bulan) {
    const [tahun, bln] = bulan.split("-");
    const lastDay = new Date(parseInt(tahun), parseInt(bln), 0).getDate();
    query = query.gte("tanggal", `${bulan}-01`).lte("tanggal", `${bulan}-${lastDay}`);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }
  const enriched = await enrichAbsensi(data || []);
  res.json(enriched);
});

router.post("/absensi", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { records } = req.body;
  if (!records || !Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "Bad Request", message: "Data records tidak valid" });
    return;
  }

  const { data, error } = await supabase
    .from("absensi")
    .upsert(records, { onConflict: "siswa_id,mata_pelajaran_id,tanggal" })
    .select();

  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const enriched = await enrichAbsensi(data || []);
  res.status(201).json(enriched);
});

router.put("/absensi/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status, keterangan } = req.body;
  const { data, error } = await supabase.from("absensi").update({ status, keterangan: keterangan || null }).eq("id", id).select().single();
  if (error || !data) { res.status(400).json({ error: "Bad Request", message: error?.message }); return; }
  const [enriched] = await enrichAbsensi([data]);
  res.json(enriched);
});

export default router;
