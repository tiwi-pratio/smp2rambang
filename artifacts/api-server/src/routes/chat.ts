import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { supabase } from "../lib/supabase";

const router = Router();

const HARI_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function getWIBInfo() {
  const now = new Date();
  const wibDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const dayName = HARI_NAMES[wibDate.getDay()];
  const dayNum = wibDate.getDate();
  const month = wibDate.getMonth();
  const year = wibDate.getFullYear();
  const hh = String(wibDate.getHours()).padStart(2, "0");
  const mm = String(wibDate.getMinutes()).padStart(2, "0");
  return {
    hariIni: dayName,
    dateString: `${dayName}, ${dayNum} ${BULAN_NAMES[month]} ${year}`,
    timeString: `${hh}:${mm} WIB`,
    bulan: month + 1,
    tahun: year,
    bulanNama: BULAN_NAMES[month],
  };
}

async function buildSiswaContext(siswaId: string, bulan: number, tahun: number, bulanNama: string): Promise<string> {
  const { data: siswa } = await supabase
    .from("siswa")
    .select("id, nama, nis, kelas_id")
    .eq("id", siswaId)
    .single();

  if (!siswa) return "Data siswa tidak ditemukan.\n";

  let ctx = `Data siswa:\n- NIS: ${siswa.nis || "-"}\n`;

  if (siswa.kelas_id) {
    const { data: kelas } = await supabase
      .from("kelas")
      .select("id, nama_kelas, tingkat, tahun_ajaran")
      .eq("id", siswa.kelas_id)
      .single();

    ctx += `- Kelas: ${kelas?.nama_kelas || "-"} (Tingkat ${kelas?.tingkat || "-"}, TA ${kelas?.tahun_ajaran || "-"})\n\n`;

    const { data: jadwalList } = await supabase
      .from("jadwal")
      .select("hari, jam_mulai, jam_selesai, mata_pelajaran_id, guru_id")
      .eq("kelas_id", siswa.kelas_id)
      .order("hari")
      .order("jam_mulai");

    if (jadwalList && jadwalList.length > 0) {
      const mapelIds = [...new Set(jadwalList.map((j) => j.mata_pelajaran_id).filter(Boolean))];
      const guruIds = [...new Set(jadwalList.map((j) => j.guru_id).filter(Boolean))];
      const [{ data: mapelRows }, { data: guruRows }] = await Promise.all([
        mapelIds.length > 0 ? supabase.from("mata_pelajaran").select("id, nama_mapel").in("id", mapelIds) : Promise.resolve({ data: [] }),
        guruIds.length > 0 ? supabase.from("guru").select("id, nama").in("id", guruIds) : Promise.resolve({ data: [] }),
      ]);
      const mm: Record<number, string> = {};
      const gm: Record<number, string> = {};
      for (const m of mapelRows || []) mm[m.id] = m.nama_mapel;
      for (const g of guruRows || []) gm[g.id] = g.nama;

      const byHari: Record<string, any[]> = {};
      for (const j of jadwalList) {
        if (!byHari[j.hari]) byHari[j.hari] = [];
        byHari[j.hari].push(j);
      }

      ctx += `Jadwal pelajaran kelas ${kelas?.nama_kelas}:\n`;
      for (const hari of HARI_ORDER) {
        const entries = byHari[hari];
        if (!entries) continue;
        ctx += `  ${hari}:\n`;
        for (const j of entries) {
          ctx += `    - ${j.jam_mulai}–${j.jam_selesai}: ${mm[j.mata_pelajaran_id] || "-"} (Guru: ${gm[j.guru_id] || "-"})\n`;
        }
      }
      ctx += "\n";
    } else {
      ctx += "Jadwal pelajaran: Belum ada jadwal.\n\n";
    }

    const bulanStr = String(bulan).padStart(2, "0");
    const { data: absensiList } = await supabase
      .from("absensi")
      .select("status")
      .eq("siswa_id", siswaId)
      .gte("tanggal", `${tahun}-${bulanStr}-01`)
      .lte("tanggal", `${tahun}-${bulanStr}-31`);

    if (absensiList && absensiList.length > 0) {
      const hadir = absensiList.filter((a) => a.status === "hadir").length;
      const sakit = absensiList.filter((a) => a.status === "sakit").length;
      const izin = absensiList.filter((a) => a.status === "izin").length;
      const alpha = absensiList.filter((a) => a.status === "alpha").length;
      ctx += `Absensi bulan ${bulanNama} ${tahun}:\n- Hadir: ${hadir} hari, Sakit: ${sakit} hari, Izin: ${izin} hari, Alpha: ${alpha} hari\n\n`;
    } else {
      ctx += `Absensi bulan ${bulanNama} ${tahun}: Belum ada data.\n\n`;
    }
  } else {
    ctx += "- Kelas: Belum ditentukan\n\n";
  }

  const { data: nilaiList } = await supabase
    .from("nilai")
    .select("mata_pelajaran_id, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, semester, tahun_ajaran")
    .eq("siswa_id", siswaId)
    .order("tahun_ajaran", { ascending: false })
    .order("semester", { ascending: false })
    .limit(20);

  if (nilaiList && nilaiList.length > 0) {
    const mapelIds2 = [...new Set(nilaiList.map((n) => n.mata_pelajaran_id).filter(Boolean))];
    const { data: mapelRows2 } = mapelIds2.length > 0
      ? await supabase.from("mata_pelajaran").select("id, nama_mapel").in("id", mapelIds2)
      : { data: [] };
    const mm2: Record<number, string> = {};
    for (const m of mapelRows2 || []) mm2[m.id] = m.nama_mapel;

    ctx += `Nilai (semester terakhir):\n`;
    for (const n of nilaiList) {
      ctx += `  - ${mm2[n.mata_pelajaran_id] || "-"}: Harian=${n.nilai_harian ?? "-"}, UTS=${n.nilai_uts ?? "-"}, UAS=${n.nilai_uas ?? "-"}, Akhir=${n.nilai_akhir ?? "-"} (Sem ${n.semester} TA ${n.tahun_ajaran})\n`;
    }
  } else {
    ctx += "Nilai: Belum ada data.\n";
  }

  return ctx;
}

async function buildGuruContext(guruId: string): Promise<string> {
  const { data: guru } = await supabase
    .from("guru")
    .select("id, nama, nip")
    .eq("id", guruId)
    .single();

  if (!guru) return "Data guru tidak ditemukan.\n";

  let ctx = `Data guru:\n- NIP: ${guru.nip || "-"}\n\n`;

  const { data: mapelDiampu } = await supabase
    .from("mata_pelajaran")
    .select("id, nama_mapel, kode_mapel")
    .eq("guru_id", guruId)
    .order("nama_mapel");

  if (mapelDiampu && mapelDiampu.length > 0) {
    ctx += `Mata pelajaran yang diampu:\n`;
    for (const m of mapelDiampu) {
      ctx += `  - ${m.nama_mapel}${m.kode_mapel ? ` (${m.kode_mapel})` : ""}\n`;
    }
    ctx += "\n";
  } else {
    ctx += "Mata pelajaran yang diampu: Belum ada.\n\n";
  }

  const { data: jadwalList } = await supabase
    .from("jadwal")
    .select("hari, jam_mulai, jam_selesai, mata_pelajaran_id, kelas_id")
    .eq("guru_id", guruId)
    .order("hari")
    .order("jam_mulai");

  if (jadwalList && jadwalList.length > 0) {
    const mapelIds = [...new Set(jadwalList.map((j) => j.mata_pelajaran_id).filter(Boolean))];
    const kelasIds = [...new Set(jadwalList.map((j) => j.kelas_id).filter(Boolean))];
    const [{ data: mapelRows }, { data: kelasRows }] = await Promise.all([
      mapelIds.length > 0 ? supabase.from("mata_pelajaran").select("id, nama_mapel").in("id", mapelIds) : Promise.resolve({ data: [] }),
      kelasIds.length > 0 ? supabase.from("kelas").select("id, nama_kelas").in("id", kelasIds) : Promise.resolve({ data: [] }),
    ]);
    const mm: Record<number, string> = {};
    const km: Record<number, string> = {};
    for (const m of mapelRows || []) mm[m.id] = m.nama_mapel;
    for (const k of kelasRows || []) km[k.id] = k.nama_kelas;

    const byHari: Record<string, any[]> = {};
    for (const j of jadwalList) {
      if (!byHari[j.hari]) byHari[j.hari] = [];
      byHari[j.hari].push(j);
    }

    ctx += `Jadwal mengajar:\n`;
    for (const hari of HARI_ORDER) {
      const entries = byHari[hari];
      if (!entries) continue;
      ctx += `  ${hari}:\n`;
      for (const j of entries) {
        ctx += `    - ${j.jam_mulai}–${j.jam_selesai}: ${mm[j.mata_pelajaran_id] || "-"} (Kelas ${km[j.kelas_id] || "-"})\n`;
      }
    }
  } else {
    ctx += "Jadwal mengajar: Belum ada jadwal.\n";
  }

  return ctx;
}

router.post("/chat", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Bad Request", message: "messages tidak boleh kosong" });
    return;
  }

  const apiKey = process.env.PIO_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Internal Server Error", message: "API key tidak dikonfigurasi" });
    return;
  }

  const user = req.user!;
  const { hariIni, dateString, timeString, bulan, tahun, bulanNama } = getWIBInfo();
  const namaDepan = user.full_name?.split(" ")[0] || user.full_name;

  let contextData = "";
  try {
    if (user.role === "siswa" && user.siswa_id) {
      contextData = await buildSiswaContext(String(user.siswa_id), bulan, tahun, bulanNama);
    } else if (user.role === "guru") {
      let guruId = user.guru_id;
      if (!guruId) {
        const { data: guruRow } = await supabase.from("guru").select("id").eq("nama", user.full_name).single();
        if (guruRow) guruId = String(guruRow.id);
      }
      if (guruId) {
        contextData = await buildGuruContext(String(guruId));
      }
    }
  } catch {
    contextData = "";
  }

  const roleAccess: Record<string, string> = {
    admin: "Akses penuh: Dashboard, Data Siswa, Data Guru, Kelas, Mata Pelajaran, Jadwal, Absensi, Nilai, Raport, Manajemen Akun.",
    guru: "Akses: Dashboard, Jadwal, Absensi (input & rekap), Nilai, Raport.",
    siswa: "Akses: Dashboard, Jadwal, Absensi pribadi, Nilai pribadi, Raport pribadi.",
  };

  const systemPrompt = `Kamu adalah asisten virtual SIAKAD SMP Negeri 2 Rambang.

WAKTU SEKARANG: ${dateString}, pukul ${timeString} (WIB / GMT+7). Hari ini: ${hariIni}.

PENGGUNA LOGIN:
- Nama: ${user.full_name} — panggil dengan "${namaDepan}"
- Role: ${user.role === "admin" ? "Administrator" : user.role === "guru" ? "Guru" : "Siswa"}
- ${roleAccess[user.role] || ""}

${contextData ? `=== DATA AKUN INI (GUNAKAN HANYA INI) ===\n${contextData}=== SELESAI ===` : ""}

ATURAN KERAS — WAJIB DIPATUHI:
1. Jawab pertanyaan tentang jadwal, nilai, absensi HANYA dari data di atas. JANGAN mengarang.
2. Jika data tidak ada di atas, katakan jujur: "Data tersebut belum ada di sistem."
3. JANGAN membuat atau menebak tanggal, jadwal, nilai, atau nama yang tidak ada di data di atas.
4. Tanggal hari ini PASTI ${dateString} — gunakan ini, jangan buat tanggal lain.
5. Jawab singkat, ramah, Bahasa Indonesia.
6. Tolak pertanyaan di luar topik akademik/SIAKAD dengan sopan.`;

  try {
    const response = await fetch("https://pio.codes/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Bad Gateway", message: `AI error: ${errText}` });
      return;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Maaf, tidak ada respons dari AI.";
    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
