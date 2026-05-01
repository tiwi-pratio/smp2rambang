import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAccounts,
  useCreateAccount,
  useDeleteAccount,
  useBulkCreateAccounts,
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
import {
  KeyRound,
  Plus,
  Trash2,
  UserCircle2,
  ShieldCheck,
  Users,
  PlusCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const roleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 hover:bg-blue-500/15">
          Admin
        </Badge>
      );
    case "guru":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/15">
          Guru
        </Badge>
      );
    case "siswa":
      return (
        <Badge className="bg-orange-500/15 text-orange-700 border-orange-300 hover:bg-orange-500/15">
          Siswa
        </Badge>
      );
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
};

type BulkRow = {
  id: number;
  full_name: string;
  email: string;
  password: string;
  role: "guru" | "siswa";
};

let rowIdCounter = 1;

const emptyRow = (): BulkRow => ({
  id: rowIdCounter++,
  full_name: "",
  email: "",
  password: "",
  role: "siswa",
});

export default function AkunPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useListAccounts();

  const [openCreate, setOpenCreate] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "siswa" as "guru" | "siswa",
  });

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyRow()]);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    failed: { email: string; reason: string }[];
  } | null>(null);

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

  const bulkMutation = useBulkCreateAccounts({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        setBulkResult(data);
      },
      onError: (err: any) => {
        toast({
          title: "Gagal",
          description: err?.message || "Gagal membuat akun massal",
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
      toast({
        title: "Error",
        description: "Semua field wajib diisi",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ data: form });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ supabaseId: deleteTarget.id });
  };

  const handleBulkSubmit = () => {
    const validRows = bulkRows.filter(
      (r) => r.email || r.full_name || r.password,
    );
    if (validRows.length === 0) {
      toast({
        title: "Error",
        description: "Tambahkan minimal satu akun",
        variant: "destructive",
      });
      return;
    }
    bulkMutation.mutate({ data: { accounts: validRows } });
  };

  const addRow = () => setBulkRows((rows) => [...rows, emptyRow()]);

  const removeRow = (id: number) =>
    setBulkRows((rows) => rows.filter((r) => r.id !== id));

  const updateRow = (id: number, field: keyof BulkRow, value: string) =>
    setBulkRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );

  const handleCloseBulk = () => {
    setOpenBulk(false);
    setBulkRows([emptyRow()]);
    setBulkResult(null);
    bulkMutation.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Manajemen Akun
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola akun login pengguna (guru & siswa)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setOpenBulk(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Tambah Banyak Akun
          </Button>
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Buat Akun Baru
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium">Cara mendaftarkan siswa atau guru:</p>
          <ol className="mt-1 ml-4 list-decimal space-y-0.5">
            <li>
              Tambah data siswa/guru terlebih dahulu di halaman{" "}
              <strong>Siswa</strong> atau <strong>Guru</strong>
            </li>
            <li>Buat akun login di halaman ini dengan email dan password</li>
            <li>
              Bagikan email & password kepada siswa/guru yang bersangkutan
            </li>
          </ol>
        </div>
      </div>

      {/* Account list */}
      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Memuat data akun...
          </div>
        ) : !accounts?.length ? (
          <div className="p-8 text-center text-muted-foreground">
            Belum ada akun terdaftar
          </div>
        ) : (
          <div className="divide-y">
            {accounts.map((acc) => (
              <div
                key={acc.supabase_id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{acc.full_name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {acc.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {roleBadge(acc.role)}
                  {acc.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() =>
                        setDeleteTarget({
                          id: acc.supabase_id,
                          name: acc.full_name,
                        })
                      }
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

      {/* Create single dialog */}
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
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as "guru" | "siswa" })
                }
              >
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
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Batal
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Membuat..." : "Buat Akun"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk create dialog */}
      <Dialog open={openBulk} onOpenChange={handleCloseBulk}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Tambah Banyak Akun Sekaligus
            </DialogTitle>
          </DialogHeader>

          {bulkResult ? (
            /* Result screen */
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">
                    {bulkResult.created} akun berhasil dibuat
                  </p>
                  {bulkResult.failed.length > 0 && (
                    <p className="text-sm text-emerald-700">
                      {bulkResult.failed.length} akun gagal — lihat detail di bawah
                    </p>
                  )}
                </div>
              </div>

              {bulkResult.failed.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-destructive/20">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-sm text-destructive">
                      Akun yang gagal dibuat
                    </span>
                  </div>
                  <div className="divide-y divide-destructive/10">
                    {bulkResult.failed.map((f, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{f.email}</p>
                          <p className="text-xs text-muted-foreground">{f.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Input screen */
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Isi data akun yang ingin dibuat. Klik{" "}
                <strong>+ Tambah Baris</strong> untuk menambah lebih banyak.
              </p>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_1fr_140px_36px] gap-2 px-1">
                <span className="text-xs font-medium text-muted-foreground">Nama Lengkap</span>
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <span className="text-xs font-medium text-muted-foreground">Role</span>
                <span />
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {bulkRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_1fr_1fr_140px_36px] gap-2 items-center"
                  >
                    <Input
                      placeholder="Nama lengkap"
                      value={row.full_name}
                      onChange={(e) =>
                        updateRow(row.id, "full_name", e.target.value)
                      }
                    />
                    <Input
                      type="email"
                      placeholder="email@contoh.com"
                      value={row.email}
                      onChange={(e) =>
                        updateRow(row.id, "email", e.target.value)
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Password"
                      value={row.password}
                      onChange={(e) =>
                        updateRow(row.id, "password", e.target.value)
                      }
                    />
                    <Select
                      value={row.role}
                      onValueChange={(v) =>
                        updateRow(row.id, "role", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="siswa">Siswa</SelectItem>
                        <SelectItem value="guru">Guru</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      disabled={bulkRows.length === 1 && idx === 0}
                      onClick={() => removeRow(row.id)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                onClick={addRow}
              >
                <PlusCircle className="h-4 w-4" />
                Tambah Baris
              </Button>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            {bulkResult ? (
              <Button onClick={handleCloseBulk}>Selesai</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseBulk}>
                  Batal
                </Button>
                <Button
                  onClick={handleBulkSubmit}
                  disabled={bulkMutation.isPending}
                >
                  {bulkMutation.isPending
                    ? `Membuat ${bulkRows.length} akun...`
                    : `Buat ${bulkRows.length} Akun`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus akun{" "}
              <strong>{deleteTarget?.name}</strong>? Pengguna ini tidak akan
              bisa login lagi. Tindakan ini tidak dapat dibatalkan.
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
