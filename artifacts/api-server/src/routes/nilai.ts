import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

function hitungNilaiAkhir(harian: number | null, uts: number | null, uas: number | null): number | null {
  if (harian === null && uts === null && uas === null) return null;
  return Math.round(((harian ?? 0) * 0.4 + (uts ?? 0) * 0.3 + (uas ?? 0) * 0.3) * 100) / 100;
}

async function enrichNilai(nilaiList: any[]) {
  if (!nilaiList || nilaiList.length === 0) return nilaiList;

  const siswaIds = [...new Set(nilaiList.map((n) => n.siswa_id).filter(Boolean))];
  const mapelIds = [...new Set(nilaiList.map((n) => n.mata_pelajaran_id).filter(Boolean))];

  const [siswaData, mapelData] = await Promise.all([
    siswaIds.length > 0 ? supabase.from("siswa").select("id, nama, nis, nisn, kelas_id").in("id", siswaIds) : { data: [] },
    mapelIds.length > 0 ? supabase.from("mata_pelajaran").select("id, nama_mapel, kode_mapel").in("id", mapelIds) : { data: [] },
  ]);

  const siswaMap: Record<number, any> = {};
  const mapelMap: Record<number, any> = {};

  for (const s of siswaData.data || []) siswaMap[s.id] = s;
  for (const m of mapelData.data || []) mapelMap[m.id] = m;

  return nilaiList.map((n) => ({
    ...n,
    siswa: siswaMap[n.siswa_id] || null,
    mata_pelajaran: mapelMap[n.mata_pelajaran_id] || null,
  }));
}

router.get("/nilai/raport", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { siswa_id, semester, tahun_ajaran } = req.query as Record<string, string>;

  if (!siswa_id || !semester || !tahun_ajaran) {
    res.status(400).json({ error: "Bad Request", message: "siswa_id, semester, dan tahun_ajaran wajib diisi" });
    return;
  }

  const [siswaRes, nilaiRes] = await Promise.all([
    supabase.from("siswa").select("*").eq("id", siswa_id).single(),
    supabase.from("nilai").select("*").eq("siswa_id", siswa_id).eq("semester", semester).eq("tahun_ajaran", tahun_ajaran),
  ]);

  if (!siswaRes.data) { res.status(404).json({ error: "Not Found", message: "Siswa tidak ditemukan" }); return; }

  const mapelIds = [...new Set((nilaiRes.data || []).map((n: any) => n.mata_pelajaran_id).filter(Boolean))];
  const mapelMap: Record<number, any> = {};
  if (mapelIds.length > 0) {
    const { data: mapelData } = await supabase.from("mata_pelajaran").select("id, nama_mapel, kode_mapel").in("id", mapelIds);
    for (const m of mapelData || []) mapelMap[m.id] = m;
  }

  const nilaiList = (nilaiRes.data || []).map((n: any) => ({
    mata_pelajaran: mapelMap[n.mata_pelajaran_id]?.nama_mapel || "-",
    kode_mapel: mapelMap[n.mata_pelajaran_id]?.kode_mapel || null,
    nilai_harian: n.nilai_harian,
    nilai_uts: n.nilai_uts,
    nilai_uas: n.nilai_uas,
    nilai_akhir: n.nilai_akhir,
  }));

  const nilaiAkhirList = nilaiList.map((n) => n.nilai_akhir).filter((v) => v !== null) as number[];
  const rata_rata = nilaiAkhirList.length > 0
    ? Math.round((nilaiAkhirList.reduce((a, b) => a + b, 0) / nilaiAkhirList.length) * 100) / 100
    : null;

  // Enrich siswa with kelas
  let siswa = siswaRes.data;
  if (siswa.kelas_id) {
    const { data: kelasData } = await supabase.from("kelas").select("id, nama_kelas, tingkat, tahun_ajaran").eq("id", siswa.kelas_id).single();
    siswa = { ...siswa, kelas: kelasData };
  }

  res.json({ siswa, semester, tahun_ajaran, nilai_list: nilaiList, rata_rata });
});

router.get("/nilai", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { siswa_id, mata_pelajaran_id, semester, tahun_ajaran, kelas_id } = req.query as Record<string, string>;

  let siswaIdsFilter: number[] = [];
  if (kelas_id) {
    const { data: siswaKelas } = await supabase.from("siswa").select("id").eq("kelas_id", kelas_id);
    siswaIdsFilter = (siswaKelas || []).map((s: any) => s.id);
    if (siswaIdsFilter.length === 0) { res.json([]); return; }
  }

  let query = supabase.from("nilai").select("*").order("id", { ascending: false });

  if (siswa_id) query = query.eq("siswa_id", siswa_id);
  else if (siswaIdsFilter.length > 0) query = query.in("siswa_id", siswaIdsFilter);
  if (mata_pelajaran_id) query = query.eq("mata_pelajaran_id", mata_pelajaran_id);
  if (semester) query = query.eq("semester", semester);
  if (tahun_ajaran) query = query.eq("tahun_ajaran", tahun_ajaran);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }
  const enriched = await enrichNilai(data || []);
  res.json(enriched);
});

router.post("/nilai", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { siswa_id, mata_pelajaran_id, semester, nilai_harian, nilai_uts, nilai_uas, tahun_ajaran } = req.body;
  const nilai_akhir = hitungNilaiAkhir(nilai_harian ?? null, nilai_uts ?? null, nilai_uas ?? null);
  const { data, error } = await supabase.from("nilai").insert({ siswa_id, mata_pelajaran_id, semester, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, tahun_ajaran }).select().single();
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const [enriched] = await enrichNilai([data]);
  res.status(201).json(enriched);
});

router.put("/nilai/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { nilai_harian, nilai_uts, nilai_uas } = req.body;
  const nilai_akhir = hitungNilaiAkhir(nilai_harian ?? null, nilai_uts ?? null, nilai_uas ?? null);
  const { data, error } = await supabase.from("nilai").update({ nilai_harian, nilai_uts, nilai_uas, nilai_akhir }).eq("id", id).select().single();
  if (error || !data) { res.status(400).json({ error: "Bad Request", message: error?.message }); return; }
  const [enriched] = await enrichNilai([data]);
  res.json(enriched);
});

router.delete("/nilai/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("nilai").delete().eq("id", id);
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  res.json({ success: true, message: "Nilai berhasil dihapus" });
});

export default router;
