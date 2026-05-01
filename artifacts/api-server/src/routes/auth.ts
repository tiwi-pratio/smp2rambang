import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

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

export default router;
