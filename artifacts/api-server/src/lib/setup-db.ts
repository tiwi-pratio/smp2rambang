import { supabase } from "./supabase";
import { logger } from "./logger";

const SESI_ABSENSI_SQL = `
CREATE TABLE IF NOT EXISTS sesi_absensi (
  token TEXT PRIMARY KEY,
  kelas_id INTEGER NOT NULL,
  mata_pelajaran_id INTEGER NOT NULL,
  guru_id INTEGER,
  tanggal TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  siswa_hadir_ids TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sesi_absensi_expires_at ON sesi_absensi (expires_at);
`.trim();

async function tryCreateTableViaRest(supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const endpoints = [
    `${supabaseUrl}/rest/v1/sql`,
    `${supabaseUrl}/sql`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: SESI_ABSENSI_SQL }),
      });
      if (res.ok || res.status === 204) {
        return true;
      }
    } catch {
    }
  }
  return false;
}

export async function setupDb(): Promise<void> {
  try {
    const { error } = await supabase.from("sesi_absensi").select("token").limit(1);

    if (!error) {
      logger.info("Tabel sesi_absensi sudah ada di Supabase ✓");
      return;
    }

    const isTableNotFound =
      error.code === "42P01" ||
      (error.message && error.message.includes("sesi_absensi"));

    if (!isTableNotFound) {
      logger.warn({ error: error.message }, "Error saat cek tabel sesi_absensi, lanjut dengan in-memory fallback");
      return;
    }

    logger.info("Tabel sesi_absensi belum ada, mencoba membuat otomatis...");

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const created = await tryCreateTableViaRest(supabaseUrl, serviceKey);

    if (created) {
      const { error: checkErr } = await supabase.from("sesi_absensi").select("token").limit(1);
      if (!checkErr) {
        logger.info("Tabel sesi_absensi berhasil dibuat di Supabase ✓");
        return;
      }
    }

    logger.warn(
      `\n\n⚠️  Tabel sesi_absensi belum ada di Supabase.\n` +
      `   Jalankan SQL ini di Supabase Studio → SQL Editor:\n\n` +
      SESI_ABSENSI_SQL +
      `\n\n   URL: ${supabaseUrl.replace("https://", "https://supabase.com/dashboard/project/").replace(".supabase.co", "")}/sql/new\n`
    );
  } catch (err) {
    logger.warn({ err }, "setupDb gagal, lanjut tanpa persistent session");
  }
}
