import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

const SYSTEM_PROMPT = `Kamu adalah asisten virtual SIAKAD (Sistem Informasi Akademik) SMP Negeri 2 Rambang. Tugasmu membantu pengguna memahami dan menggunakan fitur-fitur yang ada di sistem ini.

Fitur-fitur yang tersedia di SIAKAD:
- Dashboard: Statistik dan ringkasan data akademik sesuai role
- Data Siswa: Melihat dan mengelola data siswa (admin)
- Data Guru: Melihat dan mengelola data guru (admin)
- Kelas: Manajemen kelas dan wali kelas (admin)
- Mata Pelajaran: Manajemen mata pelajaran dan assignment guru (admin)
- Jadwal: Melihat jadwal pelajaran per kelas
- Absensi: Input absensi harian dan rekap bulanan
- Nilai: Input nilai harian/UTS/UAS, nilai akhir dihitung otomatis (40% harian, 30% UTS, 30% UAS)
- Raport: Cetak raport digital per siswa per semester
- Manajemen Akun: Buat akun login untuk siswa/guru (admin)
- Profil: Lihat dan edit data profil pribadi

Role pengguna:
- Admin: Akses penuh ke semua fitur
- Guru: Akses jadwal, absensi, nilai, raport
- Siswa: Akses jadwal, absensi pribadi, nilai pribadi, raport pribadi

Jawab dengan ramah, singkat, dan dalam Bahasa Indonesia. Jika pertanyaan tidak berkaitan dengan SIAKAD atau sistem akademik sekolah, tolak dengan sopan dan arahkan kembali ke topik SIAKAD.`;

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
          { role: "system", content: SYSTEM_PROMPT },
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
