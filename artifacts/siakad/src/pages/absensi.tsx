import { useState, useMemo, useEffect, useRef } from "react";
import { 
  useGetMe,
  useListAbsensi,
  useListKelas,
  useListMataPelajaran,
  useListSiswa,
  useCreateAbsensi,
  useGetRekapAbsensi,
  getListAbsensiQueryKey,
  getGetRekapAbsensiQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Save, Search, QrCode, Users, CheckCircle2, X, Clock, RefreshCw, Camera } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AbsensiPage() {
  const { data: user } = useGetMe();
  const isSiswa = user?.role === "siswa";
  const isAdmin = user?.role === "admin";

  if (isSiswa) return <SiswaAbsensi />;
  return <GuruAdminAbsensi isAdmin={isAdmin ?? false} />;
}

// ─── GURU / ADMIN ────────────────────────────────────────────────────────────

function GuruAdminAbsensi({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-2 rounded-lg">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Absensi</h1>
      </div>

      <Tabs defaultValue={isAdmin ? "manual" : "qr"}>
        <TabsList className="rounded-xl">
          {!isAdmin && <TabsTrigger value="qr" className="gap-2"><QrCode className="h-4 w-4" />Absensi QR</TabsTrigger>}
          <TabsTrigger value="manual" className="gap-2"><ClipboardCheck className="h-4 w-4" />{isAdmin ? "Data Absensi" : "Input Manual"}</TabsTrigger>
        </TabsList>

        {!isAdmin && (
          <TabsContent value="qr" className="mt-4">
            <AbsensiQR />
          </TabsContent>
        )}

        <TabsContent value="manual" className="mt-4">
          <AbsensiManual isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── ABSENSI QR (GURU) ────────────────────────────────────────────────────────

interface SesiData {
  token: string;
  kelas_id: number;
  mata_pelajaran_id: number;
  tanggal: string;
  expires_at: number;
  total_siswa: number;
  jumlah_hadir: number;
  siswa_hadir: { id: number; nama: string; nis: string }[];
  is_expired: boolean;
}

interface JadwalAktif {
  id: number;
  kelas_id: number;
  mata_pelajaran_id: number;
  guru_id: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  kelas: { id: number; nama_kelas: string } | null;
  mata_pelajaran: { id: number; nama_mapel: string } | null;
}

function AbsensiQR() {
  const { toast } = useToast();
  const { data: kelasData } = useListKelas();
  const { data: mapelData } = useListMataPelajaran();

  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [durasi, setDurasi] = useState("30");
  const [sesi, setSesi] = useState<SesiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [jadwalAktif, setJadwalAktif] = useState<JadwalAktif[]>([]);
  const [jamSekarang, setJamSekarang] = useState("");
  const [loadingJadwal, setLoadingJadwal] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authToken = localStorage.getItem("siakad_token") ?? "";
  const scanUrl = sesi ? `${window.location.origin}/absensi/scan?token=${sesi.token}` : "";
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };

  // Fetch jadwal aktif saat ini
  useEffect(() => {
    const fetchJadwalAktif = async () => {
      setLoadingJadwal(true);
      try {
        const res = await fetch("/api/jadwal/aktif", { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setJadwalAktif(data.jadwal || []);
          setJamSekarang(data.jam || "");
        }
      } catch {}
      setLoadingJadwal(false);
    };
    fetchJadwalAktif();
  }, []);

  const fetchSesi = async (token: string) => {
    const res = await fetch(`/api/absensi/sesi/${token}`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setSesi(data);
      if (data.is_expired) stopPolling();
    }
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => stopPolling(), []);

  const handleBukaSesi = async (kelasId?: string, mapelId?: string) => {
    const k = kelasId ?? selectedKelas;
    const m = mapelId ?? selectedMapel;
    if (!k || !m) {
      toast({ variant: "destructive", title: "Pilih kelas dan mata pelajaran terlebih dahulu" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/absensi/sesi", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ kelas_id: Number(k), mata_pelajaran_id: Number(m), durasi_menit: Number(durasi) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const statusRes = await fetch(`/api/absensi/sesi/${data.token}`, { headers: authHeaders });
      const statusData = await statusRes.json();
      setSesi(statusData);

      setTimeLeft(Math.floor((data.expires_at - Date.now()) / 1000));
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { stopPolling(); return 0; }
          return prev - 1;
        });
      }, 1000);
      pollRef.current = setInterval(() => fetchSesi(data.token), 5000);

      toast({ title: "Sesi absensi QR berhasil dibuka!" });
    } catch {
      toast({ variant: "destructive", title: "Gagal membuka sesi" });
    } finally {
      setLoading(false);
    }
  };

  const handleTutupSesi = async () => {
    if (!sesi) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/absensi/sesi/${sesi.token}`, { method: "DELETE", headers: authHeaders });
      const data = await res.json();
      stopPolling();
      setSesi(null);
      setTimeLeft(0);
      toast({ title: `Sesi ditutup. ${data.jumlah_hadir} hadir, ${data.jumlah_alfa} alfa.` });
    } catch {
      toast({ variant: "destructive", title: "Gagal menutup sesi" });
    } finally {
      setClosing(false);
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (!sesi) {
    return (
      <div className="space-y-4">
        {/* ── Jadwal Aktif Sekarang ── */}
        {loadingJadwal ? (
          <Card className="border shadow-none rounded-2xl">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : jadwalAktif.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Sedang Berlangsung · {jamSekarang} WIB</p>
            {jadwalAktif.map((j) => (
              <Card key={j.id} className="border-2 shadow-none rounded-2xl overflow-hidden" style={{ borderColor: "hsl(231,59%,26%,0.25)" }}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(231,59%,26%)" }}>
                      <QrCode className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{j.mata_pelajaran?.nama_mapel ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">{j.kelas?.nama_kelas ?? "—"} · {j.jam_mulai}–{j.jam_selesai}</p>
                    </div>
                    <Button
                      className="rounded-xl gap-2 shrink-0"
                      onClick={() => handleBukaSesi(String(j.kelas_id), String(j.mata_pelajaran_id))}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      Buka Absensi
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border shadow-none rounded-2xl bg-muted/40">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 shrink-0" />
                <p className="text-sm">Tidak ada jadwal mengajar yang aktif sekarang ({jamSekarang} WIB).</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Pilih Manual ── */}
        <Card className="border shadow-none rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">Atau pilih manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kelas</label>
                <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectContent>{kelasData?.map(k => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mata Pelajaran</label>
                <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                  <SelectContent>{mapelData?.map(m => <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Durasi (menit)</label>
                <Select value={durasi} onValueChange={setDurasi}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 menit</SelectItem>
                    <SelectItem value="15">15 menit</SelectItem>
                    <SelectItem value="30">30 menit</SelectItem>
                    <SelectItem value="60">60 menit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => handleBukaSesi()} disabled={loading || !selectedKelas || !selectedMapel} className="rounded-xl gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Buka Sesi Absensi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = sesi.is_expired || timeLeft === 0;
  const pct = sesi.total_siswa > 0 ? Math.round((sesi.jumlah_hadir / sesi.total_siswa) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* QR Panel */}
      <Card className="lg:col-span-2 border shadow-none rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">QR Absensi</CardTitle>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isExpired ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isExpired ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
              {isExpired ? "Berakhir" : "Aktif"}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {kelasData?.find(k => k.id === String(sesi.kelas_id))?.nama_kelas} · {mapelData?.find(m => m.id === String(sesi.mata_pelajaran_id))?.nama_mapel}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className={`p-3 rounded-2xl border-2 ${isExpired ? "border-red-200 opacity-40" : "border-border"}`}>
            <QRCodeSVG value={scanUrl} size={180} level="M" />
          </div>

          {!isExpired && (
            <div className="flex items-center gap-2 text-sm font-mono font-bold" style={{ color: timeLeft < 60 ? "hsl(0,84%,60%)" : "hsl(231,59%,26%)" }}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
          )}

          {isExpired && (
            <p className="text-sm text-red-500 font-medium">Sesi telah berakhir</p>
          )}

          <Button
            variant="destructive"
            className="w-full rounded-xl gap-2"
            onClick={handleTutupSesi}
            disabled={closing}
          >
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Tutup Sesi & Simpan
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Siswa yang belum scan akan dicatat <strong>alfa</strong> saat sesi ditutup
          </p>
        </CardContent>
      </Card>

      {/* Monitor Panel */}
      <Card className="lg:col-span-3 border shadow-none rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Monitor Kehadiran</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Update otomatis setiap 5 detik</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: "hsl(231,59%,26%)" }}>{sesi.jumlah_hadir}<span className="text-sm font-normal text-muted-foreground">/{sesi.total_siswa}</span></p>
              <p className="text-xs text-muted-foreground">siswa hadir</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(231,59%,26%), hsl(213,39%,47%))" }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {sesi.siswa_hadir.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Menunggu siswa scan QR...</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {sesi.siswa_hadir.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.nama}</p>
                    <p className="text-xs text-muted-foreground">{s.nis}</p>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold shrink-0">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── INPUT MANUAL ────────────────────────────────────────────────────────────

function AbsensiManual({ isAdmin }: { isAdmin: boolean }) {
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedMapel, setSelectedMapel] = useState<string>("");
  const [tanggal, setTanggal] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kelasData } = useListKelas();
  const { data: mapelData } = useListMataPelajaran();

  const { data: siswaData, isLoading: isLoadingSiswa } = useListSiswa(
    { kelas_id: selectedKelas, limit: 100 },
    { query: { enabled: !!selectedKelas } }
  );

  const { data: absensiData, isLoading: isLoadingAbsensi } = useListAbsensi(
    { kelas_id: selectedKelas, mata_pelajaran_id: selectedMapel, tanggal },
    { query: { enabled: !!(selectedKelas && selectedMapel && tanggal) } }
  );

  const createMutation = useCreateAbsensi();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: "hadir" | "izin" | "sakit" | "alfa"; keterangan: string }>>({});

  useMemo(() => {
    if (absensiData?.length && siswaData?.data?.length) {
      const map: Record<string, any> = {};
      siswaData.data.forEach((siswa) => {
        const existing = absensiData.find((a) => a.siswa_id === siswa.id);
        if (existing) map[siswa.id] = { status: existing.status, keterangan: existing.keterangan || "" };
      });
      setAttendanceMap(map);
    } else {
      setAttendanceMap({});
    }
  }, [absensiData, siswaData]);

  const handleStatusChange = (siswaId: string, status: any) => {
    setAttendanceMap((prev) => ({ ...prev, [siswaId]: { status, keterangan: prev[siswaId]?.keterangan || "" } }));
  };

  const handleKeteranganChange = (siswaId: string, keterangan: string) => {
    setAttendanceMap((prev) => ({ ...prev, [siswaId]: { status: prev[siswaId]?.status || "hadir", keterangan } }));
  };

  const handleSave = () => {
    if (!siswaData?.data) return;
    const records = siswaData.data.map((siswa) => {
      const entry = attendanceMap[siswa.id] || { status: "hadir", keterangan: "" };
      return { siswa_id: siswa.id, mata_pelajaran_id: selectedMapel, tanggal, status: entry.status as any, keterangan: entry.keterangan };
    });
    createMutation.mutate(
      { data: { records } },
      {
        onSuccess: () => {
          toast({ title: "Data absensi berhasil disimpan" });
          queryClient.invalidateQueries({ queryKey: getListAbsensiQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal menyimpan absensi", description: err?.data?.message || "Terjadi kesalahan." });
        },
      }
    );
  };

  const canSave = !isAdmin && selectedKelas && selectedMapel && tanggal && siswaData?.data?.length;

  return (
    <div className="space-y-4">
      <Card className="border shadow-none rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tanggal</label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Kelas</label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                <SelectContent>{kelasData?.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mata Pelajaran</label>
              <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                <SelectContent>{mapelData?.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedKelas && selectedMapel ? (
        <Card className="border shadow-none rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Daftar Siswa</CardTitle>
            {canSave && (
              <Button onClick={handleSave} disabled={createMutation.isPending} className="rounded-xl gap-2">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSiswa || isLoadingAbsensi ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {[1,2,3,4,5].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                      </TableRow>
                    ))
                  ) : !siswaData?.data?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada siswa di kelas ini</TableCell>
                    </TableRow>
                  ) : (
                    siswaData.data.map((siswa, idx) => {
                      const entry = attendanceMap[siswa.id] || { status: isAdmin && absensiData?.length ? undefined : "hadir", keterangan: "" };
                      return (
                        <TableRow key={siswa.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium text-muted-foreground">{siswa.nis}</TableCell>
                          <TableCell className="font-medium">{siswa.nama}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              entry.status ? (
                                <Badge variant={entry.status === "hadir" ? "default" : entry.status === "izin" ? "outline" : entry.status === "sakit" ? "secondary" : "destructive"}>
                                  {entry.status.toUpperCase()}
                                </Badge>
                              ) : <span className="text-muted-foreground text-sm">-</span>
                            ) : (
                              <Select value={entry.status} onValueChange={(val) => handleStatusChange(siswa.id, val)}>
                                <SelectTrigger className="w-[120px] rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hadir">Hadir</SelectItem>
                                  <SelectItem value="izin">Izin</SelectItem>
                                  <SelectItem value="sakit">Sakit</SelectItem>
                                  <SelectItem value="alfa">Alfa</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <span className="text-sm">{entry.keterangan || "-"}</span>
                            ) : (
                              <Input
                                placeholder="Keterangan opsional..."
                                value={entry.keterangan}
                                onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
                                disabled={entry.status === "hadir"}
                                className="rounded-lg"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border shadow-none rounded-2xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Pilih Kelas dan Mata Pelajaran</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">Silakan pilih kelas, mata pelajaran, dan tanggal untuk melihat atau mengisi daftar hadir siswa.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── SISWA ───────────────────────────────────────────────────────────────────

type ScanStatus = "idle" | "scanning" | "loading" | "success" | "already" | "expired" | "error";

function QRScannerPanel() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanMessage, setScanMessage] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  const startScan = async () => {
    setScanStatus("scanning");
    setScanMessage("");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    isScanningRef.current = true;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (!isScanningRef.current) return;
          isScanningRef.current = false;

          try {
            await scanner.stop();
          } catch (_) {}

          setScanStatus("loading");

          try {
            const url = new URL(decodedText);
            const token = url.searchParams.get("token");
            if (!token) {
              setScanStatus("error");
              setScanMessage("QR code tidak valid.");
              return;
            }

            const authToken = localStorage.getItem("siakad_token");
            const res = await fetch("/api/absensi/scan", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ token }),
            });
            const data = await res.json();

            if (res.status === 410) {
              setScanStatus("expired");
              setScanMessage("Sesi absensi sudah berakhir. Minta guru untuk membuka sesi baru.");
            } else if (!res.ok) {
              setScanStatus("error");
              setScanMessage(data.message || "Terjadi kesalahan.");
            } else {
              setScanStatus(data.already ? "already" : "success");
              setScanMessage(data.message);
            }
          } catch {
            setScanStatus("error");
            setScanMessage("Gagal terhubung ke server.");
          }
        },
        () => {}
      );
    } catch {
      setScanStatus("error");
      setScanMessage("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
    }
  };

  const stopScan = async () => {
    isScanningRef.current = false;
    try { await scannerRef.current?.stop(); } catch (_) {}
    setScanStatus("idle");
  };

  useEffect(() => {
    return () => {
      isScanningRef.current = false;
      try { scannerRef.current?.stop(); } catch (_) {}
    };
  }, []);

  return (
    <Card className="border shadow-none rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          Scan QR Absensi
        </CardTitle>
        <CardDescription>Arahkan kamera ke QR code yang ditampilkan guru</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR reader container — always in DOM so html5-qrcode can mount */}
        <div
          id="qr-reader"
          className={`w-full rounded-xl overflow-hidden bg-muted ${scanStatus === "scanning" ? "block" : "hidden"}`}
          style={{ minHeight: 280 }}
        />

        {scanStatus === "idle" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "hsl(231,59%,26%,0.08)" }}>
              <QrCode className="h-10 w-10" style={{ color: "hsl(231,59%,26%)" }} />
            </div>
            <p className="text-sm text-muted-foreground text-center">Tekan tombol di bawah untuk membuka kamera dan scan QR absensi</p>
            <Button className="rounded-xl gap-2 w-full max-w-xs" onClick={startScan}>
              <Camera className="h-4 w-4" />
              Buka Kamera & Scan
            </Button>
          </div>
        )}

        {scanStatus === "scanning" && (
          <Button variant="outline" className="rounded-xl gap-2 w-full" onClick={stopScan}>
            <X className="h-4 w-4" />
            Tutup Kamera
          </Button>
        )}

        {scanStatus === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memproses absensi...</p>
          </div>
        )}

        {scanStatus === "success" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-emerald-600">Berhasil Hadir!</p>
            <p className="text-sm text-muted-foreground text-center">{scanMessage}</p>
            <Button variant="outline" className="rounded-xl gap-2 w-full max-w-xs" onClick={() => { setScanStatus("idle"); setScanMessage(""); }}>
              <QrCode className="h-4 w-4" />
              Scan Lagi
            </Button>
          </div>
        )}

        {scanStatus === "already" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-blue-500" />
            </div>
            <p className="text-lg font-bold text-blue-600">Sudah Tercatat</p>
            <p className="text-sm text-muted-foreground text-center">{scanMessage}</p>
            <Button variant="outline" className="rounded-xl gap-2 w-full max-w-xs" onClick={() => { setScanStatus("idle"); setScanMessage(""); }}>
              <QrCode className="h-4 w-4" />
              Scan Lagi
            </Button>
          </div>
        )}

        {scanStatus === "expired" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="h-9 w-9 text-orange-500" />
            </div>
            <p className="text-lg font-bold text-orange-600">Sesi Berakhir</p>
            <p className="text-sm text-muted-foreground text-center">{scanMessage}</p>
            <Button variant="outline" className="rounded-xl gap-2 w-full max-w-xs" onClick={() => { setScanStatus("idle"); setScanMessage(""); }}>
              <QrCode className="h-4 w-4" />
              Scan Lagi
            </Button>
          </div>
        )}

        {scanStatus === "error" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <X className="h-9 w-9 text-red-500" />
            </div>
            <p className="text-lg font-bold text-red-600">Gagal</p>
            <p className="text-sm text-muted-foreground text-center">{scanMessage}</p>
            <Button variant="outline" className="rounded-xl gap-2 w-full max-w-xs" onClick={() => { setScanStatus("idle"); setScanMessage(""); }}>
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SiswaAbsensi() {
  const [bulan, setBulan] = useState<string>(format(new Date(), "yyyy-MM"));

  const { data: rekapData, isLoading } = useGetRekapAbsensi(
    { bulan },
    { query: { enabled: !!bulan, queryKey: getGetRekapAbsensiQueryKey({ bulan }) } }
  );

  const rekap = rekapData?.siswa?.[0]?.rekap;
  const total = rekap ? rekap.hadir + rekap.izin + rekap.sakit + rekap.alfa : 0;
  const pct = total > 0 ? Math.round(((rekap?.hadir ?? 0) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-2 rounded-lg">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Absensi Saya</h1>
      </div>

      <QRScannerPanel />

      <Card className="border shadow-none rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rekap Kehadiran</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="max-w-[200px] rounded-xl" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Hadir", key: "hadir", color: "text-emerald-600" },
          { label: "Izin", key: "izin", color: "text-blue-600" },
          { label: "Sakit", key: "sakit", color: "text-orange-600" },
          { label: "Alfa", key: "alfa", color: "text-red-600" },
        ].map(({ label, key, color }) => (
          <Card key={key} className="border shadow-none rounded-2xl">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className={`text-3xl font-bold ${color}`}>{(rekap as any)?.[key] ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && total > 0 && (
        <Card className="border shadow-none rounded-2xl">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Tingkat Kehadiran</p>
              <p className="text-sm font-bold" style={{ color: "hsl(231,59%,26%)" }}>{pct}%</p>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(231,59%,26%), hsl(213,39%,47%))" }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{rekap?.hadir ?? 0} hadir dari {total} pertemuan</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
