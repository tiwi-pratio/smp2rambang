/**
 * Script untuk setup database Supabase SIAKAD
 * Membuat tabel dan mengisi data awal (seed)
 * Jalankan: pnpm --filter @workspace/scripts run setup-supabase
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSQL(sql: string, description: string) {
  console.log(`\n[>] ${description}`);
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    console.error(`    GAGAL: ${error.message}`);
    return false;
  }
  console.log(`    OK`);
  return true;
}

async function main() {
  console.log("=== SIAKAD Database Setup ===");
  console.log("Supabase URL:", supabaseUrl);

  // Test koneksi
  const { data: test, error: testError } = await supabase.from("profiles").select("count").limit(1);
  if (testError && testError.code !== "PGRST116") {
    console.log("\nTabel profiles belum ada, akan dibuat melalui Supabase SQL editor.");
    console.log("\nSilakan jalankan SQL berikut di Supabase Dashboard > SQL Editor:\n");
    console.log(generateSQL());
    return;
  }

  console.log("\nDatabase sudah tersambung. Mengisi data seed...");
  await seedData();
}

function generateSQL(): string {
  return `
-- ============================================================
-- SIAKAD SMP Negeri 2 Rambang - Database Schema & Seed Data
-- ============================================================

-- 1. Tabel profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS tapi bypass untuk service role
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service role bypass" ON public.profiles USING (true);

-- 2. Tabel kelas
CREATE TABLE IF NOT EXISTS public.kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kelas TEXT NOT NULL,
  tingkat INTEGER NOT NULL CHECK (tingkat IN (7, 8, 9)),
  wali_kelas_id UUID,
  tahun_ajaran TEXT NOT NULL DEFAULT '2024/2025',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel guru
CREATE TABLE IF NOT EXISTS public.guru (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nip TEXT,
  nama TEXT NOT NULL,
  mata_pelajaran_id UUID,
  no_hp TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel mata_pelajaran
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_mapel TEXT NOT NULL,
  kode_mapel TEXT,
  guru_id UUID REFERENCES public.guru(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan foreign key mata_pelajaran ke guru
DO $$ BEGIN
  ALTER TABLE public.guru ADD CONSTRAINT guru_mata_pelajaran_fkey 
    FOREIGN KEY (mata_pelajaran_id) REFERENCES public.mata_pelajaran(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tambahkan foreign key wali_kelas ke guru
DO $$ BEGIN
  ALTER TABLE public.kelas ADD CONSTRAINT kelas_wali_kelas_fkey 
    FOREIGN KEY (wali_kelas_id) REFERENCES public.guru(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Tabel siswa
CREATE TABLE IF NOT EXISTS public.siswa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nis TEXT NOT NULL UNIQUE,
  nisn TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  tanggal_lahir DATE NOT NULL,
  alamat TEXT,
  no_hp_ortu TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabel jadwal
CREATE TABLE IF NOT EXISTS public.jadwal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  mata_pelajaran_id UUID NOT NULL REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  guru_id UUID NOT NULL REFERENCES public.guru(id) ON DELETE CASCADE,
  hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabel absensi
CREATE TABLE IF NOT EXISTS public.absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
  mata_pelajaran_id UUID NOT NULL REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alfa')),
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(siswa_id, mata_pelajaran_id, tanggal)
);

-- 8. Tabel nilai
CREATE TABLE IF NOT EXISTS public.nilai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
  mata_pelajaran_id UUID NOT NULL REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  semester TEXT NOT NULL CHECK (semester IN ('1', '2')),
  nilai_harian NUMERIC(5,2),
  nilai_uts NUMERIC(5,2),
  nilai_uas NUMERIC(5,2),
  nilai_akhir NUMERIC(5,2),
  tahun_ajaran TEXT NOT NULL DEFAULT '2024/2025',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(siswa_id, mata_pelajaran_id, semester, tahun_ajaran)
);

-- Enable RLS untuk semua tabel (service role bypass semua)
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mata_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai ENABLE ROW LEVEL SECURITY;

-- Policies untuk service role bypass
DO $$ 
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['kelas','guru','mata_pelajaran','siswa','jadwal','absensi','nilai'] LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "Service role bypass" ON public.%I USING (true)', t);
  END LOOP;
END $$;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Admin user (buat dulu di Supabase Auth, lalu insert profile)
-- Email: admin@smpn2rambang.sch.id | Password: Admin@12345

-- Insert guru data (tanpa user_id dulu)
INSERT INTO public.guru (id, nip, nama, no_hp, email) VALUES
  ('11111111-1111-1111-1111-111111111111', '198501012010011001', 'Budi Santoso, S.Pd', '081234567801', 'budi@smpn2rambang.sch.id'),
  ('22222222-2222-2222-2222-222222222222', '198603152011012002', 'Sari Dewi, S.Pd', '081234567802', 'sari@smpn2rambang.sch.id'),
  ('33333333-3333-3333-3333-333333333333', '199001202012011003', 'Ahmad Fauzi, S.Pd', '081234567803', 'ahmad@smpn2rambang.sch.id'),
  ('44444444-4444-4444-4444-444444444444', '198812102013012004', 'Rina Marlina, S.Pd', '081234567804', 'rina@smpn2rambang.sch.id'),
  ('55555555-5555-5555-5555-555555555555', '199205202015011005', 'Dian Pratama, S.Pd', '081234567805', 'dian@smpn2rambang.sch.id')
ON CONFLICT (id) DO NOTHING;

-- Insert mata pelajaran
INSERT INTO public.mata_pelajaran (id, nama_mapel, kode_mapel, guru_id) VALUES
  ('aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Matematika', 'MTK', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bahasa Indonesia', 'BIND', '22222222-2222-2222-2222-222222222222'),
  ('aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'IPA', 'IPA', '33333333-3333-3333-3333-333333333333'),
  ('aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'IPS', 'IPS', '44444444-4444-4444-4444-444444444444'),
  ('aaaa0005-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bahasa Inggris', 'BING', '55555555-5555-5555-5555-555555555555'),
  ('aaaa0006-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pendidikan Agama Islam', 'PAI', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0007-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PKn', 'PKN', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- Update guru dengan mata_pelajaran_id
UPDATE public.guru SET mata_pelajaran_id = 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.guru SET mata_pelajaran_id = 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE public.guru SET mata_pelajaran_id = 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.guru SET mata_pelajaran_id = 'aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id = '44444444-4444-4444-4444-444444444444';
UPDATE public.guru SET mata_pelajaran_id = 'aaaa0005-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id = '55555555-5555-5555-5555-555555555555';

-- Insert kelas
INSERT INTO public.kelas (id, nama_kelas, tingkat, wali_kelas_id, tahun_ajaran) VALUES
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'VII-A', 7, '11111111-1111-1111-1111-111111111111', '2024/2025'),
  ('cccc0002-cccc-cccc-cccc-cccccccccccc', 'VIII-B', 8, '22222222-2222-2222-2222-222222222222', '2024/2025'),
  ('cccc0003-cccc-cccc-cccc-cccccccccccc', 'IX-C', 9, '33333333-3333-3333-3333-333333333333', '2024/2025')
ON CONFLICT (id) DO NOTHING;

-- Insert siswa (15 siswa)
INSERT INTO public.siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin, tanggal_lahir, alamat, no_hp_ortu) VALUES
  ('bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '240001', '3214010001', 'Ahmad Rifki', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'L', '2011-03-15', 'Jl. Merdeka No. 1, Rambang', '082100000001'),
  ('bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '240002', '3214010002', 'Anisa Putri', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'P', '2011-05-20', 'Jl. Mawar No. 2, Rambang', '082100000002'),
  ('bbbb0003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '240003', '3214010003', 'Bima Saputra', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'L', '2011-07-08', 'Jl. Melati No. 3, Rambang', '082100000003'),
  ('bbbb0004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '240004', '3214010004', 'Citra Lestari', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'P', '2011-09-12', 'Jl. Kenanga No. 4, Rambang', '082100000004'),
  ('bbbb0005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '240005', '3214010005', 'Deni Ardiansyah', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'L', '2011-11-25', 'Jl. Flamboyan No. 5, Rambang', '082100000005'),
  ('bbbb0006-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '230001', '3213010001', 'Eko Prasetyo', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'L', '2010-02-14', 'Jl. Dahlia No. 6, Rambang', '082100000006'),
  ('bbbb0007-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '230002', '3213010002', 'Fitri Rahmawati', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'P', '2010-04-18', 'Jl. Anggrek No. 7, Rambang', '082100000007'),
  ('bbbb0008-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '230003', '3213010003', 'Galih Nugroho', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'L', '2010-06-22', 'Jl. Tulip No. 8, Rambang', '082100000008'),
  ('bbbb0009-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '230004', '3213010004', 'Hani Safitri', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'P', '2010-08-30', 'Jl. Lily No. 9, Rambang', '082100000009'),
  ('bbbb0010-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '230005', '3213010005', 'Irfan Hakim', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'L', '2010-10-05', 'Jl. Cempaka No. 10, Rambang', '082100000010'),
  ('bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '220001', '3212010001', 'Jihan Aulia', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'P', '2009-01-11', 'Jl. Bougenville No. 11, Rambang', '082100000011'),
  ('bbbb0012-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '220002', '3212010002', 'Kevin Santoso', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'L', '2009-03-17', 'Jl. Seroja No. 12, Rambang', '082100000012'),
  ('bbbb0013-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '220003', '3212010003', 'Laila Nurjanah', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'P', '2009-05-23', 'Jl. Sedap Malam No. 13, Rambang', '082100000013'),
  ('bbbb0014-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '220004', '3212010004', 'Muhammad Fachri', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'L', '2009-07-29', 'Jl. Kamboja No. 14, Rambang', '082100000014'),
  ('bbbb0015-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '220005', '3212010005', 'Nanda Permata', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'P', '2009-09-03', 'Jl. Aster No. 15, Rambang', '082100000015')
ON CONFLICT (nis) DO NOTHING;

-- Insert jadwal untuk kelas VII-A
INSERT INTO public.jadwal (kelas_id, mata_pelajaran_id, guru_id, hari, jam_mulai, jam_selesai) VALUES
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Senin', '07:30', '09:00'),
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Senin', '09:00', '10:30'),
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Selasa', '07:30', '09:00'),
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Selasa', '09:00', '10:30'),
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0005-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Rabu', '07:30', '09:00'),
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Kamis', '07:30', '09:00'),
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Jumat', '07:30', '08:30')
ON CONFLICT DO NOTHING;

-- Insert nilai untuk siswa kelas IX-C (untuk raport)
INSERT INTO public.nilai (siswa_id, mata_pelajaran_id, semester, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, tahun_ajaran) VALUES
  ('bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 85, 80, 82, 82.6, '2024/2025'),
  ('bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 90, 85, 88, 88.1, '2024/2025'),
  ('bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 78, 75, 80, 77.7, '2024/2025'),
  ('bbbb0012-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 92, 88, 90, 90.2, '2024/2025'),
  ('bbbb0012-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 75, 70, 72, 72.6, '2024/2025'),
  ('bbbb0013-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 88, 83, 86, 85.9, '2024/2025'),
  ('bbbb0014-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 70, 68, 72, 70.0, '2024/2025'),
  ('bbbb0015-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 95, 92, 94, 93.8, '2024/2025')
ON CONFLICT (siswa_id, mata_pelajaran_id, semester, tahun_ajaran) DO NOTHING;

-- Insert beberapa absensi contoh
INSERT INTO public.absensi (siswa_id, mata_pelajaran_id, tanggal, status) VALUES
  ('bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-28', 'hadir'),
  ('bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-28', 'hadir'),
  ('bbbb0003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-28', 'izin'),
  ('bbbb0004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-28', 'hadir'),
  ('bbbb0005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-28', 'sakit'),
  ('bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-29', 'hadir'),
  ('bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-29', 'hadir'),
  ('bbbb0003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-04-29', 'hadir'),
  ('bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-05-01', 'hadir'),
  ('bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-05-01', 'alfa')
ON CONFLICT (siswa_id, mata_pelajaran_id, tanggal) DO NOTHING;

-- Buat admin profile (jalankan setelah membuat user admin di Supabase Auth Dashboard)
-- INSERT INTO public.profiles (id, email, role, full_name)
-- VALUES ('<UUID_dari_auth_user>', 'admin@smpn2rambang.sch.id', 'admin', 'Administrator SIAKAD');

SELECT 'Setup selesai! Database SIAKAD berhasil dikonfigurasi.' AS pesan;
`;
}

async function seedData() {
  console.log("\nMengisi data seed...");

  // Cek apakah sudah ada data
  const { count } = await supabase.from("guru").select("*", { count: "exact", head: true });
  if (count && count > 0) {
    console.log("Data sudah ada, skip seed.");
    return;
  }

  // Insert guru
  const guruData = [
    { id: '11111111-1111-1111-1111-111111111111', nip: '198501012010011001', nama: 'Budi Santoso, S.Pd', no_hp: '081234567801', email: 'budi@smpn2rambang.sch.id' },
    { id: '22222222-2222-2222-2222-222222222222', nip: '198603152011012002', nama: 'Sari Dewi, S.Pd', no_hp: '081234567802', email: 'sari@smpn2rambang.sch.id' },
    { id: '33333333-3333-3333-3333-333333333333', nip: '199001202012011003', nama: 'Ahmad Fauzi, S.Pd', no_hp: '081234567803', email: 'ahmad@smpn2rambang.sch.id' },
    { id: '44444444-4444-4444-4444-444444444444', nip: '198812102013012004', nama: 'Rina Marlina, S.Pd', no_hp: '081234567804', email: 'rina@smpn2rambang.sch.id' },
    { id: '55555555-5555-5555-5555-555555555555', nip: '199205202015011005', nama: 'Dian Pratama, S.Pd', no_hp: '081234567805', email: 'dian@smpn2rambang.sch.id' },
  ];

  const { error: guruErr } = await supabase.from("guru").upsert(guruData);
  if (guruErr) console.error("Guru error:", guruErr.message);
  else console.log("✓ 5 guru berhasil ditambahkan");

  // Insert mapel
  const mapelData = [
    { id: 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'Matematika', kode_mapel: 'MTK', guru_id: '11111111-1111-1111-1111-111111111111' },
    { id: 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'Bahasa Indonesia', kode_mapel: 'BIND', guru_id: '22222222-2222-2222-2222-222222222222' },
    { id: 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'IPA', kode_mapel: 'IPA', guru_id: '33333333-3333-3333-3333-333333333333' },
    { id: 'aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'IPS', kode_mapel: 'IPS', guru_id: '44444444-4444-4444-4444-444444444444' },
    { id: 'aaaa0005-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'Bahasa Inggris', kode_mapel: 'BING', guru_id: '55555555-5555-5555-5555-555555555555' },
    { id: 'aaaa0006-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'Pendidikan Agama Islam', kode_mapel: 'PAI', guru_id: '11111111-1111-1111-1111-111111111111' },
    { id: 'aaaa0007-aaaa-aaaa-aaaa-aaaaaaaaaaaa', nama_mapel: 'PKn', kode_mapel: 'PKN', guru_id: '22222222-2222-2222-2222-222222222222' },
  ];

  const { error: mapelErr } = await supabase.from("mata_pelajaran").upsert(mapelData);
  if (mapelErr) console.error("Mapel error:", mapelErr.message);
  else console.log("✓ 7 mata pelajaran berhasil ditambahkan");

  // Update guru mata_pelajaran_id
  await supabase.from("guru").update({ mata_pelajaran_id: 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }).eq('id', '11111111-1111-1111-1111-111111111111');
  await supabase.from("guru").update({ mata_pelajaran_id: 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }).eq('id', '22222222-2222-2222-2222-222222222222');
  await supabase.from("guru").update({ mata_pelajaran_id: 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }).eq('id', '33333333-3333-3333-3333-333333333333');
  await supabase.from("guru").update({ mata_pelajaran_id: 'aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }).eq('id', '44444444-4444-4444-4444-444444444444');
  await supabase.from("guru").update({ mata_pelajaran_id: 'aaaa0005-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }).eq('id', '55555555-5555-5555-5555-555555555555');

  // Insert kelas
  const kelasData = [
    { id: 'cccc0001-cccc-cccc-cccc-cccccccccccc', nama_kelas: 'VII-A', tingkat: 7, wali_kelas_id: '11111111-1111-1111-1111-111111111111', tahun_ajaran: '2024/2025' },
    { id: 'cccc0002-cccc-cccc-cccc-cccccccccccc', nama_kelas: 'VIII-B', tingkat: 8, wali_kelas_id: '22222222-2222-2222-2222-222222222222', tahun_ajaran: '2024/2025' },
    { id: 'cccc0003-cccc-cccc-cccc-cccccccccccc', nama_kelas: 'IX-C', tingkat: 9, wali_kelas_id: '33333333-3333-3333-3333-333333333333', tahun_ajaran: '2024/2025' },
  ];

  const { error: kelasErr } = await supabase.from("kelas").upsert(kelasData);
  if (kelasErr) console.error("Kelas error:", kelasErr.message);
  else console.log("✓ 3 kelas berhasil ditambahkan");

  console.log("\nSetup selesai!");
}

main().catch(console.error);
