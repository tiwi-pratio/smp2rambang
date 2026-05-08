import { useState } from "react";
import { useGetMe, useListKelas } from "@workspace/api-client-react";
import { BarChart2, BookOpen, ChevronRight, ArrowLeft, Loader2, Users, CheckCircle2, X, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MapelSummary {
  id: number;
  nama_mapel: string;
  kode_mapel: string;
  guru: { id: number; nama: string } | null;
  pertemuan: number;
  rata_hadir: number;
  total_siswa: number;
}

interface SiswaRekap {
  id: number;
  nama: string;
  nis: string;
  kehadiran: Record<string, string>;
  rekap: { hadir: number; izin: number; sakit: number; alfa: number };
  pct: number;
}

interface RekapMapelData {
  pertemuan: string[];
  siswa: SiswaRekap[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; short: string; bg: string; text: string }> = {
  hadir: { label: "Hadir", short: "H", bg: "bg-emerald-100", text: "text-emerald-700" },
  izin:  { label: "Izin",  short: "I", bg: "bg-blue-100",    text: "text-blue-700"    },
  sakit: { label: "Sakit", short: "S", bg: "bg-orange-100",  text: "text-orange-700"  },
  alfa:  { label: "Alfa",  short: "A", bg: "bg-red-100",     text: "text-red-700"     },
};

function StatusCell({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground/40 text-xs">–</span>;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-xs">{status}</span>;
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {cfg.short}
    </span>
  );
}

function formatTanggal(tanggal: string) {
  try {
    return format(parseISO(tanggal), "d/M", { locale: idLocale });
  } catch {
    return tanggal;
  }
}

function formatTanggalLong(tanggal: string) {
  try {
    return format(parseISO(tanggal), "EEE, d MMM", { locale: idLocale });
  } catch {
    return tanggal;
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RekapAbsensiPage() {
  const { data: user } = useGetMe();
  const { data: kelasData } = useListKelas();

  const [selectedKelas, setSelectedKelas] = useState("");
  const [bulan, setBulan] = useState(format(new Date(), "yyyy-MM"));
  const [mapelList, setMapelList] = useState<MapelSummary[]>([]);
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [selectedMapel, setSelectedMapel] = useState<MapelSummary | null>(null);
  const [rekapData, setRekapData] = useState<RekapMapelData | null>(null);
  const [loadingRekap, setLoadingRekap] = useState(false);

  const authToken = localStorage.getItem("siakad_token") ?? "";
  const authHeaders = { Authorization: `Bearer ${authToken}` };

  const fetchMapelList = async (kelasId: string, bln: string) => {
    setMapelList([]);
    setSelectedMapel(null);
    setRekapData(null);
    if (!kelasId || !bln) return;
    setLoadingMapel(true);
    try {
      const res = await fetch(`/api/absensi/mapel-list?kelas_id=${kelasId}&bulan=${bln}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setMapelList(data.mapel || []);
      }
    } catch {}
    setLoadingMapel(false);
  };

  const fetchRekap = async (mapel: MapelSummary) => {
    setSelectedMapel(mapel);
    setRekapData(null);
    setLoadingRekap(true);
    try {
      const res = await fetch(
        `/api/absensi/rekap-mapel?kelas_id=${selectedKelas}&mata_pelajaran_id=${mapel.id}&bulan=${bulan}`,
        { headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        setRekapData(data);
      }
    } catch {}
    setLoadingRekap(false);
  };

  const handleKelasChange = (val: string) => {
    setSelectedKelas(val);
    fetchMapelList(val, bulan);
  };

  const handleBulanChange = (val: string) => {
    setBulan(val);
    fetchMapelList(selectedKelas, val);
  };

  const kelasName = kelasData?.find(k => k.id === selectedKelas)?.nama_kelas ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-2 rounded-lg">
          <BarChart2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rekap Absensi</h1>
          <p className="text-sm text-muted-foreground">Rekap kehadiran per mata pelajaran</p>
        </div>
      </div>

      {/* Filter */}
      <Card className="border shadow-none rounded-2xl">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Kelas</label>
              <Select value={selectedKelas} onValueChange={handleKelasChange}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                <SelectContent>
                  {kelasData?.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bulan</label>
              <Input
                type="month"
                value={bulan}
                onChange={e => handleBulanChange(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {!selectedKelas ? (
        <Card className="border-dashed border shadow-none rounded-2xl">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <BarChart2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Pilih Kelas</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Pilih kelas dan bulan untuk melihat rekap absensi</p>
          </CardContent>
        </Card>
      ) : selectedMapel ? (
        /* ── Detail View: Tabel Pivot ── */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => { setSelectedMapel(null); setRekapData(null); }}
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{selectedMapel.nama_mapel}</h2>
                <Badge variant="outline" className="rounded-lg text-xs">{selectedMapel.kode_mapel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {kelasName} · {format(parseISO(bulan + "-01"), "MMMM yyyy", { locale: idLocale })}
                {selectedMapel.guru && ` · ${selectedMapel.guru.nama}`}
              </p>
            </div>
          </div>

          {loadingRekap ? (
            <Card className="border shadow-none rounded-2xl">
              <CardContent className="py-12 flex items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Memuat data rekap...</span>
              </CardContent>
            </Card>
          ) : !rekapData || rekapData.pertemuan.length === 0 ? (
            <Card className="border shadow-none rounded-2xl">
              <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h3 className="font-medium text-muted-foreground">Belum ada data absensi</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Tidak ada pertemuan tercatat untuk {selectedMapel.nama_mapel} di bulan ini
                </p>
              </CardContent>
            </Card>
          ) : (
            <PivotTable data={rekapData} />
          )}
        </div>
      ) : (
        /* ── List View: Daftar Mapel ── */
        <div className="space-y-3">
          {loadingMapel ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border shadow-none rounded-2xl">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-11 w-11 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : mapelList.length === 0 ? (
            <Card className="border shadow-none rounded-2xl bg-muted/30">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h3 className="font-medium text-muted-foreground">Tidak ada mata pelajaran</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Tidak ada jadwal untuk kelas ini
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                {mapelList.length} Mata Pelajaran · {kelasName} · {format(parseISO(bulan + "-01"), "MMMM yyyy", { locale: idLocale })}
              </p>
              {mapelList.map(mp => (
                <MapelCard key={mp.id} mapel={mp} onClick={() => fetchRekap(mp)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mapel Card ─────────────────────────────────────────────────────────────────

function MapelCard({ mapel, onClick }: { mapel: MapelSummary; onClick: () => void }) {
  const pct = mapel.rata_hadir;
  const barColor = pct >= 80 ? "hsl(142,70%,45%)" : pct >= 60 ? "hsl(38,92%,50%)" : "hsl(0,84%,60%)";

  return (
    <Card
      className="border shadow-none rounded-2xl overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all group"
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
            style={{ background: "hsl(231,59%,26%)" }}
          >
            {mapel.kode_mapel?.slice(0, 3) || <BookOpen className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-foreground truncate">{mapel.nama_mapel}</p>
              <Badge variant="outline" className="rounded-md text-xs shrink-0">{mapel.kode_mapel}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {mapel.guru?.nama ?? "—"} · {mapel.pertemuan} pertemuan · {mapel.total_siswa} siswa
            </p>
            {/* Mini progress bar */}
            {mapel.pertemuan > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: barColor }}>{pct}%</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {mapel.pertemuan > 0 && (
              <div className="hidden sm:flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  {mapel.rata_hadir}% hadir
                </span>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pivot Table ────────────────────────────────────────────────────────────────

function PivotTable({ data }: { data: RekapMapelData }) {
  const { pertemuan, siswa } = data;

  // Summary per kolom (per tanggal)
  const colSummary = pertemuan.map(tgl => {
    const counts = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    for (const s of siswa) {
      const st = s.kehadiran[tgl];
      if (st && st in counts) counts[st as keyof typeof counts]++;
    }
    return counts;
  });

  return (
    <Card className="border shadow-none rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Daftar Kehadiran Siswa</CardTitle>
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <span key={k} className={`flex items-center gap-1 font-medium ${v.text}`}>
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${v.bg} ${v.text}`}>{v.short}</span>
                {v.label}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{pertemuan.length} pertemuan · {siswa.length} siswa</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 sticky left-0 bg-muted/40 z-10 min-w-[160px]">
                Siswa
              </th>
              {pertemuan.map((tgl, i) => (
                <th key={tgl} className="text-center text-xs font-semibold text-muted-foreground px-2 py-2.5 min-w-[52px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>P{i + 1}</span>
                    <span className="font-normal text-[10px] text-muted-foreground/60">{formatTanggal(tgl)}</span>
                  </div>
                </th>
              ))}
              <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2.5 min-w-[32px] bg-emerald-50">H</th>
              <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2.5 min-w-[32px] bg-blue-50">I</th>
              <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2.5 min-w-[32px] bg-orange-50">S</th>
              <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2.5 min-w-[32px] bg-red-50">A</th>
              <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-2.5 min-w-[56px]">%</th>
            </tr>
          </thead>
          <tbody>
            {siswa.map((s, idx) => (
              <tr
                key={s.id}
                className={`border-b transition-colors hover:bg-muted/20 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
              >
                <td className="px-4 py-2.5 sticky left-0 z-10 bg-inherit" style={{ background: idx % 2 === 0 ? "white" : "hsl(210,40%,98%)" }}>
                  <div>
                    <p className="font-medium text-sm leading-tight">{s.nama}</p>
                    <p className="text-xs text-muted-foreground">{s.nis}</p>
                  </div>
                </td>
                {pertemuan.map(tgl => (
                  <td key={tgl} className="text-center px-2 py-2.5">
                    <StatusCell status={s.kehadiran[tgl]} />
                  </td>
                ))}
                <td className="text-center px-2 py-2.5 bg-emerald-50/50">
                  <span className="text-xs font-semibold text-emerald-700">{s.rekap.hadir}</span>
                </td>
                <td className="text-center px-2 py-2.5 bg-blue-50/50">
                  <span className="text-xs font-semibold text-blue-700">{s.rekap.izin}</span>
                </td>
                <td className="text-center px-2 py-2.5 bg-orange-50/50">
                  <span className="text-xs font-semibold text-orange-700">{s.rekap.sakit}</span>
                </td>
                <td className="text-center px-2 py-2.5 bg-red-50/50">
                  <span className="text-xs font-semibold text-red-700">{s.rekap.alfa}</span>
                </td>
                <td className="text-center px-3 py-2.5">
                  <span
                    className="text-xs font-bold"
                    style={{
                      color: s.pct >= 80 ? "hsl(142,70%,40%)" : s.pct >= 60 ? "hsl(38,92%,45%)" : "hsl(0,84%,55%)"
                    }}
                  >
                    {s.pct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Footer: summary per kolom */}
          <tfoot>
            <tr className="border-t-2 bg-muted/30">
              <td className="px-4 py-2 sticky left-0 bg-muted/30 z-10">
                <p className="text-xs font-semibold text-muted-foreground">Total Hadir</p>
              </td>
              {colSummary.map((col, i) => (
                <td key={i} className="text-center px-2 py-2">
                  <span className="text-xs font-semibold text-emerald-700">{col.hadir}</span>
                  <span className="text-[10px] text-muted-foreground">/{siswa.length}</span>
                </td>
              ))}
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
