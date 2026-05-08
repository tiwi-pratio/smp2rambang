import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Administrator";
    case "guru": return "Guru";
    case "siswa": return "Siswa";
    default: return role;
  }
};

const getRoleAccess = (role: string) => {
  switch (role) {
    case "admin":
      return "Kamu memiliki akses penuh ke semua fitur: Dashboard, Data Siswa, Data Guru, Kelas, Mata Pelajaran, Jadwal, Absensi, Rekap Absensi, Nilai, Raport, dan Manajemen Akun.";
    case "guru":
      return "Kamu memiliki akses ke: Dashboard, Jadwal, Absensi (input & rekap), Nilai, dan Raport.";
    case "siswa":
      return "Kamu memiliki akses ke: Dashboard, Jadwal pelajaranmu, Absensi pribadimu, Nilai pribadimu, dan Raport pribadimu.";
    default:
      return "";
  }
};

const buildSystemPrompt = (user: AuthenticatedRequest["user"]) => {
  const roleLabel = getRoleLabel(user!.role);
  const roleAccess = getRoleAccess(user!.role);

  return `Kamu adalah asisten virtual SIAKAD (Sistem Informasi Akademik) SMP Negeri 2 Rambang.

Pengguna yang sedang login:
- Nama: ${user!.full_name}
- Role: ${roleLabel}
- Email: ${user!.email}
${roleAccess}

Fitur-fitur yang tersedia di SIAKAD:
- Dashboard: Statistik dan ringkasan data akademik sesuai role
- Data Siswa: Melihat dan mengelola data siswa (khusus admin)
- Data Guru: Melihat dan mengelola data guru (khusus admin)
- Kelas: Manajemen kelas dan wali kelas (khusus admin)
- Mata Pelajaran: Manajemen mata pelajaran dan assignment guru (khusus admin)
- Jadwal: Melihat jadwal pelajaran per kelas
- Absensi: Input absensi harian dan rekap bulanan
- Nilai: Input nilai harian/UTS/UAS, nilai akhir dihitung otomatis (40% harian, 30% UTS, 30% UAS)
- Raport: Cetak raport digital per siswa per semester
- Manajemen Akun: Buat akun login untuk siswa/guru (khusus admin)
- Profil: Lihat dan edit data profil pribadi

Panggil pengguna dengan nama depannya saja. Jawab dengan ramah, singkat, dan dalam Bahasa Indonesia. Jika pertanyaan tidak berkaitan dengan SIAKAD atau sistem akademik sekolah, tolak dengan sopan dan arahkan kembali ke topik SIAKAD.`;
};

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

  const systemPrompt = buildSystemPrompt(req.user);

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
