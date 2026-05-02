import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    profile_id: number;
    email: string;
    role: string;
    full_name: string;
    siswa_id?: string;
    guru_id?: string;
  };
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
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

  // Primary: try app_metadata and user_metadata from getUser response
  let siswaId: string | undefined =
    user.app_metadata?.siswa_id || user.user_metadata?.siswa_id;
  let guruId: string | undefined =
    user.app_metadata?.guru_id || user.user_metadata?.guru_id;

  // Fallback: decode JWT payload directly — check app_metadata, user_metadata, and top-level claims
  if (!siswaId && !guruId) {
    const jwtPayload = decodeJwtPayload(token);
    if (jwtPayload) {
      siswaId =
        jwtPayload.app_metadata?.siswa_id ||
        jwtPayload.user_metadata?.siswa_id ||
        jwtPayload.siswa_id;
      guruId =
        jwtPayload.app_metadata?.guru_id ||
        jwtPayload.user_metadata?.guru_id ||
        jwtPayload.guru_id;
    }
  }

  if (!siswaId && !guruId) {
    logger.debug({ userId: user.id }, "No entity id in token — admin API will resolve in route handlers");
  }

  req.user = {
    id: user.id,
    profile_id: profile.id,
    email: user.email!,
    role: profile.role,
    full_name: profile.full_name,
    siswa_id: siswaId,
    guru_id: guruId,
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
