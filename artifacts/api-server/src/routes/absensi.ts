import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

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
