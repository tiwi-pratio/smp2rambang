import { useGetMe, useGetAdminStats, useGetGuruStats, useGetSiswaStats } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Users2, School, BookOpen, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: user, isLoading: isLoadingUser } = useGetMe();

  if (isLoadingUser) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Selamat datang kembali, {user.full_name}</p>
      </div>

      {user.role === 'admin' && <AdminDashboard />}
      {user.role === 'guru' && <GuruDashboard />}
      {user.role === 'siswa' && <SiswaDashboard />}
    </div>
  );
}

function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  if (isLoading) return <DashboardSkeleton />;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Siswa" value={stats.total_siswa} icon={Users} color="text-orange-500" />
        <StatsCard title="Total Guru" value={stats.total_guru} icon={Users2} color="text-green-500" />
        <StatsCard title="Total Kelas" value={stats.total_kelas} icon={School} color="text-blue-500" />
        <StatsCard title="Total Mapel" value={stats.total_mata_pelajaran} icon={BookOpen} color="text-purple-500" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Siswa per Kelas</CardTitle>
            <CardDescription>Jumlah siswa aktif di setiap kelas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.siswa_per_kelas?.map((item) => (
                <div key={item.nama_kelas} className="flex items-center">
                  <div className="flex-1 font-medium">{item.nama_kelas}</div>
                  <div className="flex-1">
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${Math.min((item.jumlah / Math.max(...stats.siswa_per_kelas.map(s => s.jumlah))) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm text-muted-foreground">{item.jumlah}</div>
                </div>
              ))}
              {!stats.siswa_per_kelas?.length && (
                <div className="text-center text-muted-foreground py-4">Tidak ada data kelas</div>
              )}
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Kelas Diajar" value={stats.total_kelas_diajar} icon={School} color="text-blue-500" />
        <StatsCard title="Total Siswa" value={stats.total_siswa_diajar} icon={Users} color="text-orange-500" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jadwal Hari Ini</CardTitle>
            <CardDescription>Jadwal mengajar Anda hari ini</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.jadwal_hari_ini?.length > 0 ? (
              <div className="space-y-4">
                {stats.jadwal_hari_ini.map((jadwal) => (
                  <div key={jadwal.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <div className="bg-primary/10 p-2 rounded-md">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{jadwal.mata_pelajaran?.nama_mapel}</p>
                      <p className="text-xs text-muted-foreground">Kelas {jadwal.kelas?.nama_kelas}</p>
                    </div>
                    <div className="text-right text-sm font-medium">
                      {jadwal.jam_mulai} - {jadwal.jam_selesai}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Tidak ada jadwal mengajar hari ini</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mata Pelajaran</CardTitle>
            <CardDescription>Mata pelajaran yang Anda ampu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.mata_pelajaran?.map((mapel) => (
                <div key={mapel.id} className="flex justify-between items-center p-2 border-b last:border-0">
                  <span className="font-medium">{mapel.nama_mapel}</span>
                  {mapel.kode_mapel && <Badge variant="outline">{mapel.kode_mapel}</Badge>}
                </div>
              ))}
              {!stats.mata_pelajaran?.length && (
                <div className="text-center text-muted-foreground py-4">Belum ada mata pelajaran yang diampu</div>
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kehadiran (Bulan Ini)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rekap_absensi_bulan_ini?.hadir || 0}</div>
            <p className="text-xs text-muted-foreground">Dari {stats.rekap_absensi_bulan_ini?.total || 0} pertemuan</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jadwal Hari Ini</CardTitle>
            <CardDescription>Jadwal pelajaran kelas {stats.kelas}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.jadwal_hari_ini?.length > 0 ? (
              <div className="space-y-4">
                {stats.jadwal_hari_ini.map((jadwal) => (
                  <div key={jadwal.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <div className="bg-primary/10 p-2 rounded-md">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{jadwal.mata_pelajaran?.nama_mapel}</p>
                      <p className="text-xs text-muted-foreground">{jadwal.guru?.nama}</p>
                    </div>
                    <div className="text-right text-sm font-medium">
                      {jadwal.jam_mulai} - {jadwal.jam_selesai}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Tidak ada jadwal hari ini</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nilai Terbaru</CardTitle>
            <CardDescription>Rangkuman nilai mata pelajaran</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.nilai_terbaru?.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead className="text-right">Nilai Akhir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.nilai_terbaru.map((nilai) => (
                      <TableRow key={nilai.id}>
                        <TableCell className="font-medium">{nilai.mata_pelajaran?.nama_mapel}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={nilai.nilai_akhir && nilai.nilai_akhir >= 75 ? 'default' : 'secondary'}>
                            {nilai.nilai_akhir || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Belum ada data nilai</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: number | string, icon: any, color?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
