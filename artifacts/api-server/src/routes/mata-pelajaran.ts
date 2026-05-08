import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

async function enrichMapel(mapelList: any[]) {
  if (!mapelList || mapelList.length === 0) return mapelList;
  const guruIds = [...new Set(mapelList.map((m) => m.guru_id).filter(Boolean))];
  let guruMap: Record<number, any> = {};
  if (guruIds.length > 0) {
    const { data: guruData } = await supabase.from("guru").select("id, nama, nip").in("id", guruIds);
    for (const g of guruData || []) guruMap[g.id] = g;
  }
  return mapelList.map((m) => ({ ...m, guru: guruMap[m.guru_id] || null }));
}

router.get("/mata-pelajaran", requireAuth, async (req, res) => {
  const { data, error } = await supabase.from("mata_pelajaran").select("*").order("nama_mapel");
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }
  const enriched = await enrichMapel(data || []);
  res.json(enriched);
});

router.post("/mata-pelajaran", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { nama_mapel, kode_mapel, guru_id } = req.body;
  const { data, error } = await supabase.from("mata_pelajaran").insert({ nama_mapel, kode_mapel: kode_mapel || null, guru_id: guru_id || null }).select().single();
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const [enriched] = await enrichMapel([data]);
  res.status(201).json(enriched);
});

router.put("/mata-pelajaran/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { nama_mapel, kode_mapel, guru_id } = req.body;
  const { data, error } = await supabase.from("mata_pelajaran").update({ nama_mapel, kode_mapel: kode_mapel || null, guru_id: guru_id || null }).eq("id", id).select().single();
  if (error || !data) { res.status(400).json({ error: "Bad Request", message: error?.message }); return; }
  const [enriched] = await enrichMapel([data]);
  res.json(enriched);
});

router.delete("/mata-pelajaran/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("mata_pelajaran").delete().eq("id", id);
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  res.json({ success: true, message: "Mata pelajaran berhasil dihapus" });
});

export default router;
