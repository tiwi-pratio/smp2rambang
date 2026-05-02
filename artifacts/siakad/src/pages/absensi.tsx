import { useState, useMemo } from "react";
import { 
  useGetMe,
  useListAbsensi,
  useListKelas,
  useListMataPelajaran,
  useListSiswa,
  useCreateAbsensi,
  useGetRekapAbsensi,
  getListAbsensiQueryKey,
  getGetRekapAbsensiQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Save, Search } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AbsensiPage() {
  const { data: user } = useGetMe();
  const isGuru = user?.role === 'guru';
  const isSiswa = user?.role === 'siswa';
  const isAdmin = user?.role === 'admin';

  if (isSiswa) {
    return <SiswaAbsensi />;
  }

  return <GuruAdminAbsensi isAdmin={isAdmin} />;
}

function GuruAdminAbsensi({ isAdmin }: { isAdmin: boolean }) {
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedMapel, setSelectedMapel] = useState<string>("");
  const [tanggal, setTanggal] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kelasData } = useListKelas();
  const { data: mapelData } = useListMataPelajaran();
  
  const { data: siswaData, isLoading: isLoadingSiswa } = useListSiswa(
    { kelas_id: selectedKelas, limit: 100 },
    { query: { enabled: !!selectedKelas } }
  );

  const { data: absensiData, isLoading: isLoadingAbsensi } = useListAbsensi(
    { 
      kelas_id: selectedKelas,
      mata_pelajaran_id: selectedMapel,
      tanggal: tanggal
    },
    { query: { enabled: !!(selectedKelas && selectedMapel && tanggal) } }
  );

  const createMutation = useCreateAbsensi();

  // Local state for absensi input before saving
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: "hadir"|"izin"|"sakit"|"alfa", keterangan: string }>>({});

  // Sync server data to local state when loaded
  useMemo(() => {
    if (absensiData?.length && siswaData?.data?.length) {
      const map: Record<string, any> = {};
      siswaData.data.forEach(siswa => {
        const existing = absensiData.find(a => a.siswa_id === siswa.id);
        if (existing) {
          map[siswa.id] = { status: existing.status, keterangan: existing.keterangan || "" };
        }
      });
      setAttendanceMap(map);
    } else {
      setAttendanceMap({});
    }
  }, [absensiData, siswaData]);

  const handleStatusChange = (siswaId: string, status: any) => {
    setAttendanceMap(prev => ({
      ...prev,
      [siswaId]: { status, keterangan: prev[siswaId]?.keterangan || "" }
    }));
  };

  const handleKeteranganChange = (siswaId: string, keterangan: string) => {
    setAttendanceMap(prev => ({
      ...prev,
      [siswaId]: { status: prev[siswaId]?.status || "hadir", keterangan }
    }));
  };

  const handleSave = () => {
    if (!siswaData?.data) return;

    const records = siswaData.data.map(siswa => {
      const entry = attendanceMap[siswa.id] || { status: "hadir", keterangan: "" };
      return {
        siswa_id: siswa.id,
        mata_pelajaran_id: selectedMapel,
        tanggal: tanggal,
        status: entry.status as any,
        keterangan: entry.keterangan
      };
    });

    createMutation.mutate(
      { data: { records } },
      {
        onSuccess: () => {
          toast({ title: "Data absensi berhasil disimpan" });
          queryClient.invalidateQueries({ queryKey: getListAbsensiQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal menyimpan absensi", description: err?.data?.message || "Terjadi kesalahan." });
        },
      }
    );
  };

  const canSave = !isAdmin && selectedKelas && selectedMapel && tanggal && siswaData?.data?.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-2 rounded-lg">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Absensi</h1>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filter Pencarian</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal</label>
              <Input 
                type="date" 
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kelas</label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  {kelasData?.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mata Pelajaran</label>
              <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mapel" />
                </SelectTrigger>
                <SelectContent>
                  {mapelData?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedKelas && selectedMapel ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Daftar Siswa</CardTitle>
            {canSave && (
              <Button onClick={handleSave} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Absensi
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">No</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSiswa || isLoadingAbsensi ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : !siswaData?.data?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Tidak ada siswa di kelas ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    siswaData.data.map((siswa, idx) => {
                      const entry = attendanceMap[siswa.id] || { status: isAdmin && absensiData?.length ? undefined : "hadir", keterangan: "" };
                      
                      return (
                        <TableRow key={siswa.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium text-muted-foreground">{siswa.nis}</TableCell>
                          <TableCell className="font-medium">{siswa.nama}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              entry.status ? (
                                <Badge variant={
                                  entry.status === 'hadir' ? 'default' : 
                                  entry.status === 'izin' ? 'outline' : 
                                  entry.status === 'sakit' ? 'secondary' : 'destructive'
                                }>
                                  {entry.status.toUpperCase()}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )
                            ) : (
                              <Select 
                                value={entry.status} 
                                onValueChange={(val) => handleStatusChange(siswa.id, val)}
                              >
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hadir">Hadir</SelectItem>
                                  <SelectItem value="izin">Izin</SelectItem>
                                  <SelectItem value="sakit">Sakit</SelectItem>
                                  <SelectItem value="alfa">Alfa</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <span className="text-sm">{entry.keterangan || "-"}</span>
                            ) : (
                              <Input 
                                placeholder="Keterangan opsional..." 
                                value={entry.keterangan}
                                onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
                                disabled={entry.status === 'hadir'}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Pilih Kelas dan Mata Pelajaran</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              Silakan pilih kelas, mata pelajaran, dan tanggal untuk melihat atau mengisi daftar hadir siswa.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SiswaAbsensi() {
  const [bulan, setBulan] = useState<string>(format(new Date(), 'yyyy-MM'));
  
  const { data: rekapData, isLoading } = useGetRekapAbsensi(
    { bulan },
    { query: { enabled: !!bulan, queryKey: getGetRekapAbsensiQueryKey({ bulan }) } }
  );

  const rekap = rekapData?.siswa?.[0]?.rekap;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-2 rounded-lg">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Rekap Absensi Saya</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilih Bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <Input 
            type="month" 
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="max-w-[200px]"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hadir</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-bold text-green-600">{rekap?.hadir || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Izin</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-bold text-blue-600">{rekap?.izin || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sakit</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-bold text-orange-600">{rekap?.sakit || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Alfa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-bold text-red-600">{rekap?.alfa || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
