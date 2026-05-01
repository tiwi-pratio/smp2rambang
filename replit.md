# SIAKAD - SMP Negeri 2 Rambang

Sistem Informasi Akademik untuk SMP Negeri 2 Rambang.

## Arsitektur

- **Frontend**: React + Vite + TypeScript (`artifacts/siakad`) — preview di `/`
- **Backend API**: Node.js + Express (`artifacts/api-server`) — preview di `/api`
- **Database**: Supabase (PostgreSQL) + Supabase Auth
- **API Contract**: OpenAPI spec di `lib/api-spec/openapi.yaml`, hooks generated di `lib/api-client-react`

## Kredensial Admin

- **Email**: admin@smpn2rambang.sch.id
- **Password**: Admin@12345
- **Role**: admin

## Fitur

1. **Auth**: Login/logout berbasis Supabase Auth dengan 3 role (admin, guru, siswa)
2. **Dashboard**: Statistik berbasis role (admin stats, guru stats, siswa stats)
3. **Manajemen Siswa**: CRUD dengan search & filter per kelas
4. **Manajemen Guru**: CRUD dengan assignment mata pelajaran
5. **Manajemen Kelas**: CRUD dengan wali kelas
6. **Mata Pelajaran**: CRUD dengan assignment guru
7. **Jadwal**: View dan manajemen jadwal per kelas
8. **Absensi**: Input absensi per kelas/mapel, rekap bulanan
9. **Nilai**: Input nilai harian/UTS/UAS, auto-hitung nilai akhir (40%/30%/30%)
10. **Raport Digital**: Generate raport per siswa/semester dengan format printable
11. **Manajemen Akun**: Buat akun login siswa/guru (single atau bulk). Untuk siswa, otomatis membuat data siswa + memilih kelas. Link siswa↔akun disimpan via Supabase `app_metadata.siswa_id` (tanpa perubahan skema DB)

## Database (Supabase)

Tabel: `profiles`, `guru`, `siswa`, `kelas`, `mata_pelajaran`, `jadwal`, `absensi`, `nilai`

Catatan: Tabel menggunakan integer ID (bukan UUID). Tabel `profiles` menggunakan kolom `supabase_id` untuk menyimpan UUID dari Supabase Auth. Link siswa↔akun disimpan di Supabase Auth `app_metadata.siswa_id` (middleware membaca ini ke `req.user.siswa_id`).

## Environment Variables

- `SUPABASE_URL` — URL project Supabase
- `SUPABASE_ANON_KEY` — Publishable/anon key Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (secret)

## Data Seed

- 5 guru
- 3 kelas (VII-A, VIII-B, IX-C)
- 7 mata pelajaran
- 15 siswa
- 11 jadwal pelajaran
- 8 nilai
- 10 absensi
