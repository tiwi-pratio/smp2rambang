import { useState } from "react";
import { 
  useListKelas, 
  useCreateKelas, 
  useUpdateKelas, 
  useDeleteKelas,
  useListGuru,
  getListKelasQueryKey 
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Loader2, School } from "lucide-react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ROMBEL_OPTIONS, buildNamaKelas, parseRombelFromNamaKelas } from "@/lib/kelas-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Card, CardContent } from "@/components/ui/card";

const kelasSchema = z.object({
  tingkat: z.coerce.number().min(7).max(9),
  rombel: z.string().min(1, "Rombel diperlukan"),
  wali_kelas_id: z.string().optional(),
  tahun_ajaran: z.string().min(1, "Tahun ajaran diperlukan (misal: 2024/2025)"),
});

type KelasFormValues = z.infer<typeof kelasSchema>;

export default function KelasPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kelasData, isLoading } = useListKelas();
  const { data: guruData } = useListGuru();

  const createMutation = useCreateKelas();
  const updateMutation = useUpdateKelas();
  const deleteMutation = useDeleteKelas();

  const form = useForm<KelasFormValues>({
    resolver: zodResolver(kelasSchema),
    defaultValues: {
      tingkat: 7,
      rombel: "",
      wali_kelas_id: "",
      tahun_ajaran: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
    },
  });

  const watchedTingkat = useWatch({ control: form.control, name: "tingkat" });
  const watchedRombel = useWatch({ control: form.control, name: "rombel" });
  const previewNamaKelas = watchedRombel ? buildNamaKelas(watchedTingkat, watchedRombel) : "";

  const onSubmit = (values: KelasFormValues) => {
    const payload = {
      nama_kelas: buildNamaKelas(values.tingkat, values.rombel),
      tingkat: values.tingkat,
      tahun_ajaran: values.tahun_ajaran,
      wali_kelas_id: values.wali_kelas_id || null,
    };

    if (editingKelas) {
      updateMutation.mutate(
        { id: editingKelas.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Kelas berhasil diperbarui" });
            setIsCreateOpen(false);
            setEditingKelas(null);
            queryClient.invalidateQueries({ queryKey: getListKelasQueryKey() });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Kelas berhasil ditambahkan" });
            setIsCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: getListKelasQueryKey() });
          },
        }
      );
    }
  };

  const openEdit = (kelas: any) => {
    setEditingKelas(kelas);
    form.reset({
      tingkat: kelas.tingkat,
      rombel: parseRombelFromNamaKelas(kelas.nama_kelas),
      wali_kelas_id: kelas.wali_kelas_id || "",
      tahun_ajaran: kelas.tahun_ajaran,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Kelas berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getListKelasQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <School className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Data Kelas</h1>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingKelas(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Kelas
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingKelas ? "Edit Kelas" : "Tambah Kelas Baru"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tingkat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tingkat</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); form.setValue("rombel", ""); }} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Tingkat" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7">Kelas 7</SelectItem>
                            <SelectItem value="8">Kelas 8</SelectItem>
                            <SelectItem value="9">Kelas 9</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rombel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rombel</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Rombel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROMBEL_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {previewNamaKelas && (
                    <div className="col-span-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                      Nama kelas: <strong>{previewNamaKelas}</strong>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="tahun_ajaran"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tahun Ajaran</FormLabel>
                        <FormControl><Input placeholder="2023/2024" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wali_kelas_id"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Wali Kelas</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Wali Kelas" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!guruData?.length
                              ? <SelectItem value="__none__" disabled>Belum ada wali kelas</SelectItem>
                              : guruData.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Kelas</TableHead>
                <TableHead>Tingkat</TableHead>
                <TableHead>Wali Kelas</TableHead>
                <TableHead>Tahun Ajaran</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : kelasData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Tidak ada data kelas
                  </TableCell>
                </TableRow>
              ) : (
                kelasData?.map((kelas) => (
                  <TableRow key={kelas.id}>
                    <TableCell className="font-medium">{kelas.nama_kelas}</TableCell>
                    <TableCell>Kelas {kelas.tingkat}</TableCell>
                    <TableCell>{kelas.wali_kelas?.nama || <span className="text-muted-foreground italic">Belum ada</span>}</TableCell>
                    <TableCell>{kelas.tahun_ajaran}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(kelas)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus kelas {kelas.nama_kelas}? Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(kelas.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}