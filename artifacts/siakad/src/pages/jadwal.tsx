import { useState, useEffect } from "react";
import { 
  useListJadwal, 
  useCreateJadwal, 
  useDeleteJadwal,
  useListKelas,
  useListMataPelajaran,
  useListGuru,
  getListJadwalQueryKey,
  useGetMe
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Calendar, BookOpen } from "lucide-react";
import { fetchMySiswa } from "@/lib/profil-api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const HARI_OPTIONS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

const jadwalSchema = z.object({
  kelas_id: z.string().min(1, "Kelas diperlukan"),
  mata_pelajaran_id: z.string().min(1, "Mata Pelajaran diperlukan"),
  guru_id: z.string().min(1, "Guru diperlukan"),
  hari: z.enum(HARI_OPTIONS, { required_error: "Hari diperlukan" }),
  jam_mulai: z.string().min(1, "Jam mulai diperlukan"),
  jam_selesai: z.string().min(1, "Jam selesai diperlukan"),
});

type JadwalFormValues = z.infer<typeof jadwalSchema>;

export default function JadwalPage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const isAdmin = user?.role === 'admin';
  const isGuru = user?.role === 'guru';
  const isSiswa = user?.role === 'siswa';

  const [selectedKelas, setSelectedKelas] = useState<string>("all");
  const [siswaKelas, setSiswaKelas] = useState<{ id: string; nama_kelas: string } | null>(null);
  // tracks whether we've finished resolving the siswa's kelas_id
  const [siswaKelasResolved, setSiswaKelasResolved] = useState(false);
  const [siswaKelasId, setSiswaKelasId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Resolve siswa's kelas before fetching jadwal
  useEffect(() => {
    if (userLoading) return;
    if (!isSiswa) {
      setSiswaKelasResolved(true);
      return;
    }
    fetchMySiswa().then((data) => {
      if (data?.kelas_id) {
        const kid = String(data.kelas_id);
        setSiswaKelasId(kid);
        setSelectedKelas(kid);
        setSiswaKelas(data.kelas ?? null);
      } else {
        setSiswaKelasId(null);
      }
    }).catch(() => {
      setSiswaKelasId(null);
    }).finally(() => {
      setSiswaKelasResolved(true);
    });
  }, [user, userLoading, isSiswa]);

  // For siswa: only enable the query once kelas is resolved and found
  // For admin/guru: always enabled, uses selectedKelas filter
  const effectiveKelasId = isSiswa ? siswaKelasId : (selectedKelas !== "all" ? selectedKelas : undefined);

  const { data: jadwalData, isLoading } = useListJadwal(
    effectiveKelasId ? { kelas_id: effectiveKelasId } : undefined,
    { query: { enabled: !isSiswa || (siswaKelasResolved && siswaKelasId !== null) } }
  );
  
  const { data: kelasData } = useListKelas();
  const { data: mapelData } = useListMataPelajaran();
  const { data: guruData } = useListGuru();

  const createMutation = useCreateJadwal();
  const deleteMutation = useDeleteJadwal();

  const form = useForm<JadwalFormValues>({
    resolver: zodResolver(jadwalSchema),
    defaultValues: {
      kelas_id: "",
      mata_pelajaran_id: "",
      guru_id: "",
      hari: "Senin",
      jam_mulai: "07:00",
      jam_selesai: "08:30",
    },
  });

  const onSubmit = (values: JadwalFormValues) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Jadwal berhasil ditambahkan" });
          setIsCreateOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListJadwalQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Jadwal berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getListJadwalQueryKey() });
        },
      }
    );
  };

  // Group jadwal by hari
  const jadwalByHari = HARI_OPTIONS.reduce((acc, hari) => {
    acc[hari] = jadwalData?.filter(j => j.hari === hari).sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai)) || [];
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Pelajaran</h1>
            {isSiswa && siswaKelas && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <BookOpen className="h-3.5 w-3.5" />
                {siswaKelas.nama_kelas}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isSiswa && (
            <Select value={selectedKelas} onValueChange={setSelectedKelas}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Pilih Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasData?.map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isAdmin && (
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) form.reset();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Tambah Jadwal Pelajaran</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="hari"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hari</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Hari" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {HARI_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="jam_mulai"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Mulai</FormLabel>
                            <FormControl><Input type="time" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="jam_selesai"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Selesai</FormLabel>
                            <FormControl><Input type="time" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="kelas_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kelas</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Kelas" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {kelasData?.map(k => (
                                <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mata_pelajaran_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mata Pelajaran</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Mata Pelajaran" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mapelData?.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="guru_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guru Pengampu</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Guru" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {guruData?.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Siswa with no linked kelas */}
      {isSiswa && siswaKelasResolved && !siswaKelasId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="bg-amber-100 p-4 rounded-full">
              <Calendar className="h-8 w-8 text-amber-500" />
            </div>
            <p className="font-semibold text-foreground">Kelas belum terdaftar</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Akun kamu belum terhubung ke kelas. Hubungi admin untuk menghubungkan akun ke kelas yang sesuai.
            </p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(isLoading || (isSiswa && !siswaKelasResolved)) ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3 border-b bg-muted/50">
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {[1, 2].map(j => (
                    <div key={j} className="flex gap-4">
                      <Skeleton className="h-10 w-16 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          HARI_OPTIONS.map(hari => (
            <Card key={hari}>
              <CardHeader className="pb-3 border-b bg-muted/50">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{hari}</span>
                  <Badge variant="outline" className="bg-background">
                    {jadwalByHari[hari].length} Sesi
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                {jadwalByHari[hari].length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Tidak ada jadwal
                  </div>
                ) : (
                  <div className="divide-y">
                    {jadwalByHari[hari].map(jadwal => (
                      <div key={jadwal.id} className="p-4 flex gap-4 hover:bg-muted/50 transition-colors group">
                        <div className="shrink-0 text-sm font-medium text-center">
                          <div className="text-primary">{jadwal.jam_mulai}</div>
                          <div className="text-muted-foreground text-xs">{jadwal.jam_selesai}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{jadwal.mata_pelajaran?.nama_mapel}</div>
                          <div className="text-sm text-muted-foreground truncate">{jadwal.guru?.nama}</div>
                          {selectedKelas === "all" && !isSiswa && (
                            <Badge variant="secondary" className="mt-1">
                              Kelas {jadwal.kelas?.nama_kelas}
                            </Badge>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Jadwal</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Yakin ingin menghapus jadwal ini?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(jadwal.id)} className="bg-destructive text-destructive-foreground">
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      )}
    </div>
  );
}

