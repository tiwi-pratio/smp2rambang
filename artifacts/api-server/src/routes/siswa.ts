import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

async function enrichSiswa(siswaList: any[]) {
  if (!siswaList || siswaList.length === 0) return siswaList;
  const kelasIds = [...new Set(siswaList.map((s) => s.kelas_id).filter(Boolean))];
  let kelasMap: Record<number, any> = {};
  if (kelasIds.length > 0) {
    const { data: kelasData } = await supabase.from("kelas").select("id, nama_kelas, tingkat, tahun_ajaran").in("id", kelasIds);
    for (const k of kelasData || []) kelasMap[k.id] = k;
  }
  return siswaList.map((s) => ({ ...s, kelas: kelasMap[s.kelas_id] || null }));
}

router.get("/siswa", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { search, kelas_id, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  let query = supabase.from("siswa").select("*", { count: "exact" }).range(from, to).order("nama");

  if (search) query = query.or(`nama.ilike.%${search}%,nis.ilike.%${search}%,nisn.ilike.%${search}%`);
  if (kelas_id) query = query.eq("kelas_id", kelas_id);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }

  const enriched = await enrichSiswa(data || []);
  res.json({ data: enriched, total: count || 0, page: pageNum, limit: limitNum });
});

router.post("/siswa", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { nis, nisn, nama, kelas_id, jenis_kelamin, tanggal_lahir, alamat, no_hp_ortu } = req.body;
  const { data, error } = await supabase.from("siswa").insert({ nis, nisn, nama, kelas_id: kelas_id || null, jenis_kelamin, tanggal_lahir, alamat, no_hp_ortu }).select().single();
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  const [enriched] = await enrichSiswa([data]);
  res.status(201).json(enriched);
});

router.get("/siswa/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("siswa").select("*").eq("id", id).single();
  if (error || !data) { res.status(404).json({ error: "Not Found", message: "Siswa tidak ditemukan" }); return; }
  const [enriched] = await enrichSiswa([data]);
  res.json(enriched);
});

router.put("/siswa/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { nis, nisn, nama, kelas_id, jenis_kelamin, tanggal_lahir, alamat, no_hp_ortu } = req.body;
  const { data, error } = await supabase.from("siswa").update({ nis, nisn, nama, kelas_id: kelas_id || null, jenis_kelamin, tanggal_lahir, alamat, no_hp_ortu }).eq("id", id).select().single();
  if (error || !data) { res.status(400).json({ error: "Bad Request", message: error?.message }); return; }
  const [enriched] = await enrichSiswa([data]);
  res.json(enriched);
});

router.delete("/siswa/:id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("siswa").delete().eq("id", id);
  if (error) { res.status(400).json({ error: "Bad Request", message: error.message }); return; }
  res.json({ success: true, message: "Siswa berhasil dihapus" });
});

export default router;
