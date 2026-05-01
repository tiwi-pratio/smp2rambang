import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

async function enrichKelas(kelasList: any[]) {
  if (!kelasList || kelasList.length === 0) return kelasList;
  const guruIds = [...new Set(kelasList.map((k) => k.wali_kelas_id).filter(Boolean))];
  let guruMap: Record<number, any> = {};
  if (guruIds.length > 0) {
    const { data: guruData } = await supabase.from("guru").select("id, nama, nip, no_hp, email").in("id", guruIds);
    for (const g of guruData || []) guruMap[g.id] = g;
  }

  const kelasWithCount = await Promise.all(kelasList.map(async (k) => {
    const { count } = await supabase.from("siswa").select("id", { count: "exact", head: true }).eq("kelas_id", k.id);
    return { ...k, wali_kelas: guruMap[k.wali_kelas_id] || null, jumlah_siswa: count || 0 };
  }));
  return kelasWithCount;
}

router.get("/kelas", requireAuth, async (req, res) => {
  const { data, error } = await supabase.from("kelas").select("*").order("tingkat").order("nama_kelas");
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }
  const enriched = await enrichKelas(data || []);
  res.json(enriched);
});

router.post("/kelas", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { nama_kelas, tingkat, wali_kelas_id, tahun_ajaran } = req.body;
  const { data, error } = await supabase.from("kelas").insert({ nama_kelas, tingkat, wali_kelas_id: wali_kelas_id || null, tahun_ajaran }).select().single();
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const [enriched] = await enrichKelas([data]);
  res.status(201).json(enriched);
});

router.put("/kelas/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { nama_kelas, tingkat, wali_kelas_id, tahun_ajaran } = req.body;
  const { data, error } = await supabase.from("kelas").update({ nama_kelas, tingkat, wali_kelas_id: wali_kelas_id || null, tahun_ajaran }).eq("id", id).select().single();
  if (error || !data) { res.status(400).json({ error: "Bad Request", message: error?.message }); return; }
  const [enriched] = await enrichKelas([data]);
  res.json(enriched);
});

router.delete("/kelas/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("kelas").delete().eq("id", id);
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  res.json({ success: true, message: "Kelas berhasil dihapus" });
});

export default router;
