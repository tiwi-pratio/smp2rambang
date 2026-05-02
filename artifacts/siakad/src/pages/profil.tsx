import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import {
  User, BookOpen, MapPin, Phone, Calendar, CreditCard,
  Pencil, CheckCircle2, AlertTriangle, Droplets, Heart,
  Users, Briefcase, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { fetchMySiswa } from "@/lib/profil-api";

function isProfileComplete(data: any) {
  return (
    data?.nisn && data.nisn !== "" &&
    data?.tanggal_lahir && data.tanggal_lahir !== "2000-01-01" &&
    data?.tempat_lahir && data.tempat_lahir !== "" &&
    data?.agama && data.agama !== "" &&
    data?.alamat && data.alamat !== "" &&
    data?.no_hp_ortu && data.no_hp_ortu !== ""
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  const empty = !value || value === "" || value === "2000-01-01";
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className={`text-sm font-medium ${empty ? "text-muted-foreground italic" : "text-foreground"}`}>
          {empty ? "Belum diisi" : value}
        </p>
      </div>
    </div>
  );
}

export default function ProfilPage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [siswa, setSiswa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (user?.role !== "siswa") {
      setLoading(false);
      return;
    }
    fetchMySiswa()
      .then(setSiswa)
      .catch(() => toast({ title: "Gagal memuat data profil", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  const complete = isProfileComplete(siswa);

  const formatDate = (d?: string) => {
    if (!d || d === "2000-01-01") return "";
    try {
      return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch { return d; }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header card */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-bold"
              style={{ background: "hsl(231,59%,26%)" }}
            >
              {(user?.full_name || "?").split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg text-foreground truncate">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
                    <AlertTriangle className="h-3.5 w-3.5" /> Profil belum lengkap
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setLocation("/profil/edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Pribadi */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Data Pribadi
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <InfoRow icon={Hash} label="NIS" value={siswa?.nis} />
          <Separator />
          <InfoRow icon={CreditCard} label="NISN" value={siswa?.nisn} />
          <Separator />
          <InfoRow icon={Calendar} label="Tempat, Tanggal Lahir"
            value={
              siswa?.tempat_lahir || (siswa?.tanggal_lahir && siswa.tanggal_lahir !== "2000-01-01")
                ? [siswa?.tempat_lahir, formatDate(siswa?.tanggal_lahir)].filter(Boolean).join(", ")
                : undefined
            }
          />
          <Separator />
          <InfoRow icon={User} label="Jenis Kelamin"
            value={siswa?.jenis_kelamin === "L" ? "Laki-laki" : siswa?.jenis_kelamin === "P" ? "Perempuan" : ""}
          />
          <Separator />
          <InfoRow icon={Heart} label="Agama" value={siswa?.agama} />
          <Separator />
          <InfoRow icon={Droplets} label="Golongan Darah" value={siswa?.golongan_darah} />
          <Separator />
          <InfoRow icon={MapPin} label="Alamat" value={siswa?.alamat} />
          <Separator />
          <InfoRow icon={Phone} label="No. HP Siswa" value={siswa?.no_hp_siswa} />
        </CardContent>
      </Card>

      {/* Data Orang Tua */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Data Orang Tua / Wali
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <InfoRow icon={Users} label="Nama Ayah" value={siswa?.nama_ayah} />
          <Separator />
          <InfoRow icon={Briefcase} label="Pekerjaan Ayah" value={siswa?.pekerjaan_ayah} />
          <Separator />
          <InfoRow icon={Users} label="Nama Ibu" value={siswa?.nama_ibu} />
          <Separator />
          <InfoRow icon={Briefcase} label="Pekerjaan Ibu" value={siswa?.pekerjaan_ibu} />
          <Separator />
          <InfoRow icon={Phone} label="No. HP Orang Tua" value={siswa?.no_hp_ortu} />
        </CardContent>
      </Card>
    </div>
  );
}
