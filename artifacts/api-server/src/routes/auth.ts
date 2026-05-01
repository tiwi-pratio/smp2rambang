import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

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
  });
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

  res.json(profiles || []);
});

router.post("/auth/create-account", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  const { email, password, full_name, role } = req.body;

  if (!email || !password || !full_name || !role) {
    res.status(400).json({ error: "Bad Request", message: "Semua field wajib diisi" });
    return;
  }

  if (!["guru", "siswa"].includes(role)) {
    res.status(400).json({ error: "Bad Request", message: "Role harus guru atau siswa" });
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

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
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
    res.status(400).json({ error: "Bad Request", message: profileError.message });
    return;
  }

  res.status(201).json({ success: true, message: `Akun ${full_name} berhasil dibuat` });
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

  await supabase.from("profiles").delete().eq("supabase_id", supabase_id);
  await supabase.auth.admin.deleteUser(supabase_id);

  res.json({ success: true, message: "Akun berhasil dihapus" });
});

export default router;
