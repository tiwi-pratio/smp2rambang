import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMySiswa, updateMySiswa } from "@/lib/profil-api";

const AGAMA_OPTIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];
const GOLDAR_OPTIONS = ["A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ProfilEditPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nisn: "",
    tempat_lahir: "",
    tanggal_lahir: "",
    agama: "",
    golongan_darah: "",
    alamat: "",
    no_hp_siswa: "",
    no_hp_ortu: "",
    nama_ayah: "",
    pekerjaan_ayah: "",
    nama_ibu: "",
    pekerjaan_ibu: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    fetchMySiswa()
      .then((data) => {
        setForm({
          nisn: data.nisn || "",
          tempat_lahir: data.tempat_lahir || "",
          tanggal_lahir: data.tanggal_lahir === "2000-01-01" ? "" : (data.tanggal_lahir || ""),
          agama: data.agama || "",
          golongan_darah: data.golongan_darah || "",
          alamat: data.alamat || "",
          no_hp_siswa: data.no_hp_siswa || "",
          no_hp_ortu: data.no_hp_ortu || "",
          nama_ayah: data.nama_ayah || "",
          pekerjaan_ayah: data.pekerjaan_ayah || "",
          nama_ibu: data.nama_ibu || "",
          pekerjaan_ibu: data.pekerjaan_ibu || "",
        });
      })
      .catch(() => toast({ title: "Gagal memuat data", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.nisn || !form.tanggal_lahir || !form.tempat_lahir || !form.agama || !form.alamat || !form.no_hp_ortu) {
      toast({ title: "Lengkapi semua field yang wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateMySiswa(form);
      sessionStorage.removeItem("profil_notif_shown");
      toast({ title: "Profil berhasil disimpan" });
      setLocation("/profil");
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLocation("/profil")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-base font-semibold">Edit Profil</h2>
          <p className="text-xs text-muted-foreground">Lengkapi data pribadimu</p>
        </div>
        <Button className="ml-auto gap-1.5" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      {/* Data Pribadi */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Data Pribadi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="NISN" required>
            <Input className="h-9 text-sm" placeholder="Nomor Induk Siswa Nasional (10 digit)" value={form.nisn} onChange={set("nisn")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tempat Lahir" required>
              <Input className="h-9 text-sm" placeholder="Kota / Kabupaten" value={form.tempat_lahir} onChange={set("tempat_lahir")} />
            </Field>
            <Field label="Tanggal Lahir" required>
              <Input className="h-9 text-sm" type="date" value={form.tanggal_lahir} onChange={set("tanggal_lahir")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Agama" required>
              <Select value={form.agama} onValueChange={(v) => setForm((f) => ({ ...f, agama: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pilih agama..." />
                </SelectTrigger>
                <SelectContent>
                  {AGAMA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Golongan Darah">
              <Select value={form.golongan_darah} onValueChange={(v) => setForm((f) => ({ ...f, golongan_darah: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pilih golongan darah..." />
                </SelectTrigger>
                <SelectContent>
                  {GOLDAR_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Alamat Lengkap" required>
            <Input className="h-9 text-sm" placeholder="Jalan, Desa/Kelurahan, Kecamatan" value={form.alamat} onChange={set("alamat")} />
          </Field>

          <Field label="No. HP Siswa">
            <Input className="h-9 text-sm" placeholder="08xxxxxxxxxx" value={form.no_hp_siswa} onChange={set("no_hp_siswa")} />
          </Field>
        </CardContent>
      </Card>

      {/* Data Orang Tua */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Data Orang Tua / Wali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nama Ayah">
              <Input className="h-9 text-sm" placeholder="Nama lengkap ayah" value={form.nama_ayah} onChange={set("nama_ayah")} />
            </Field>
            <Field label="Pekerjaan Ayah">
              <Input className="h-9 text-sm" placeholder="Pekerjaan ayah" value={form.pekerjaan_ayah} onChange={set("pekerjaan_ayah")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nama Ibu">
              <Input className="h-9 text-sm" placeholder="Nama lengkap ibu" value={form.nama_ibu} onChange={set("nama_ibu")} />
            </Field>
            <Field label="Pekerjaan Ibu">
              <Input className="h-9 text-sm" placeholder="Pekerjaan ibu" value={form.pekerjaan_ibu} onChange={set("pekerjaan_ibu")} />
            </Field>
          </div>

          <Field label="No. HP Orang Tua" required>
            <Input className="h-9 text-sm" placeholder="08xxxxxxxxxx" value={form.no_hp_ortu} onChange={set("no_hp_ortu")} />
          </Field>
        </CardContent>
      </Card>

      <div className="pb-4">
        <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </div>
  );
}
