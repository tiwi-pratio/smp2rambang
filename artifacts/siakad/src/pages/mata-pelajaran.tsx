import { useState } from "react";
import { 
  useListMataPelajaran, 
  useCreateMataPelajaran, 
  useUpdateMataPelajaran, 
  useDeleteMataPelajaran,
  useListGuru,
  getListMataPelajaranQueryKey 
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Loader2, BookOpen } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

const mapelSchema = z.object({
  nama_mapel: z.string().min(1, "Nama mata pelajaran diperlukan"),
  kode_mapel: z.string().optional(),
  guru_id: z.string().optional(),
});

type MapelFormValues = z.infer<typeof mapelSchema>;

export default function MataPelajaranPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: mapelData, isLoading } = useListMataPelajaran();
  const { data: guruData } = useListGuru();

  const createMutation = useCreateMataPelajaran();
  const updateMutation = useUpdateMataPelajaran();
  const deleteMutation = useDeleteMataPelajaran();

  const form = useForm<MapelFormValues>({
    resolver: zodResolver(mapelSchema),
    defaultValues: {
      nama_mapel: "",
      kode_mapel: "",
      guru_id: "",
    },
  });

  const onSubmit = (values: MapelFormValues) => {
    const payload = {
      ...values,
      kode_mapel: values.kode_mapel || null,
      guru_id: values.guru_id && values.guru_id !== "__none__" ? values.guru_id : null,
    };

    if (editingMapel) {
      updateMutation.mutate(
        { id: editingMapel.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Mata Pelajaran berhasil diperbarui" });
            setIsCreateOpen(false);
            setEditingMapel(null);
            form.reset();
            queryClient.invalidateQueries({ queryKey: getListMataPelajaranQueryKey() });
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "Gagal memperbarui mata pelajaran", description: err?.data?.message || "Terjadi kesalahan." });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Mata Pelajaran berhasil ditambahkan" });
            setIsCreateOpen(false);
            form.reset();
            queryClient.invalidateQueries({ queryKey: getListMataPelajaranQueryKey() });
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "Gagal menambahkan mata pelajaran", description: err?.data?.message || "Terjadi kesalahan." });
          },
        }
      );
    }
  };

  const openEdit = (mapel: any) => {
    setEditingMapel(mapel);
    form.reset({
      nama_mapel: mapel.nama_mapel,
      kode_mapel: mapel.kode_mapel || "",
      // Ensure guru_id is always a string for the Select component
      guru_id: mapel.guru_id != null ? String(mapel.guru_id) : "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Mata Pelajaran berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getListMataPelajaranQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal menghapus mata pelajaran", description: err?.data?.message || "Terjadi kesalahan." });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Data Mata Pelajaran</h1>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingMapel(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Mapel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingMapel ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran Baru"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="kode_mapel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode Mata Pelajaran (Opsional)</FormLabel>
                      <FormControl><Input placeholder="Contoh: MAT-01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nama_mapel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Mata Pelajaran</FormLabel>
                      <FormControl><Input placeholder="Contoh: Matematika" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guru_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guru Pengampu (Opsional)</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih Guru Pengampu" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">— Tidak ada —</span>
                          </SelectItem>
                          {(guruData || []).map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <TableHead>Kode</TableHead>
                <TableHead>Nama Mata Pelajaran</TableHead>
                <TableHead>Guru Pengampu</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : mapelData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Tidak ada data mata pelajaran
                  </TableCell>
                </TableRow>
              ) : (
                mapelData?.map((mapel) => (
                  <TableRow key={mapel.id}>
                    <TableCell className="font-medium text-muted-foreground">{mapel.kode_mapel || '-'}</TableCell>
                    <TableCell className="font-medium">{mapel.nama_mapel}</TableCell>
                    <TableCell>
                      {(mapel as any).guru?.nama
                        ? <span className="font-medium">{(mapel as any).guru.nama}</span>
                        : <span className="text-muted-foreground italic">Belum ditentukan</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(mapel)}>
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
                              <AlertDialogTitle>Hapus Mata Pelajaran</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus {mapel.nama_mapel}? Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(mapel.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
