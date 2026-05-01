import { useState } from "react";
import { 
  useGetMe,
  useListNilai,
  useCreateNilai,
  useUpdateNilai,
  useDeleteNilai,
  useListKelas,
  useListMataPelajaran,
  useListSiswa,
  getListNilaiQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
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

const nilaiSchema = z.object({
  siswa_id: z.string().min(1, "Siswa diperlukan"),
  mata_pelajaran_id: z.string().min(1, "Mata Pelajaran diperlukan"),
  semester: z.enum(["1", "2"], { required_error: "Semester diperlukan" }),
  tahun_ajaran: z.string().min(1, "Tahun ajaran diperlukan"),
  nilai_harian: z.coerce.number().min(0).max(100).optional(),
  nilai_uts: z.coerce.number().min(0).max(100).optional(),
  nilai_uas: z.coerce.number().min(0).max(100).optional(),
});

type NilaiFormValues = z.infer<typeof nilaiSchema>;

export default function NilaiPage() {
  const { data: user } = useGetMe();
  const isAdmin = user?.role === 'admin';
  const isGuru = user?.role === 'guru';
  const isSiswa = user?.role === 'siswa';

  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedMapel, setSelectedMapel] = useState<string>("");
  const [semester, setSemester] = useState<string>("1");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNilai, setEditingNilai] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: nilaiData, isLoading } = useListNilai(
    isSiswa ? undefined : { 
      kelas_id: selectedKelas || undefined,
      mata_pelajaran_id: selectedMapel || undefined,
      semester: semester || undefined
    }
  );
  
  const { data: kelasData } = useListKelas();
  const { data: mapelData } = useListMataPelajaran();
  const { data: siswaData } = useListSiswa({ kelas_id: selectedKelas, limit: 100 }, { query: { enabled: !!selectedKelas } });

  const createMutation = useCreateNilai();
  const updateMutation = useUpdateNilai();
  const deleteMutation = useDeleteNilai();

  const form = useForm<NilaiFormValues>({
    resolver: zodResolver(nilaiSchema),
    defaultValues: {
      siswa_id: "",
      mata_pelajaran_id: "",
      semester: "1",
      tahun_ajaran: "2023/2024",
      nilai_harian: 0,
      nilai_uts: 0,
      nilai_uas: 0,
    },
  });

  const onSubmit = (values: NilaiFormValues) => {
    const payload = {
      ...values,
      nilai_harian: values.nilai_harian || 0,
      nilai_uts: values.nilai_uts || 0,
      nilai_uas: values.nilai_uas || 0,
    };

    if (editingNilai) {
      updateMutation.mutate(
        { id: editingNilai.id, data: {
          nilai_harian: payload.nilai_harian,
          nilai_uts: payload.nilai_uts,
          nilai_uas: payload.nilai_uas,
        } },
        {
          onSuccess: () => {
            toast({ title: "Nilai berhasil diperbarui" });
            setIsCreateOpen(false);
            setEditingNilai(null);
            queryClient.invalidateQueries({ queryKey: getListNilaiQueryKey() });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload as any },
        {
          onSuccess: () => {
            toast({ title: "Nilai berhasil ditambahkan" });
            setIsCreateOpen(false);
            form.reset();
            queryClient.invalidateQueries({ queryKey: getListNilaiQueryKey() });
          },
        }
      );
    }
  };

  const openEdit = (nilai: any) => {
    setEditingNilai(nilai);
    form.reset({
      siswa_id: nilai.siswa_id,
      mata_pelajaran_id: nilai.mata_pelajaran_id,
      semester: nilai.semester as "1" | "2",
      tahun_ajaran: nilai.tahun_ajaran,
      nilai_harian: nilai.nilai_harian || 0,
      nilai_uts: nilai.nilai_uts || 0,
      nilai_uas: nilai.nilai_uas || 0,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Nilai berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getListNilaiQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{isSiswa ? "Nilai Saya" : "Data Nilai Siswa"}</h1>
        </div>
        
        {!isSiswa && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) {
                setEditingNilai(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Nilai
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingNilai ? "Edit Nilai" : "Tambah Nilai Baru"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {!editingNilai && (
                        <>
                          <FormItem>
                            <FormLabel>Kelas (Untuk Filter Siswa)</FormLabel>
                            <Select onValueChange={setSelectedKelas} defaultValue={selectedKelas}>
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
                          </FormItem>
                          <FormField
                            control={form.control}
                            name="siswa_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Siswa</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedKelas}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Pilih Siswa" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {siswaData?.data?.map(s => (
                                      <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
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
                                      <SelectValue placeholder="Pilih Mapel" />
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
                            name="semester"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Semester</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Pilih Semester" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1">Semester 1 (Ganjil)</SelectItem>
                                    <SelectItem value="2">Semester 2 (Genap)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="tahun_ajaran"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Tahun Ajaran</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      
                      {editingNilai && (
                        <div className="col-span-2 bg-muted p-3 rounded-md mb-2">
                          <p className="font-medium">{editingNilai.siswa?.nama}</p>
                          <p className="text-sm text-muted-foreground">{editingNilai.mata_pelajaran?.nama_mapel} - Semester {editingNilai.semester}</p>
                        </div>
                      )}

                      <div className="col-span-2 grid grid-cols-3 gap-4 pt-2 border-t mt-2">
                        <FormField
                          control={form.control}
                          name="nilai_harian"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nilai Harian</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nilai_uts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nilai UTS</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nilai_uas"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nilai UAS</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="col-span-2 bg-primary/5 p-3 rounded-md text-sm mt-2">
                        <p className="font-medium text-primary mb-1">Informasi Perhitungan Nilai Akhir:</p>
                        <p className="text-muted-foreground">Nilai Akhir = (40% × Nilai Harian) + (30% × Nilai UTS) + (30% × Nilai UAS)</p>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {!isSiswa && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">Filter Pencarian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {kelasData?.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Mata Pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Mapel</SelectItem>
                  {mapelData?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester 1 (Ganjil)</SelectItem>
                  <SelectItem value="2">Semester 2 (Genap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {!isSiswa && <TableHead>Siswa</TableHead>}
                  <TableHead>Mata Pelajaran</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-right">Harian</TableHead>
                  <TableHead className="text-right">UTS</TableHead>
                  <TableHead className="text-right">UAS</TableHead>
                  <TableHead className="text-right">Nilai Akhir</TableHead>
                  {!isSiswa && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {!isSiswa && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      {!isSiswa && <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>}
                    </TableRow>
                  ))
                ) : !nilaiData?.length ? (
                  <TableRow>
                    <TableCell colSpan={isSiswa ? 6 : 8} className="text-center py-8 text-muted-foreground">
                      Tidak ada data nilai
                    </TableCell>
                  </TableRow>
                ) : (
                  nilaiData.map((nilai) => (
                    <TableRow key={nilai.id}>
                      {!isSiswa && (
                        <TableCell>
                          <div className="font-medium">{nilai.siswa?.nama}</div>
                          <div className="text-xs text-muted-foreground">{nilai.siswa?.nis}</div>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{nilai.mata_pelajaran?.nama_mapel}</TableCell>
                      <TableCell>
                        <Badge variant="outline">SMT {nilai.semester}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{nilai.nilai_harian || '-'}</TableCell>
                      <TableCell className="text-right">{nilai.nilai_uts || '-'}</TableCell>
                      <TableCell className="text-right">{nilai.nilai_uas || '-'}</TableCell>
                      <TableCell className="text-right font-bold">
                        <Badge variant={nilai.nilai_akhir && nilai.nilai_akhir >= 75 ? 'default' : 'secondary'}>
                          {nilai.nilai_akhir || '-'}
                        </Badge>
                      </TableCell>
                      {!isSiswa && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(nilai)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Nilai</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Apakah Anda yakin ingin menghapus data nilai ini? Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(nilai.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
