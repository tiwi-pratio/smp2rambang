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

// GET /jadwal/aktif — jadwal yang sedang berjalan sekarang untuk guru yang login
router.get("/jadwal/aktif", requireAuth, async (req: AuthenticatedRequest, res) => {
  const hariMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  // WIB = UTC+7
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const hariIni = hariMap[nowWib.getUTCDay()];
  const jamSekarang = `${String(nowWib.getUTCHours()).padStart(2, "0")}:${String(nowWib.getUTCMinutes()).padStart(2, "0")}`;

  let guruId = req.user!.guru_id;

  // Jika guru_id belum ada di token, coba lookup dari nama
  if (!guruId && req.user!.role === "guru") {
    const { data: guruRows } = await supabase
      .from("guru")
      .select("id")
      .eq("nama", req.user!.full_name)
      .limit(2);
    if (guruRows && guruRows.length === 1) guruId = String(guruRows[0].id);
  }

  // Admin boleh lihat semua jadwal aktif (tanpa filter guru)
  let query = supabase
    .from("jadwal")
    .select("*")
    .eq("hari", hariIni)
    .lte("jam_mulai", jamSekarang)
    .gte("jam_selesai", jamSekarang);

  if (guruId) query = query.eq("guru_id", guruId);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: "Internal Server Error", message: error.message }); return; }

  const enriched = await enrichJadwal(data || []);
  res.json({ hari: hariIni, jam: jamSekarang, jadwal: enriched });
});

router.get("/jadwal", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { kelas_id: queryKelasId, guru_id } = req.query as Record<string, string>;

  let effectiveKelasId: string | undefined = queryKelasId;

  if (req.user!.role === "siswa") {
    let siswaId: number | string | null = req.user!.siswa_id || null;

    if (!siswaId) {
      const { data: rows } = await supabase
        .from("siswa")
        .select("id")
        .eq("nama", req.user!.full_name)
        .limit(2);
      if (rows && rows.length === 1) siswaId = rows[0].id;
    }

    if (!siswaId) {
      res.json([]);
      return;
    }

    const { data: siswa } = await supabase
      .from("siswa")
      .select("kelas_id")
      .eq("id", siswaId)
      .single();

    if (!siswa?.kelas_id) {
      res.json([]);
      return;
    }

    effectiveKelasId = String(siswa.kelas_id);
  }

  let query = supabase.from("jadwal").select("*").order("hari").order("jam_mulai");
  if (effectiveKelasId) query = query.eq("kelas_id", effectiveKelasId);
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
