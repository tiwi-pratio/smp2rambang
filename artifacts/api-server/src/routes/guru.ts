import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

async function enrichGuru(guruList: any[]) {
  if (!guruList || guruList.length === 0) return guruList;
  const mapelIds = [...new Set(guruList.map((g) => g.mata_pelajaran_id).filter(Boolean))];
  let mapelMap: Record<number, any> = {};
  if (mapelIds.length > 0) {
    const { data: mapelData } = await supabase.from("mata_pelajaran").select("id, nama_mapel, kode_mapel").in("id", mapelIds);
    for (const m of mapelData || []) mapelMap[m.id] = m;
  }
  return guruList.map((g) => ({ ...g, mata_pelajaran: mapelMap[g.mata_pelajaran_id] || null }));
}

router.get("/guru", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { search } = req.query as Record<string, string>;
  let query = supabase.from("guru").select("*").order("nama");
  if (search) query = query.or(`nama.ilike.%${search}%,nip.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }
  const enriched = await enrichGuru(data || []);
  res.json(enriched);
});

router.post("/guru", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { nip, nama, mata_pelajaran_id, no_hp, email, password } = req.body;
  const { data, error } = await supabase.from("guru").insert({ nip: nip || null, nama, mata_pelajaran_id: mata_pelajaran_id || null, no_hp: no_hp || null, email: email || null }).select().single();
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const [enriched] = await enrichGuru([data]);
  res.status(201).json(enriched);
});

router.get("/guru/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("guru").select("*").eq("id", id).single();
  if (error || !data) { res.status(404).json({ error: "Not Found", message: "Guru tidak ditemukan" }); return; }
  const [enriched] = await enrichGuru([data]);
  res.json(enriched);
});

router.put("/guru/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { nip, nama, mata_pelajaran_id, no_hp } = req.body;
  const { data, error } = await supabase.from("guru").update({ nip: nip || null, nama, mata_pelajaran_id: mata_pelajaran_id || null, no_hp: no_hp || null }).eq("id", id).select().single();
  if (error || !data) { res.status(400).json({ error: "Bad Request", message: error?.message }); return; }
  const [enriched] = await enrichGuru([data]);
  res.json(enriched);
});

router.delete("/guru/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("guru").delete().eq("id", id);
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  res.json({ success: true, message: "Guru berhasil dihapus" });
});

export default router;
