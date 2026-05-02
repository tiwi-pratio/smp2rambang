import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAccounts,
  useCreateAccount,
  useDeleteAccount,
  useBulkCreateAccounts,
  useListKelas,
  useListSiswa,
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
  Link2,
  Search,
} from "lucide-react";
import { KelasSelector } from "@/components/ui/kelas-selector";

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
  kelas_id: string;
  nis: string;
  nip: string;
  jenis_kelamin: string;
};

let rowIdCounter = 1;

const emptyRow = (): BulkRow => ({
  id: rowIdCounter++,
  full_name: "",
  email: "",
  password: "",
  role: "siswa",
  kelas_id: "",
  nis: "",
  nip: "",
  jenis_kelamin: "",
});

export default function AkunPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useListAccounts();
  const { data: kelasList } = useListKelas();
  const { data: siswaList } = useListSiswa();

  const [openCreate, setOpenCreate] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [linkTarget, setLinkTarget] = useState<{
    supabase_id: string;
    full_name: string;
  } | null>(null);
  const [siswaSearch, setSiswaSearch] = useState("");
  const [selectedSiswaId, setSelectedSiswaId] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "siswa" as "guru" | "siswa",
    kelas_id: "",
    nis: "",
    nip: "",
    jenis_kelamin: "" as "" | "L" | "P",
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
        setForm({ email: "", password: "", full_name: "", role: "siswa", kelas_id: "", nis: "", nip: "", jenis_kelamin: "" });
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
      toast({ title: "Error", description: "Semua field wajib diisi", variant: "destructive" });
      return;
    }
    if (form.role === "siswa" && !form.kelas_id) {
      toast({ title: "Error", description: "Pilih kelas untuk akun siswa", variant: "destructive" });
      return;
    }
    if (form.role === "siswa" && !form.jenis_kelamin) {
      toast({ title: "Error", description: "Pilih jenis kelamin untuk akun siswa", variant: "destructive" });
      return;
    }
    const payload: any = { email: form.email, password: form.password, full_name: form.full_name, role: form.role };
    if (form.role === "siswa") {
      payload.kelas_id = form.kelas_id;
      payload.jenis_kelamin = form.jenis_kelamin;
      if (form.nis) payload.nis = form.nis;
    } else if (form.role === "guru") {
      if (form.nip) payload.nip = form.nip;
    }
    createMutation.mutate({ data: payload });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ supabaseId: deleteTarget.id });
  };

  const handleLinkSiswa = async () => {
    if (!linkTarget || !selectedSiswaId) return;
    setIsLinking(true);
    try {
      const token = localStorage.getItem("siakad_token") || "";
      const res = await fetch(`/api/auth/link-siswa/${linkTarget.supabase_id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ siswa_id: selectedSiswaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghubungkan akun");
      toast({ title: "Berhasil", description: data.message });
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      setLinkTarget(null);
      setSiswaSearch("");
      setSelectedSiswaId("");
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setIsLinking(false);
    }
  };

  const handleBulkSubmit = () => {
    const validRows = bulkRows.filter((r) => r.email || r.full_name || r.password);
    if (validRows.length === 0) {
      toast({ title: "Error", description: "Tambahkan minimal satu akun", variant: "destructive" });
      return;
    }
    const accounts = validRows.map((r) => {
      const acc: any = { email: r.email, password: r.password, full_name: r.full_name, role: r.role };
      if (r.role === "siswa" && r.kelas_id) acc.kelas_id = r.kelas_id;
      if (r.role === "siswa" && r.jenis_kelamin) acc.jenis_kelamin = r.jenis_kelamin;
      if (r.role === "siswa" && r.nis) acc.nis = r.nis;
      if (r.role === "guru" && r.nip) acc.nip = r.nip;
      return acc;
    });
    bulkMutation.mutate({ data: { accounts } });
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

  const hasSiswaRow = bulkRows.some((r) => r.role === "siswa");
  const hasGuruRow = bulkRows.some((r) => r.role === "guru");
  const hasExtraCol = hasSiswaRow || hasGuruRow;
  const hasJKCol = hasSiswaRow;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manajemen Akun</h1>
            <p className="text-sm text-muted-foreground">
              Kelola akun login pengguna (guru & siswa)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setOpenBulk(true)} className="gap-2">
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
              Klik <strong>Buat Akun Baru</strong> — pilih role, isi nama, email, dan password
            </li>
            <li>
              Untuk <strong>Siswa</strong>: pilih kelas (wajib) dan NIS (opsional) — data siswa dibuat otomatis
            </li>
            <li>
              Untuk <strong>Guru</strong>: isi NIP jika ada — data guru dibuat otomatis
            </li>
            <li>Bagikan email &amp; password kepada yang bersangkutan</li>
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
                      {acc.kelas_nama && (
                        <span className="ml-2 text-xs text-muted-foreground/70">
                          · {acc.kelas_nama}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {roleBadge(acc.role)}
                  {acc.role === "siswa" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 text-xs gap-1 ${acc.siswa_id ? "text-muted-foreground border-muted-foreground/30 hover:bg-muted/50" : "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"}`}
                      onClick={() => {
                        setSiswaSearch("");
                        setSelectedSiswaId("");
                        setLinkTarget({ supabase_id: acc.supabase_id, full_name: acc.full_name });
                      }}
                    >
                      <Link2 className="h-3 w-3" />
                      {acc.siswa_id ? "Ganti" : "Link"}
                    </Button>
                  )}
                  {acc.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() =>
                        setDeleteTarget({ id: acc.supabase_id, name: acc.full_name })
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl p-0 gap-0 max-h-[85dvh] flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-base">Buat Akun Login Baru</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 pb-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="full_name" className="text-sm">Nama Lengkap</Label>
                <Input
                  id="full_name"
                  placeholder="Nama lengkap pengguna"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@contoh.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as "guru" | "siswa", kelas_id: "", nis: "", nip: "", jenis_kelamin: "" })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="siswa">Siswa</SelectItem>
                    <SelectItem value="guru">Guru</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.role === "siswa" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-sm">
                      Jenis Kelamin <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.jenis_kelamin}
                      onValueChange={(v) => setForm({ ...form, jenis_kelamin: v as "L" | "P" })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Pilih jenis kelamin..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">
                      Kelas <span className="text-destructive">*</span>
                    </Label>
                    <KelasSelector
                      kelasList={kelasList ?? []}
                      value={form.kelas_id}
                      onValueChange={(v) => setForm({ ...form, kelas_id: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nis" className="text-sm">
                      NIS <span className="text-muted-foreground text-xs">(opsional)</span>
                    </Label>
                    <Input
                      id="nis"
                      placeholder="Nomor Induk Siswa"
                      value={form.nis}
                      onChange={(e) => setForm({ ...form, nis: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}

              {form.role === "guru" && (
                <div className="space-y-1">
                  <Label htmlFor="nip" className="text-sm">
                    NIP <span className="text-muted-foreground text-xs">(opsional)</span>
                  </Label>
                  <Input
                    id="nip"
                    placeholder="Nomor Induk Pegawai"
                    value={form.nip}
                    onChange={(e) => setForm({ ...form, nip: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="px-4 py-3 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenCreate(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Membuat..." : "Buat Akun"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk create dialog */}
      <Dialog open={openBulk} onOpenChange={handleCloseBulk}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Tambah Banyak Akun Sekaligus
            </DialogTitle>
          </DialogHeader>

          {bulkResult ? (
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
                      <div key={i} className="px-4 py-2.5">
                        <p className="text-sm font-medium">{f.email}</p>
                        <p className="text-xs text-muted-foreground">{f.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Isi data akun yang ingin dibuat. Untuk siswa, pilih jenis kelamin dan kelas.
              </p>

              <div
                className={`grid gap-2 px-1 ${
                  hasJKCol && hasExtraCol
                    ? "grid-cols-[1fr_1fr_1fr_110px_110px_140px_36px]"
                    : hasExtraCol
                    ? "grid-cols-[1fr_1fr_1fr_120px_140px_36px]"
                    : "grid-cols-[1fr_1fr_1fr_140px_36px]"
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground">Nama Lengkap</span>
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <span className="text-xs font-medium text-muted-foreground">Role</span>
                {hasJKCol && (
                  <span className="text-xs font-medium text-muted-foreground">L/P</span>
                )}
                {hasExtraCol && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {hasSiswaRow && hasGuruRow ? "Kelas / NIP" : hasSiswaRow ? "Kelas" : "NIP"}
                  </span>
                )}
                <span />
              </div>

              <div className="space-y-2">
                {bulkRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className={`grid gap-2 items-center ${
                      hasJKCol && hasExtraCol
                        ? "grid-cols-[1fr_1fr_1fr_110px_110px_140px_36px]"
                        : hasExtraCol
                        ? "grid-cols-[1fr_1fr_1fr_120px_140px_36px]"
                        : "grid-cols-[1fr_1fr_1fr_140px_36px]"
                    }`}
                  >
                    <Input
                      placeholder="Nama lengkap"
                      value={row.full_name}
                      onChange={(e) => updateRow(row.id, "full_name", e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="email@contoh.com"
                      value={row.email}
                      onChange={(e) => updateRow(row.id, "email", e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder="Password"
                      value={row.password}
                      onChange={(e) => updateRow(row.id, "password", e.target.value)}
                    />
                    <Select
                      value={row.role}
                      onValueChange={(v) => updateRow(row.id, "role", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="siswa">Siswa</SelectItem>
                        <SelectItem value="guru">Guru</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasJKCol && (
                      row.role === "siswa" ? (
                        <Select
                          value={row.jenis_kelamin || "__none__"}
                          onValueChange={(v) => updateRow(row.id, "jenis_kelamin", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="L/P" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Pilih...</SelectItem>
                            <SelectItem value="L">Laki-laki</SelectItem>
                            <SelectItem value="P">Perempuan</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span />
                      )
                    )}
                    {hasExtraCol && (
                      row.role === "siswa" ? (
                        <Select
                          value={row.kelas_id || "__none__"}
                          onValueChange={(v) => updateRow(row.id, "kelas_id", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih kelas..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Pilih kelas...</SelectItem>
                            {(kelasList || []).map((k) => (
                              <SelectItem key={k.id} value={String(k.id)}>
                                {k.nama_kelas}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="NIP (opsional)"
                          value={row.nip}
                          onChange={(e) => updateRow(row.id, "nip", e.target.value)}
                        />
                      )
                    )}
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
                <Button onClick={handleBulkSubmit} disabled={bulkMutation.isPending}>
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
              Yakin ingin menghapus akun <strong>{deleteTarget?.name}</strong>?
              Pengguna ini tidak akan bisa login lagi, dan data siswa yang terhubung
              juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
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

      {/* Link Akun ke Data Siswa dialog */}
      <Dialog
        open={!!linkTarget}
        onOpenChange={(open) => {
          if (!open) {
            setLinkTarget(null);
            setSiswaSearch("");
            setSelectedSiswaId("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl p-0 gap-0 max-h-[85dvh] flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-base">Hubungkan Akun ke Data Siswa</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Akun: <strong>{linkTarget?.full_name}</strong>
            </p>
          </DialogHeader>

          <div className="px-4 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Cari nama siswa..."
                value={siswaSearch}
                onChange={(e) => setSiswaSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1 [scrollbar-width:thin]">
            {(() => {
              const filtered = (siswaList?.data ?? []).filter((s) =>
                s.nama.toLowerCase().includes(siswaSearch.toLowerCase())
              );
              if (!filtered.length) {
                return (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {siswaSearch ? "Siswa tidak ditemukan" : "Belum ada data siswa"}
                  </div>
                );
              }
              return filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSiswaId(s.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors border ${
                    selectedSiswaId === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium">{s.nama}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.kelas?.nama ? (
                      <span className="text-emerald-600">{s.kelas.nama}</span>
                    ) : (
                      <span className="text-muted-foreground/60">Belum ada kelas</span>
                    )}
                    {s.nis && <span className="ml-2">· NIS: {s.nis}</span>}
                  </div>
                </button>
              ));
            })()}
          </div>

          <DialogFooter className="px-4 py-3 border-t shrink-0 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setLinkTarget(null);
                setSiswaSearch("");
                setSelectedSiswaId("");
              }}
            >
              Batal
            </Button>
            <Button
              className="flex-1 gap-1.5"
              disabled={!selectedSiswaId || isLinking}
              onClick={handleLinkSiswa}
            >
              <Link2 className="h-4 w-4" />
              {isLinking ? "Menghubungkan..." : "Hubungkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
