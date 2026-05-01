import { useGetMe, useGetAdminStats, useGetGuruStats, useGetSiswaStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Users2, School, BookOpen, Calendar as CalendarIcon, CheckCircle2, FileText, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: user, isLoading: isLoadingUser } = useGetMe();

  if (isLoadingUser) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-400">
      {/* Welcome Banner */}
      <div
        className="rounded-2xl px-7 py-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(231,59%,26%) 0%, hsl(213,39%,40%) 100%)" }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }} />
        <div className="relative">
          <p className="text-white/60 text-sm font-medium mb-1">{greeting},</p>
          <h2 className="text-2xl font-bold tracking-tight">{user.full_name}</h2>
          <p className="text-white/70 text-sm mt-1 capitalize">
            {user.role === "admin" ? "Administrator Sistem" : user.role === "guru" ? "Tenaga Pengajar" : "Peserta Didik"}
          </p>
        </div>
      </div>

      {user.role === "admin" && <AdminDashboard />}
      {user.role === "guru" && <GuruDashboard />}
      {user.role === "siswa" && <SiswaDashboard />}
    </div>
  );
}

function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  if (isLoading) return <DashboardSkeleton />;
  if (!stats) return null;

  const maxSiswa = stats.siswa_per_kelas?.length
    ? Math.max(...stats.siswa_per_kelas.map((s) => s.jumlah))
    : 1;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Siswa"
          value={stats.total_siswa}
          icon={Users}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          trend="+2 bulan ini"
        />
        <StatCard
          title="Total Guru"
          value={stats.total_guru}
          icon={Users2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Total Kelas"
          value={stats.total_kelas}
          icon={School}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Mata Pelajaran"
          value={stats.total_mata_pelajaran}
          icon={BookOpen}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Siswa per Kelas Bar Chart */}
        <Card className="lg:col-span-3 border border-border shadow-none rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Distribusi Siswa</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Jumlah siswa aktif per kelas</p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.siswa_per_kelas?.map((item) => {
                const pct = Math.round((item.jumlah / maxSiswa) * 100);
                return (
                  <div key={item.nama_kelas} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">{item.nama_kelas}</span>
                      <span className="text-sm font-semibold" style={{ color: "hsl(231,59%,26%)" }}>{item.jumlah} siswa</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, hsl(231,59%,26%), hsl(213,39%,47%))"
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {!stats.siswa_per_kelas?.length && (
                <p className="text-center text-muted-foreground text-sm py-6">Tidak ada data kelas</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Info */}
        <Card className="lg:col-span-2 border border-border shadow-none rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-foreground">Ringkasan Sistem</CardTitle>
            <p className="text-xs text-muted-foreground">Status data akademik</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Total Siswa Aktif", value: stats.total_siswa, color: "bg-orange-500" },
                { label: "Guru Terdaftar", value: stats.total_guru, color: "bg-emerald-500" },
                { label: "Kelas Aktif", value: stats.total_kelas, color: "bg-blue-500" },
                { label: "Mata Pelajaran", value: stats.total_mata_pelajaran, color: "bg-purple-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuruDashboard() {
  const { data: stats, isLoading } = useGetGuruStats();

  if (isLoading) return <DashboardSkeleton />;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2">
        <StatCard
          title="Kelas Diajar"
          value={stats.total_kelas_diajar}
          icon={School}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Total Siswa"
          value={stats.total_siswa_diajar}
          icon={Users}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Jadwal */}
        <Card className="border border-border shadow-none rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Jadwal Hari Ini</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Jadwal mengajar Anda</p>
          </CardHeader>
          <CardContent>
            {stats.jadwal_hari_ini?.length > 0 ? (
              <div className="space-y-2">
                {stats.jadwal_hari_ini.map((jadwal) => (
                  <div key={jadwal.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "hsl(231,59%,26%,0.1)" }}
                    >
                      <BookOpen className="h-4 w-4" style={{ color: "hsl(231,59%,26%)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{jadwal.mata_pelajaran?.nama_mapel}</p>
                      <p className="text-xs text-muted-foreground">Kelas {jadwal.kelas?.nama_kelas}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{jadwal.jam_mulai}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarIcon} message="Tidak ada jadwal mengajar hari ini" />
            )}
          </CardContent>
        </Card>

        {/* Mata Pelajaran */}
        <Card className="border border-border shadow-none rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Mata Pelajaran</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Mapel yang Anda ampu</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.mata_pelajaran?.map((mapel) => (
                <div key={mapel.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-sm font-medium text-foreground">{mapel.nama_mapel}</span>
                  {mapel.kode_mapel && (
                    <span className="text-xs font-mono bg-white border border-border px-2 py-0.5 rounded-md text-muted-foreground">
                      {mapel.kode_mapel}
                    </span>
                  )}
                </div>
              ))}
              {!stats.mata_pelajaran?.length && (
                <EmptyState icon={BookOpen} message="Belum ada mata pelajaran yang diampu" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SiswaDashboard() {
  const { data: stats, isLoading } = useGetSiswaStats();

  if (isLoading) return <DashboardSkeleton />;
  if (!stats) return null;

  const total = stats.rekap_absensi_bulan_ini?.total || 0;
  const hadir = stats.rekap_absensi_bulan_ini?.hadir || 0;
  const pctHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Kehadiran Card */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border border-border shadow-none rounded-2xl sm:col-span-1">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "hsl(231,59%,26%,0.1)" }}>
                <CheckCircle2 className="h-8 w-8" style={{ color: "hsl(231,59%,26%)" }} />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{pctHadir}%</p>
                <p className="text-sm text-muted-foreground mt-0.5">Tingkat Kehadiran</p>
                <p className="text-xs text-muted-foreground">{hadir} dari {total} pertemuan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none rounded-2xl sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(213,39%,47%,0.1)" }}>
                <School className="h-5 w-5" style={{ color: "hsl(213,39%,47%)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{stats.kelas || "-"}</p>
                <p className="text-xs text-muted-foreground">Kelas aktif Anda</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Jadwal Hari Ini */}
        <Card className="border border-border shadow-none rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Jadwal Hari Ini</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Kelas {stats.kelas}</p>
          </CardHeader>
          <CardContent>
            {stats.jadwal_hari_ini?.length > 0 ? (
              <div className="space-y-2">
                {stats.jadwal_hari_ini.map((jadwal) => (
                  <div key={jadwal.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "hsl(231,59%,26%,0.1)" }}
                    >
                      <BookOpen className="h-4 w-4" style={{ color: "hsl(231,59%,26%)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{jadwal.mata_pelajaran?.nama_mapel}</p>
                      <p className="text-xs text-muted-foreground">{jadwal.guru?.nama}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{jadwal.jam_mulai}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarIcon} message="Tidak ada jadwal hari ini" />
            )}
          </CardContent>
        </Card>

        {/* Nilai Terbaru */}
        <Card className="border border-border shadow-none rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Nilai Terbaru</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Rangkuman nilai mata pelajaran</p>
          </CardHeader>
          <CardContent>
            {stats.nilai_terbaru?.length > 0 ? (
              <div className="space-y-2">
                {stats.nilai_terbaru.map((nilai) => {
                  const nilaiAkhir = nilai.nilai_akhir;
                  const passed = nilaiAkhir && nilaiAkhir >= 75;
                  return (
                    <div key={nilai.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <span className="text-sm font-medium text-foreground">{nilai.mata_pelajaran?.nama_mapel}</span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          passed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {nilaiAkhir ?? "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={FileText} message="Belum ada data nilai" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title, value, icon: Icon, iconBg, iconColor, trend
}: {
  title: string;
  value: number | string;
  icon: any;
  iconBg: string;
  iconColor: string;
  trend?: string;
}) {
  return (
    <Card className="border border-border shadow-none rounded-2xl" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {trend && (
              <p className="text-xs text-emerald-600 mt-1 font-medium">{trend}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Skeleton className="h-52 rounded-2xl lg:col-span-3" />
        <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}
