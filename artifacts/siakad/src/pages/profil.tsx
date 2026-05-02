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

function InfoTile({
  icon: Icon,
  label,
  value,
  wide = false,
  accent = false,
}: {
  icon: any;
  label: string;
  value?: string;
  wide?: boolean;
  accent?: boolean;
}) {
  const empty = !value || value === "" || value === "2000-01-01";
  return (
    <div
      className={`rounded-xl border bg-card p-3.5 flex flex-col gap-2.5 transition-colors hover:bg-muted/40 ${
        wide ? "col-span-2" : ""
      } ${accent ? "border-primary/20 bg-primary/5 hover:bg-primary/10" : ""}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
            accent ? "bg-primary/15" : "bg-muted"
          }`}
        >
          <Icon
            className={`h-3 w-3 ${accent ? "text-primary" : "text-muted-foreground"}`}
          />
        </div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-none">
          {label}
        </p>
      </div>
      <p
        className={`text-sm font-semibold leading-snug ${
          empty
            ? "text-muted-foreground/50 italic font-normal"
            : accent
            ? "text-primary"
            : "text-foreground"
        }`}
      >
        {empty ? "Belum diisi" : value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-2.5">{children}</div>
      </CardContent>
    </Card>
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
      return new Date(d).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const ttl =
    siswa?.tempat_lahir || (siswa?.tanggal_lahir && siswa.tanggal_lahir !== "2000-01-01")
      ? [siswa?.tempat_lahir, formatDate(siswa?.tanggal_lahir)].filter(Boolean).join(", ")
      : undefined;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header card */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-white text-xl font-bold shadow-sm"
              style={{ background: "hsl(231,59%,26%)" }}
            >
              {(user?.full_name || "?")
                .split(" ")
                .slice(0, 2)
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg text-foreground truncate leading-tight">
                {user?.full_name}
              </p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {user?.role === "siswa" ? "Siswa" : user?.role === "guru" ? "Guru" : "Admin"}
                </Badge>
                {siswa?.kelas?.nama_kelas && (
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {siswa.kelas.nama_kelas}
                  </Badge>
                )}
                {user?.role === "siswa" && (
                  complete ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Profil lengkap
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" /> Profil belum lengkap
                    </span>
                  )
                )}
              </div>
            </div>
            {user?.role === "siswa" && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setLocation("/profil/edit")}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {user?.role === "siswa" && (
        <>
          {/* Data Pribadi — bento grid */}
          <SectionCard title="Data Pribadi">
            <InfoTile icon={Hash} label="NIS" value={siswa?.nis} accent />
            <InfoTile icon={CreditCard} label="NISN" value={siswa?.nisn} accent />
            <InfoTile
              icon={User}
              label="Jenis Kelamin"
              value={
                siswa?.jenis_kelamin === "L"
                  ? "Laki-laki"
                  : siswa?.jenis_kelamin === "P"
                  ? "Perempuan"
                  : ""
              }
            />
            <InfoTile icon={Heart} label="Agama" value={siswa?.agama} />
            <InfoTile icon={Droplets} label="Golongan Darah" value={siswa?.golongan_darah} />
            <InfoTile icon={Phone} label="No. HP Siswa" value={siswa?.no_hp_siswa} />
            <InfoTile icon={Calendar} label="Tempat, Tanggal Lahir" value={ttl} wide />
            <InfoTile icon={MapPin} label="Alamat" value={siswa?.alamat} wide />
          </SectionCard>

          {/* Data Orang Tua — bento grid */}
          <SectionCard title="Data Orang Tua / Wali">
            <InfoTile icon={Users} label="Nama Ayah" value={siswa?.nama_ayah} />
            <InfoTile icon={Briefcase} label="Pekerjaan Ayah" value={siswa?.pekerjaan_ayah} />
            <InfoTile icon={Users} label="Nama Ibu" value={siswa?.nama_ibu} />
            <InfoTile icon={Briefcase} label="Pekerjaan Ibu" value={siswa?.pekerjaan_ibu} />
            <InfoTile icon={Phone} label="No. HP Orang Tua" value={siswa?.no_hp_ortu} wide />
          </SectionCard>
        </>
      )}
    </div>
  );
}
