import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    profile_id: number;
    email: string;
    role: string;
    full_name: string;
    siswa_id?: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Token tidak ditemukan" });
    return;
  }

  const token = authHeader.split(" ")[1];

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Unauthorized", message: "Token tidak valid" });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("supabase_id", user.id)
    .single();

  if (!profile) {
    res.status(401).json({ error: "Unauthorized", message: "Profil tidak ditemukan" });
    return;
  }

  req.user = {
    id: user.id,
    profile_id: profile.id,
    email: user.email!,
    role: profile.role,
    full_name: profile.full_name,
    siswa_id: user.app_metadata?.siswa_id,
  };

  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Akses ditolak" });
      return;
    }
    next();
  };
}
