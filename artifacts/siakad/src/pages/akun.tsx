import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAccounts,
  useCreateAccount,
  useDeleteAccount,
  getListAccountsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Plus, Trash2, UserCircle2, ShieldCheck } from "lucide-react";

const roleBadge = (role: string) => {
  switch (role) {
    case "admin": return <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 hover:bg-blue-500/15">Admin</Badge>;
    case "guru": return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/15">Guru</Badge>;
    case "siswa": return <Badge className="bg-orange-500/15 text-orange-700 border-orange-300 hover:bg-orangeald-500/15">Siswa</Badge>;
    default: return <Badge variant="outline">{role}</Badge>;
  }
};

export default function AkunPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useListAccounts();

  const [openCreate, setOpenCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "siswa" as "guru" | "siswa",
  });

  const createMutation = useCreateAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        toast({ title: "Berhasil", description: "Akun berhasil dibuat" });
        setOpenCreate(false);
        setForm({ email: "", password: "", full_name: "", role: "siswa" });
      },
      onError: (err: any) => {
        toast({
          title: "Gagal",
          description: err?.message || "Gagal membuat akun",
          variant: "destructive",
        });
      },
    },
  });

  const deleteMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        toast({ title: "Berhasil", description: "Akun berhasil dihapus" });
        setDeleteTarget(null);
      },
      onError: (err: any) => {
        toast({
          title: "Gagal",
          description: err?.message || "Gagal menghapus akun",
          variant: "destructive",
        });
      },
    },
  });

  const handleCreate = () => {
    if (!form.email || !form.password || !form.full_name) {
      toast({ title: "Error", description: "Semua field wajib diisi", variant: "destructive" });
      return;
    }
    createMutation.mutate({ data: form });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ supabaseId: deleteTarget.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manajemen Akun</h1>
            <p className="text-sm text-muted-foreground">Kelola akun login pengguna (guru & siswa)</p>
          </div>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Buat Akun Baru
        </Button>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium">Cara mendaftarkan siswa atau guru:</p>
          <ol className="mt-1 ml-4 list-decimal space-y-0.5">
            <li>Tambah data siswa/guru terlebih dahulu di halaman <strong>Siswa</strong> atau <strong>Guru</strong></li>
            <li>Buat akun login di halaman ini dengan email dan password</li>
            <li>Bagikan email & password kepada siswa/guru yang bersangkutan</li>
          </ol>
        </div>
      </div>

      {/* Account list */}
      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Memuat data akun...</div>
        ) : !accounts?.length ? (
          <div className="p-8 text-center text-muted-foreground">Belum ada akun terdaftar</div>
        ) : (
          <div className="divide-y">
            {accounts.map((acc) => (
              <div key={acc.supabase_id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{acc.full_name}</div>
                    <div className="text-sm text-muted-foreground truncate">{acc.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {roleBadge(acc.role)}
                  {acc.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() => setDeleteTarget({ id: acc.supabase_id, name: acc.full_name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Akun Login Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                placeholder="Nama lengkap pengguna"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@contoh.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "guru" | "siswa" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="siswa">Siswa</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Membuat..." : "Buat Akun"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus akun <strong>{deleteTarget?.name}</strong>? Pengguna ini tidak akan bisa login lagi. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus Akun"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
