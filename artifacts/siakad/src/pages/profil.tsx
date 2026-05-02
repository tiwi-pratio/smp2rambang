import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { User, BookOpen, MapPin, Phone, Calendar, CreditCard, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function getToken() {
  return localStorage.getItem("siakad_token") || "";
}

async function fetchMySiswa() {
  const res = await fetch(`/api/auth/me/siswa`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Gagal memuat data profil");
  return res.json();
}

async function updateMySiswa(body: Record<string, string>) {
  const res = await fetch(`/api/auth/me/siswa`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Gagal menyimpan perubahan");
  }
  return res.json();
}

function isProfileComplete(data: any) {
  return (
    data?.nisn && data.nisn !== "" &&
    data?.tanggal_lahir && data.tanggal_lahir !== "2000-01-01" &&
    data?.alamat && data.alamat !== "" &&
    data?.no_hp_ortu && data.no_hp_ortu !== ""
  );
}

export default function ProfilPage() {
  const { data: user } = useGetMe();
  const { toast } = useToast();

  const [siswa, setSiswa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nisn: "",
    tanggal_lahir: "",
    alamat: "",
    no_hp_ortu: "",
  });

  useEffect(() => {
    fetchMySiswa()
      .then((data) => {
        setSiswa(data);
        setForm({
          nisn: data.nisn || "",
          tanggal_lahir: data.tanggal_lahir === "2000-01-01" ? "" : (data.tanggal_lahir || ""),
          alamat: data.alamat || "",
          no_hp_ortu: data.no_hp_ortu || "",
        });
      })
      .catch(() => toast({ title: "Gagal memuat data profil", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.nisn || !form.tanggal_lahir || !form.alamat || !form.no_hp_ortu) {
      toast({ title: "Semua field wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMySiswa(form);
      setSiswa(updated);
      sessionStorage.removeItem("profil_notif_shown");
      toast({ title: "Profil berhasil disimpan" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const complete = isProfileComplete({ ...siswa, ...form });

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Identity card */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-bold"
              style={{ background: "hsl(231,59%,26%)" }}
            >
              {(user?.full_name || "?").split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">Siswa</Badge>
                {siswa?.kelas?.nama_kelas && (
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {siswa.kelas.nama_kelas}
                  </Badge>
                )}
                {complete ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Profil lengkap
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                    ⚠ Profil belum lengkap
                  </span>
                )}
              </div>
            </div>
          </div>
          {siswa?.nis && (
            <div className="mt-3 pt-3 border-t flex gap-6 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">NIS</span><br />{siswa.nis || "-"}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable fields */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Data Pribadi
          </CardTitle>
          <CardDescription className="text-xs">
            Lengkapi data pribadimu. Informasi ini dibutuhkan oleh pihak sekolah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="nisn" className="text-sm flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> NISN
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nisn"
              placeholder="Nomor Induk Siswa Nasional"
              value={form.nisn}
              onChange={(e) => setForm({ ...form, nisn: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tanggal_lahir" className="text-sm flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Tanggal Lahir
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tanggal_lahir"
              type="date"
              value={form.tanggal_lahir}
              onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="alamat" className="text-sm flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Alamat
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="alamat"
              placeholder="Alamat tempat tinggal"
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="no_hp_ortu" className="text-sm flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> No. HP Orang Tua
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="no_hp_ortu"
              placeholder="08xxxxxxxxxx"
              value={form.no_hp_ortu}
              onChange={(e) => setForm({ ...form, no_hp_ortu: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Simpan Perubahan</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
