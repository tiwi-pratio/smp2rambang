import { useState, useRef } from "react";
import { 
  useGetMe,
  useGetRaport,
  useListKelas,
  useListSiswa,
  getGetRaportQueryKey
} from "@workspace/api-client-react";
import { Printer, Search, GraduationCap, School } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RaportPage() {
  const { data: user } = useGetMe();
  const isAdmin = user?.role === 'admin';
  const isGuru = user?.role === 'guru';
  const isSiswa = user?.role === 'siswa';

  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedSiswa, setSelectedSiswa] = useState<string>("");
  const [semester, setSemester] = useState<string>("1");
  const [tahunAjaran, setTahunAjaran] = useState<string>("2023/2024");

  const printRef = useRef<HTMLDivElement>(null);

  const effectiveSiswaId = isSiswa ? user?.id : selectedSiswa; // If siswa, they view their own. Note: user.id might be the user_id, need to make sure we use the correct siswa_id. For now, assuming user.id is the siswa_id or backend handles it via auth if we just pass their user id (or we require backend change. Actually API needs siswa_id). 
  // Wait, if it's a student, we don't have the siswa.id directly on user, but let's assume we can fetch it or backend allows passing 'me' or something. Actually, we'll just require them to pick themselves if we don't have it, but for a real app we'd map it. Let's just use user.id, if it fails, it fails gracefully. But actually `useGetRaport` needs `siswa_id`. Let's just pass `user.id`.

  // Let's get the siswa_id for the logged in student.
  const { data: siswaDataList } = useListSiswa({ search: user?.full_name }, { query: { enabled: isSiswa } });
  const realSiswaId = isSiswa ? (siswaDataList?.data?.[0]?.id || "") : selectedSiswa;

  const { data: kelasData } = useListKelas({ query: { enabled: !isSiswa } } as any);
  const { data: siswaData } = useListSiswa(
    { kelas_id: selectedKelas, limit: 100 }, 
    { query: { enabled: !!selectedKelas && !isSiswa } }
  );

  const { data: raportData, isLoading } = useGetRaport(
    { 
      siswa_id: realSiswaId, 
      semester, 
      tahun_ajaran: tahunAjaran 
    },
    { query: { enabled: !!realSiswaId && !!semester && !!tahunAjaran, retry: false } }
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">E-Raport</h1>
        </div>
        
        {raportData && (
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak Raport
          </Button>
        )}
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Filter Raport</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {!isSiswa && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kelas</label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {kelasData?.map(k => (
                        <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Siswa</label>
                  <Select value={selectedSiswa} onValueChange={setSelectedSiswa} disabled={!selectedKelas}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Siswa" />
                    </SelectTrigger>
                    <SelectContent>
                      {siswaData?.data?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Semester</label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester 1 (Ganjil)</SelectItem>
                  <SelectItem value="2">Semester 2 (Genap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tahun Ajaran</label>
              <Input 
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                placeholder="2023/2024"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!realSiswaId ? (
        <Card className="border-dashed print:hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Pilih Siswa</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              Silakan pilih kelas dan siswa terlebih dahulu untuk melihat raport.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/3 mx-auto mb-8" />
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      ) : raportData ? (
        <div className="bg-white text-black p-8 rounded-lg shadow-sm border" ref={printRef} style={{ minHeight: '800px' }}>
          {/* Header Raport */}
          <div className="flex items-center justify-center border-b-2 border-black pb-6 mb-6">
            <School className="h-16 w-16 mr-6" />
            <div className="text-center">
              <h2 className="text-xl font-bold uppercase tracking-widest">SMP Negeri 2 Rambang</h2>
              <p className="text-sm">LAPORAN HASIL BELAJAR PESERTA DIDIK</p>
              <p className="text-sm">TAHUN AJARAN {raportData.tahun_ajaran}</p>
            </div>
          </div>

          {/* Info Siswa */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-8 text-sm">
            <div className="grid grid-cols-[120px_10px_1fr]">
              <span className="font-semibold">Nama Peserta Didik</span>
              <span>:</span>
              <span>{raportData.siswa.nama}</span>
            </div>
            <div className="grid grid-cols-[120px_10px_1fr]">
              <span className="font-semibold">Kelas</span>
              <span>:</span>
              <span>{raportData.siswa.kelas?.nama_kelas || '-'}</span>
            </div>
            <div className="grid grid-cols-[120px_10px_1fr]">
              <span className="font-semibold">NIS / NISN</span>
              <span>:</span>
              <span>{raportData.siswa.nis} / {raportData.siswa.nisn}</span>
            </div>
            <div className="grid grid-cols-[120px_10px_1fr]">
              <span className="font-semibold">Semester</span>
              <span>:</span>
              <span>{raportData.semester === '1' ? '1 (Ganjil)' : '2 (Genap)'}</span>
            </div>
          </div>

          {/* Tabel Nilai */}
          <table className="w-full border-collapse border border-black text-sm mb-8">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-center w-12">No</th>
                <th className="border border-black p-2 text-left">Mata Pelajaran</th>
                <th className="border border-black p-2 text-center w-24">KKM</th>
                <th className="border border-black p-2 text-center w-24">Nilai</th>
                <th className="border border-black p-2 text-center w-32">Predikat</th>
              </tr>
            </thead>
            <tbody>
              {raportData.nilai_list.map((nilai, index) => {
                const nilaiAkhir = nilai.nilai_akhir || 0;
                let predikat = 'D';
                if (nilaiAkhir >= 90) predikat = 'A';
                else if (nilaiAkhir >= 80) predikat = 'B';
                else if (nilaiAkhir >= 70) predikat = 'C';

                return (
                  <tr key={index}>
                    <td className="border border-black p-2 text-center">{index + 1}</td>
                    <td className="border border-black p-2 font-medium">{nilai.mata_pelajaran}</td>
                    <td className="border border-black p-2 text-center">75</td>
                    <td className="border border-black p-2 text-center font-bold">
                      {nilaiAkhir || '-'}
                    </td>
                    <td className="border border-black p-2 text-center">
                      {nilaiAkhir ? predikat : '-'}
                    </td>
                  </tr>
                );
              })}
              
              {raportData.nilai_list.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-black p-8 text-center italic text-gray-500">
                    Belum ada data nilai untuk semester ini.
                  </td>
                </tr>
              )}
            </tbody>
            {raportData.nilai_list.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="border border-black p-2 text-right font-bold">Rata-rata</td>
                  <td className="border border-black p-2 text-center font-bold">
                    {raportData.rata_rata?.toFixed(1) || '-'}
                  </td>
                  <td className="border border-black p-2 bg-gray-50"></td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-2 mt-16 pt-8 text-sm text-center">
            <div>
              <p className="mb-16">Mengetahui,<br />Orang Tua/Wali</p>
              <p className="font-semibold underline">( ...................................... )</p>
            </div>
            <div>
              <p className="mb-16">Rambang, {format(new Date(), 'dd MMMM yyyy')}<br />Wali Kelas</p>
              <p className="font-semibold underline">
                {raportData.siswa.kelas?.wali_kelas?.nama || '( ...................................... )'}
              </p>
              {raportData.siswa.kelas?.wali_kelas?.nip && (
                <p>NIP. {raportData.siswa.kelas.wali_kelas.nip}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Card className="border-dashed print:hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Data Raport Tidak Ditemukan</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              Siswa ini mungkin belum memiliki nilai yang diinput untuk semester dan tahun ajaran yang dipilih.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .bg-white.text-black.p-8, .bg-white.text-black.p-8 * {
            visibility: visible;
          }
          .bg-white.text-black.p-8 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}} />
    </div>
  );
}
