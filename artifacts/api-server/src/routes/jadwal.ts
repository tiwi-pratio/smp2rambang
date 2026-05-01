import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

async function enrichJadwal(jadwalList: any[]) {
  if (!jadwalList || jadwalList.length === 0) return jadwalList;

  const kelasIds = [...new Set(jadwalList.map((j) => j.kelas_id).filter(Boolean))];
  const mapelIds = [...new Set(jadwalList.map((j) => j.mata_pelajaran_id).filter(Boolean))];
  const guruIds = [...new Set(jadwalList.map((j) => j.guru_id).filter(Boolean))];

  const [kelasData, mapelData, guruData] = await Promise.all([
    kelasIds.length > 0 ? supabase.from("kelas").select("id, nama_kelas, tingkat, tahun_ajaran").in("id", kelasIds) : { data: [] },
    mapelIds.length > 0 ? supabase.from("mata_pelajaran").select("id, nama_mapel, kode_mapel").in("id", mapelIds) : { data: [] },
    guruIds.length > 0 ? supabase.from("guru").select("id, nama, nip").in("id", guruIds) : { data: [] },
  ]);

  const kelasMap: Record<number, any> = {};
  const mapelMap: Record<number, any> = {};
  const guruMap: Record<number, any> = {};

  for (const k of kelasData.data || []) kelasMap[k.id] = k;
  for (const m of mapelData.data || []) mapelMap[m.id] = m;
  for (const g of guruData.data || []) guruMap[g.id] = g;

  return jadwalList.map((j) => ({
    ...j,
    kelas: kelasMap[j.kelas_id] || null,
    mata_pelajaran: mapelMap[j.mata_pelajaran_id] || null,
    guru: guruMap[j.guru_id] || null,
  }));
}

router.get("/jadwal", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { kelas_id, guru_id } = req.query as Record<string, string>;

  let query = supabase.from("jadwal").select("*").order("hari").order("jam_mulai");
  if (kelas_id) query = query.eq("kelas_id", kelas_id);
  if (guru_id) query = query.eq("guru_id", guru_id);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }
  const enriched = await enrichJadwal(data || []);
  res.json(enriched);
});

router.post("/jadwal", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { kelas_id, mata_pelajaran_id, guru_id, hari, jam_mulai, jam_selesai } = req.body;
  const { data, error } = await supabase.from("jadwal").insert({ kelas_id, mata_pelajaran_id, guru_id, hari, jam_mulai, jam_selesai }).select().single();
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const [enriched] = await enrichJadwal([data]);
  res.status(201).json(enriched);
});

router.delete("/jadwal/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("jadwal").delete().eq("id", id);
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  res.json({ success: true, message: "Jadwal berhasil dihapus" });
});

export default router;
