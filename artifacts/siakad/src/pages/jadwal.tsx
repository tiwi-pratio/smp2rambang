import { useState, useEffect, useMemo } from "react";
import {
  useListJadwal,
  useCreateJadwal,
  useDeleteJadwal,
  useListKelas,
  useListMataPelajaran,
  useListGuru,
  getListJadwalQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Calendar, BookOpen, RefreshCw } from "lucide-react";
import { fetchMySiswa } from "@/lib/profil-api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KelasSelector } from "@/components/ui/kelas-selector";

const HARI_OPTIONS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
const MANUAL_KELAS_KEY = "siakad_siswa_kelas_id";

const jadwalSchema = z
  .object({
    kelas_id: z.string().min(1, "Kelas diperlukan"),
    mata_pelajaran_id: z.string().min(1, "Mata Pelajaran diperlukan"),
    guru_id: z.string().min(1, "Guru diperlukan"),
    hari: z.enum(HARI_OPTIONS, { required_error: "Hari diperlukan" }),
    jam_mulai: z.string().min(1, "Jam mulai diperlukan"),
    jam_selesai: z.string().min(1, "Jam selesai diperlukan"),
  })
  .refine(
    (d) => !d.jam_mulai || !d.jam_selesai || d.jam_selesai > d.jam_mulai,
    { message: "Jam selesai harus lebih lambat dari jam mulai", path: ["jam_selesai"] }
  );

type JadwalFormValues = z.infer<typeof jadwalSchema>;

export default function JadwalPage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const isAdmin = user?.role === "admin";
  const isSiswa = user?.role === "siswa";

  // Admin/guru filter state
  const [selectedKelas, setSelectedKelas] = useState<string>("all");
  const [filterTingkat, setFilterTingkat] = useState<string>("all");

  // Siswa linking state
  const [autoLinkedKelasId, setAutoLinkedKelasId] = useState<string | null>(null);
  const [autoLinkedKelasName, setAutoLinkedKelasName] = useState<string | null>(null);
  const [siswaResolved, setSiswaResolved] = useState(false);

  // Manual kelas picker state for siswa who aren't auto-linked
  const [manualKelasId, setManualKelasId] = useState<string>(
    () => localStorage.getItem(MANUAL_KELAS_KEY) ?? ""
  );
  const [pickerKelasId, setPickerKelasId] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Attempt auto-link on mount (for siswa)
  useEffect(() => {
    if (userLoading || !isSiswa) {
      setSiswaResolved(true);
      return;
    }
    fetchMySiswa()
      .then((data) => {
        if (data?.kelas_id) {
          const kid = String(data.kelas_id);
          setAutoLinkedKelasId(kid);
          setAutoLinkedKelasName(data.kelas?.nama_kelas ?? null);
          // Auto-link succeeded — clear any stale manual override
          localStorage.removeItem(MANUAL_KELAS_KEY);
          setManualKelasId("");
        }
      })
      .catch(() => {})
      .finally(() => setSiswaResolved(true));
  }, [user, userLoading, isSiswa]);

  // The kelas ID to load jadwal for
  const effectiveKelasId = useMemo(() => {
    if (isSiswa) {
      return autoLinkedKelasId ?? (manualKelasId || null);
    }
    return selectedKelas !== "all" ? selectedKelas : undefined;
  }, [isSiswa, autoLinkedKelasId, manualKelasId, selectedKelas]);

  const { data: jadwalData, isLoading } = useListJadwal(
    effectiveKelasId ? { kelas_id: effectiveKelasId } : undefined,
    {
      query: {
        enabled: !isSiswa
          ? true
          : siswaResolved && effectiveKelasId !== null,
      },
    }
  );

  const { data: kelasData } = useListKelas();
  const { data: mapelData } = useListMataPelajaran();
  const { data: guruData } = useListGuru();

  const kelasByTingkat = useMemo(() => {
    if (!kelasData) return [];
    return filterTingkat !== "all"
      ? kelasData.filter((k) => String(k.tingkat) === filterTingkat)
      : kelasData;
  }, [kelasData, filterTingkat]);

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

  const handleOpenCreate = () => {
    form.reset({
      kelas_id: selectedKelas !== "all" ? selectedKelas : "",
      mata_pelajaran_id: "",
      guru_id: "",
      hari: "Senin",
      jam_mulai: "07:00",
      jam_selesai: "08:30",
    });
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    form.reset({
      kelas_id: "",
      mata_pelajaran_id: "",
      guru_id: "",
      hari: "Senin",
      jam_mulai: "07:00",
      jam_selesai: "08:30",
    });
  };

  const onSubmit = (values: JadwalFormValues) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Jadwal berhasil ditambahkan" });
          handleCloseCreate();
          queryClient.invalidateQueries({ queryKey: getListJadwalQueryKey() });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Gagal menambahkan jadwal",
            description: err?.data?.message || "Terjadi kesalahan. Coba lagi.",
          });
        },
      }
    );
  };

  const handleDelete = (id: string, namaMapel?: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: `Jadwal${namaMapel ? ` ${namaMapel}` : ""} berhasil dihapus` });
          queryClient.invalidateQueries({ queryKey: getListJadwalQueryKey() });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Gagal menghapus jadwal",
            description: err?.data?.message || "Terjadi kesalahan. Coba lagi.",
          });
        },
      }
    );
  };

  // Confirm manual kelas picker selection
  const handleConfirmKelas = () => {
    if (!pickerKelasId) return;
    localStorage.setItem(MANUAL_KELAS_KEY, pickerKelasId);
    setManualKelasId(pickerKelasId);
    setShowPicker(false);
    setPickerKelasId("");
  };

  // Reset manual kelas (show picker again)
  const handleGantiKelas = () => {
    setPickerKelasId(manualKelasId);
    setShowPicker(true);
  };

  const jadwalByHari = HARI_OPTIONS.reduce(
    (acc, hari) => {
      acc[hari] =
        jadwalData
          ?.filter((j) => j.hari === hari)
          .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai)) ?? [];
      return acc;
    },
    {} as Record<string, any[]>
  );

  // Determine displayed kelas name for siswa
  const siswaDisplayKelas = useMemo(() => {
    if (!isSiswa || !effectiveKelasId) return null;
    if (autoLinkedKelasName) return autoLinkedKelasName;
    return kelasData?.find((k) => String(k.id) === effectiveKelasId)?.nama_kelas ?? null;
  }, [isSiswa, effectiveKelasId, autoLinkedKelasName, kelasData]);

  // Show kelas picker for siswa who aren't linked and haven't picked manually
  const needsPicker =
    isSiswa &&
    siswaResolved &&
    !autoLinkedKelasId &&
    (!manualKelasId || showPicker);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Pelajaran</h1>
            {isSiswa && siswaDisplayKelas && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <BookOpen className="h-3.5 w-3.5" />
                {siswaDisplayKelas}
                {!autoLinkedKelasId && (
                  <button
                    onClick={handleGantiKelas}
                    className="ml-1 underline text-primary hover:opacity-70 transition-opacity text-xs"
                  >
                    Ganti
                  </button>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Admin/guru kelas filter */}
          {!isSiswa && (
            <div className="flex items-center gap-2">
              <Select
                value={filterTingkat}
                onValueChange={(v) => {
                  setFilterTingkat(v);
                  setSelectedKelas("all");
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tingkat</SelectItem>
                  <SelectItem value="7">Kelas 7</SelectItem>
                  <SelectItem value="8">Kelas 8</SelectItem>
                  <SelectItem value="9">Kelas 9</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {kelasByTingkat.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Admin: tambah jadwal */}
          {isAdmin && (
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                if (open) handleOpenCreate();
                else handleCloseCreate();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Jadwal
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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Hari" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {HARI_OPTIONS.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
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
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
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
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
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
                          <FormControl>
                            <KelasSelector
                              kelasList={kelasData ?? []}
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          </FormControl>
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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Mata Pelajaran" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mapelData?.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.nama_mapel}
                                </SelectItem>
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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Guru" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {guruData?.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.nama}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={handleCloseCreate}>
                        Batal
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Simpan Jadwal
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Siswa: manual kelas picker (shown when not auto-linked or clicking "Ganti") */}
      {needsPicker && (
        <Card className="border-primary/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
              <div className="bg-primary/10 p-3 rounded-full">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Pilih kelas kamu</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Pilih kelas yang sesuai untuk melihat jadwal pelajaran kamu.
                </p>
              </div>
              <div className="w-full max-w-xs">
                <KelasSelector
                  kelasList={kelasData ?? []}
                  value={pickerKelasId}
                  onValueChange={setPickerKelasId}
                />
              </div>
              <div className="flex gap-2">
                {showPicker && manualKelasId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPicker(false);
                      setPickerKelasId("");
                    }}
                  >
                    Batal
                  </Button>
                )}
                <Button onClick={handleConfirmKelas} disabled={!pickerKelasId}>
                  Lihat Jadwal
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jadwal grid */}
      {!needsPicker && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading || (isSiswa && !siswaResolved) ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3 border-b bg-muted/50">
                  <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {[1, 2].map((j) => (
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
            HARI_OPTIONS.map((hari) => (
              <Card key={hari}>
                <CardHeader className="pb-3 border-b bg-muted/50">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{hari}</span>
                    <Badge variant="outline" className="bg-background">
                      {jadwalByHari[hari].length} Sesi
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {jadwalByHari[hari].length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      Tidak ada jadwal
                    </div>
                  ) : (
                    <div className="divide-y">
                      {jadwalByHari[hari].map((jadwal) => (
                        <div
                          key={jadwal.id}
                          className="p-4 flex gap-4 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="shrink-0 text-sm font-medium text-center">
                            <div className="text-primary">{jadwal.jam_mulai}</div>
                            <div className="text-muted-foreground text-xs">
                              {jadwal.jam_selesai}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">
                              {jadwal.mata_pelajaran?.nama_mapel}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {jadwal.guru?.nama}
                            </div>
                            {selectedKelas === "all" && !isSiswa && jadwal.kelas?.nama_kelas && (
                              <Badge variant="secondary" className="mt-1">
                                {jadwal.kelas.nama_kelas}
                              </Badge>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Jadwal</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Yakin ingin menghapus jadwal{" "}
                                      <strong>{jadwal.mata_pelajaran?.nama_mapel}</strong> hari{" "}
                                      {hari}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleDelete(jadwal.id, jadwal.mata_pelajaran?.nama_mapel)
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
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
