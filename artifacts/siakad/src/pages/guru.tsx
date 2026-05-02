import { useState } from "react";
import { 
  useListGuru, 
  useUpdateGuru, 
  useDeleteGuru,
  useListMataPelajaran,
  getListGuruQueryKey 
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Edit, Trash2, Loader2 } from "lucide-react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const guruSchema = z.object({
  nip: z.string().optional(),
  nama: z.string().min(1, "Nama diperlukan"),
  mata_pelajaran_id: z.string().optional(),
  no_hp: z.string().optional(),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  password: z.string().optional(),
});

type GuruFormValues = z.infer<typeof guruSchema>;

export default function GuruPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGuru, setEditingGuru] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: guruData, isLoading } = useListGuru({ search });
  const { data: mapelData } = useListMataPelajaran();

  const updateMutation = useUpdateGuru();
  const deleteMutation = useDeleteGuru();

  const form = useForm<GuruFormValues>({
    resolver: zodResolver(guruSchema),
    defaultValues: {
      nip: "",
      nama: "",
      mata_pelajaran_id: "",
      no_hp: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: GuruFormValues) => {
    if (!editingGuru) return;
    const payload = {
      ...values,
      nip: values.nip || null,
      mata_pelajaran_id: values.mata_pelajaran_id || null,
      no_hp: values.no_hp || null,
      email: values.email || null,
    };
    updateMutation.mutate(
      { id: editingGuru.id, data: payload },
      {
        onSuccess: () => {
          toast({ title: "Guru berhasil diperbarui" });
          setIsCreateOpen(false);
          setEditingGuru(null);
          queryClient.invalidateQueries({ queryKey: getListGuruQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal memperbarui guru", description: err?.data?.message || "Terjadi kesalahan." });
        },
      }
    );
  };

  const openEdit = (guru: any) => {
    setEditingGuru(guru);
    form.reset({
      nip: guru.nip || "",
      nama: guru.nama,
      mata_pelajaran_id: guru.mata_pelajaran_id || "",
      no_hp: guru.no_hp || "",
      email: guru.email || "",
      password: "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Guru berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getListGuruQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal menghapus guru", description: err?.data?.message || "Terjadi kesalahan." });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Data Guru</h1>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingGuru(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Guru</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIP (Opsional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nama"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mata_pelajaran_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mata Pelajaran (Opsional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Mata Pelajaran" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!mapelData?.length
                              ? <SelectItem value="__none__" disabled>Belum ada mapel</SelectItem>
                              : mapelData.map(m => (
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
                    name="no_hp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No HP (Opsional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Untuk Login)</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!editingGuru && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password (Untuk Login)</FormLabel>
                          <FormControl><Input type="password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama atau NIP..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIP</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Mata Pelajaran</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : guruData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Tidak ada data guru
                    </TableCell>
                  </TableRow>
                ) : (
                  guruData?.map((guru) => (
                    <TableRow key={guru.id}>
                      <TableCell className="font-medium">{guru.nip || '-'}</TableCell>
                      <TableCell className="font-medium">{guru.nama}</TableCell>
                      <TableCell>
                        {guru.mata_pelajaran ? (
                          <Badge variant="secondary">{guru.mata_pelajaran.nama_mapel}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{guru.no_hp || '-'}</div>
                        <div className="text-xs text-muted-foreground">{guru.email || '-'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(guru)}>
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
                                <AlertDialogTitle>Hapus Guru</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus data guru {guru.nama}? Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(guru.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
