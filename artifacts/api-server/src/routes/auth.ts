import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

async function createSiswaRecord(full_name: string, jenis_kelamin: string, kelas_id?: string, nis?: string) {
  const { data, error } = await supabase
    .from("siswa")
    .insert({
      nama: full_name,
      jenis_kelamin,
      kelas_id: kelas_id || null,
      nis: nis || "",
      nisn: "",
      tanggal_lahir: "2000-01-01",
      alamat: "",
      no_hp_ortu: "",
      tempat_lahir: "",
      agama: "",
      golongan_darah: "",
      no_hp_siswa: "",
      nama_ayah: "",
      pekerjaan_ayah: "",
      nama_ibu: "",
      pekerjaan_ibu: "",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Gagal membuat data siswa");
  return data.id as string;
}

async function createGuruRecord(full_name: string, nip?: string) {
  const { data, error } = await supabase
    .from("guru")
    .insert({
      nama: full_name,
      nip: nip || null,
      no_hp: "",
      alamat: "",
      jenis_kelamin: "L",
      tanggal_lahir: "1990-01-01",
      tempat_lahir: "",
      agama: "",
      golongan_darah: "",
      pendidikan_terakhir: "",
      mata_pelajaran_diampu: "",
      status_kepegawaian: "",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Gagal membuat data guru");
  return data.id as string;
}

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Bad Request", message: "Email dan password wajib diisi" });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    res.status(401).json({ error: "Unauthorized", message: "Email atau password salah" });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("supabase_id", data.user.id)
    .single();

  if (!profile) {
    res.status(401).json({ error: "Unauthorized", message: "Profil pengguna tidak ditemukan" });
    return;
  }

  let loginKelasId: string | null = null;
  let loginSiswaId: string | null = null;

  if (profile.role === "siswa") {
    let siswaId: number | string | null =
      data.user.app_metadata?.siswa_id ||
      data.user.user_metadata?.siswa_id ||
      null;

    if (!siswaId) {
      const { data: siswaRows } = await supabase
        .from("siswa")
        .select("id")
        .eq("nama", profile.full_name)
        .limit(2);
      if (siswaRows && siswaRows.length === 1) {
        siswaId = siswaRows[0].id;
        supabase.auth.admin.updateUserById(data.user.id, {
          app_metadata: { siswa_id: siswaId },
          user_metadata: { siswa_id: siswaId },
        }).catch(() => {});
      }
    }

    if (siswaId) {
      loginSiswaId = String(siswaId);
      const { data: siswa } = await supabase
        .from("siswa")
        .select("kelas_id")
        .eq("id", siswaId)
        .single();
      if (siswa?.kelas_id) {
        loginKelasId = String(siswa.kelas_id);
      }
    }
  }

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile.role,
      full_name: profile.full_name,
      created_at: profile.created_at,
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    ...(loginSiswaId ? { siswa_id: loginSiswaId } : {}),
    ...(loginKelasId ? { kelas_id: loginKelasId } : {}),
  });
});

router.post("/auth/logout", async (req, res) => {
  res.json({ success: true, message: "Logout berhasil" });
});

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role,
    full_name: req.user!.full_name,
    siswa_id: req.user!.siswa_id || null,
    guru_id: req.user!.guru_id || null,
  });
});

async function resolveSiswaId(req: AuthenticatedRequest): Promise<string | null> {
  // Fast path: JWT app_metadata or user_metadata already decoded by middleware
  if (req.user!.siswa_id) return req.user!.siswa_id;

  // Authoritative source: admin API (bypasses JWT caching issues)
  const { data, error } = await supabase.auth.admin.getUserById(req.user!.id);
  if (error) {
    console.error("[resolveSiswaId] admin.getUserById error:", error.message);
  } else {
    const u = data?.user;
    console.log("[resolveSiswaId] admin user meta:", JSON.stringify({
      app: u?.app_metadata,
      user: u?.user_metadata,
    }));
    const siswaId =
      u?.app_metadata?.siswa_id ||
      u?.user_metadata?.siswa_id ||
      null;
    if (siswaId) return siswaId;
  }

  // Last-resort: look up siswa by full_name match from profiles (handles legacy accounts)
  const fullName = req.user!.full_name;
  if (fullName) {
    const { data: rows } = await supabase
      .from("siswa")
      .select("id")
      .eq("nama", fullName)
      .limit(2);
    // Only use if exactly one match to avoid ambiguity
    if (rows && rows.length === 1) {
      console.log("[resolveSiswaId] resolved via name fallback for:", fullName);
      return rows[0].id;
    }
  }

  console.error("[resolveSiswaId] could not resolve siswa_id for user:", req.user!.id);
  return null;
}

router.get("/auth/me/siswa", requireAuth, requireRole("siswa"), async (req: AuthenticatedRequest, res) => {
  const siswaId = await resolveSiswaId(req);
  if (!siswaId) {
    res.status(404).json({ error: "Not Found", message: "Akun ini belum terhubung ke data siswa. Hubungi admin." });
    return;
  }
  const { data, error } = await supabase
    .from("siswa")
    .select("*, kelas:kelas_id(id, nama_kelas, tingkat, tahun_ajaran)")
    .eq("id", siswaId)
    .single();
  if (error || !data) {
    res.status(404).json({ error: "Not Found", message: "Data siswa tidak ditemukan" });
    return;
  }
  res.json(data);
});

router.put("/auth/me/siswa", requireAuth, requireRole("siswa"), async (req: AuthenticatedRequest, res) => {
  const siswaId = await resolveSiswaId(req);
  if (!siswaId) {
    res.status(404).json({ error: "Not Found", message: "Akun ini belum terhubung ke data siswa. Hubungi admin." });
    return;
  }
  const {
    nisn, tanggal_lahir, tempat_lahir, agama, golongan_darah,
    alamat, no_hp_siswa, no_hp_ortu,
    nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu,
  } = req.body;
  const { data, error } = await supabase
    .from("siswa")
    .update({
      nisn, tanggal_lahir, tempat_lahir, agama, golongan_darah,
      alamat, no_hp_siswa, no_hp_ortu,
      nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu,
    })
    .eq("id", siswaId)
    .select("*, kelas:kelas_id(id, nama_kelas, tingkat, tahun_ajaran)")
    .single();
  if (error || !data) {
    res.status(400).json({ error: "Bad Request", message: error?.message || "Gagal memperbarui data" });
    return;
  }
  res.json(data);
});

router.get("/auth/accounts", requireAuth, requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("supabase_id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: "Internal Server Error", message: error.message });
    return;
  }

  const profileList = profiles || [];

  // For siswa accounts, fetch kelas info via app_metadata (siswa_id stored there)
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUserMap: Record<string, { siswa_id?: string }> = {};
  for (const u of authUsers?.users || []) {
    authUserMap[u.id] = { siswa_id: u.app_metadata?.siswa_id, guru_id: u.app_metadata?.guru_id };
  }

  // Collect siswa IDs to enrich with kelas
  const siswaIds = profileList
    .map((p) => authUserMap[p.supabase_id]?.siswa_id)
    .filter(Boolean) as string[];

  const kelasMap: Record<string, string> = {};
  if (siswaIds.length > 0) {
    const { data: siswaList } = await supabase
      .from("siswa")
      .select("id, kelas_id")
      .in("id", siswaIds);
    const kelasIds = [...new Set((siswaList || []).map((s) => s.kelas_id).filter(Boolean))];
    if (kelasIds.length > 0) {
      const { data: kelasList } = await supabase
        .from("kelas")
        .select("id, nama_kelas")
        .in("id", kelasIds);
      const kelasById: Record<string, string> = {};
      for (const k of kelasList || []) kelasById[k.id] = k.nama_kelas;
      for (const s of siswaList || []) {
        if (s.kelas_id) kelasMap[s.id] = kelasById[s.kelas_id] || "";
      }
    }
  }

  const enriched = profileList.map((p) => {
    const meta = authUserMap[p.supabase_id] || {};
    const siswa_id = (meta as any).siswa_id || null;
    const guru_id = (meta as any).guru_id || null;
    return {
      ...p,
      siswa_id,
      guru_id,
      kelas_nama: siswa_id ? (kelasMap[siswa_id] || null) : null,
    };
  });

  res.json(enriched);
});

router.post("/auth/create-account", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { email, password, full_name, role, kelas_id, nis, nip, jenis_kelamin } = req.body;

  if (!email || !password || !full_name || !role) {
    res.status(400).json({ error: "Bad Request", message: "Semua field wajib diisi" });
    return;
  }

  if (!["guru", "siswa"].includes(role)) {
    res.status(400).json({ error: "Bad Request", message: "Role harus guru atau siswa" });
    return;
  }

  if (role === "siswa" && !kelas_id) {
    res.status(400).json({ error: "Bad Request", message: "Kelas wajib dipilih untuk akun siswa" });
    return;
  }

  if (role === "siswa" && !jenis_kelamin) {
    res.status(400).json({ error: "Bad Request", message: "Jenis kelamin wajib dipilih untuk akun siswa" });
    return;
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("supabase_id")
    .eq("email", email)
    .single();

  if (existing) {
    res.status(400).json({ error: "Bad Request", message: "Email sudah terdaftar" });
    return;
  }

  // Auto-create siswa or guru record
  let siswaId: string | undefined;
  let guruId: string | undefined;
  if (role === "siswa") {
    try {
      siswaId = await createSiswaRecord(full_name, jenis_kelamin, kelas_id, nis);
    } catch (e: any) {
      res.status(400).json({ error: "Bad Request", message: e.message });
      return;
    }
  } else if (role === "guru") {
    try {
      guruId = await createGuruRecord(full_name, nip);
    } catch (e: any) {
      res.status(400).json({ error: "Bad Request", message: e.message });
      return;
    }
  }

  const appMeta: Record<string, string> = {};
  if (siswaId) appMeta.siswa_id = siswaId;
  if (guruId) appMeta.guru_id = guruId;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMeta,
    user_metadata: appMeta,
  });

  if (authError || !authData.user) {
    if (siswaId) await supabase.from("siswa").delete().eq("id", siswaId);
    if (guruId) await supabase.from("guru").delete().eq("id", guruId);
    res.status(400).json({ error: "Bad Request", message: authError?.message || "Gagal membuat akun" });
    return;
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    supabase_id: authData.user.id,
    email,
    full_name,
    role,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    if (siswaId) await supabase.from("siswa").delete().eq("id", siswaId);
    if (guruId) await supabase.from("guru").delete().eq("id", guruId);
    res.status(400).json({ error: "Bad Request", message: profileError.message });
    return;
  }

  res.status(201).json({ success: true, message: `Akun ${full_name} berhasil dibuat` });
});

router.post("/auth/bulk-create-accounts", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { accounts } = req.body;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    res.status(400).json({ error: "Bad Request", message: "Data akun tidak boleh kosong" });
    return;
  }

  const created: number[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const account of accounts) {
    const { email, password, full_name, role, kelas_id, nis, nip, jenis_kelamin } = account;

    if (!email || !password || !full_name || !role) {
      failed.push({ email: email || "(kosong)", reason: "Semua field wajib diisi" });
      continue;
    }

    if (!["guru", "siswa"].includes(role)) {
      failed.push({ email, reason: "Role harus guru atau siswa" });
      continue;
    }

    if (role === "siswa" && !kelas_id) {
      failed.push({ email, reason: "Kelas wajib dipilih untuk akun siswa" });
      continue;
    }

    if (role === "siswa" && !jenis_kelamin) {
      failed.push({ email, reason: "Jenis kelamin wajib dipilih untuk akun siswa" });
      continue;
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("supabase_id")
      .eq("email", email)
      .single();

    if (existing) {
      failed.push({ email, reason: "Email sudah terdaftar" });
      continue;
    }

    let siswaId: string | undefined;
    let guruId: string | undefined;
    if (role === "siswa") {
      try {
        siswaId = await createSiswaRecord(full_name, jenis_kelamin, kelas_id, nis);
      } catch (e: any) {
        failed.push({ email, reason: e.message });
        continue;
      }
    } else if (role === "guru") {
      try {
        guruId = await createGuruRecord(full_name, nip);
      } catch (e: any) {
        failed.push({ email, reason: e.message });
        continue;
      }
    }

    const appMeta: Record<string, string> = {};
    if (siswaId) appMeta.siswa_id = siswaId;
    if (guruId) appMeta.guru_id = guruId;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMeta,
      user_metadata: appMeta,
    });

    if (authError || !authData.user) {
      if (siswaId) await supabase.from("siswa").delete().eq("id", siswaId);
      if (guruId) await supabase.from("guru").delete().eq("id", guruId);
      failed.push({ email, reason: authError?.message || "Gagal membuat akun" });
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      supabase_id: authData.user.id,
      email,
      full_name,
      role,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      if (siswaId) await supabase.from("siswa").delete().eq("id", siswaId);
      if (guruId) await supabase.from("guru").delete().eq("id", guruId);
      failed.push({ email, reason: profileError.message });
      continue;
    }

    created.push(1);
  }

  res.json({ created: created.length, failed });
});

router.delete("/auth/delete-account/:supabase_id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { supabase_id } = req.params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("supabase_id", supabase_id)
    .single();

  if (!profile) {
    res.status(404).json({ error: "Not Found", message: "Akun tidak ditemukan" });
    return;
  }

  if (profile.role === "admin") {
    res.status(403).json({ error: "Forbidden", message: "Akun admin tidak dapat dihapus" });
    return;
  }

  // Also delete linked siswa or guru record
  const { data: authUser } = await supabase.auth.admin.getUserById(supabase_id);
  const siswaId = authUser?.user?.app_metadata?.siswa_id;
  const guruId = authUser?.user?.app_metadata?.guru_id;
  if (siswaId) await supabase.from("siswa").delete().eq("id", siswaId);
  if (guruId) await supabase.from("guru").delete().eq("id", guruId);

  await supabase.from("profiles").delete().eq("supabase_id", supabase_id);
  await supabase.auth.admin.deleteUser(supabase_id);

  res.json({ success: true, message: "Akun berhasil dihapus" });
});

// Link an existing siswa account to a siswa record (repair broken/unlinked accounts)
router.post("/auth/link-siswa/:supabase_id", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { supabase_id } = req.params;
  const { siswa_id } = req.body;

  if (!siswa_id) {
    res.status(400).json({ error: "Bad Request", message: "siswa_id diperlukan" });
    return;
  }

  // Verify the account exists and is a siswa
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("supabase_id", supabase_id)
    .single();

  if (!profile) {
    res.status(404).json({ error: "Not Found", message: "Akun tidak ditemukan" });
    return;
  }

  if (profile.role !== "siswa") {
    res.status(400).json({ error: "Bad Request", message: "Akun ini bukan akun siswa" });
    return;
  }

  // Verify the siswa record exists
  const { data: siswa } = await supabase
    .from("siswa")
    .select("id, nama, kelas_id")
    .eq("id", siswa_id)
    .single();

  if (!siswa) {
    res.status(404).json({ error: "Not Found", message: "Data siswa tidak ditemukan" });
    return;
  }

  // Update app_metadata to link the siswa_id
  const { error } = await supabase.auth.admin.updateUserById(supabase_id, {
    app_metadata: { siswa_id: siswa_id },
  });

  if (error) {
    res.status(500).json({ error: "Internal Server Error", message: error.message });
    return;
  }

  res.json({ success: true, message: `Akun berhasil dihubungkan ke data siswa ${siswa.nama}` });
});

export default router;
