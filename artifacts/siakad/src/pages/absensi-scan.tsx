import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, QrCode, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ScanStatus = "loading" | "success" | "already" | "expired" | "error" | "not_siswa";

export default function AbsensiScanPage() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [status, setStatus] = useState<ScanStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("QR code tidak valid. Token tidak ditemukan.");
      return;
    }

    const authToken = localStorage.getItem("siakad_token");
    if (!authToken) {
      navigate(`/login?redirect=/absensi/scan?token=${token}`);
      return;
    }

    const doScan = async () => {
      try {
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
          setStatus("expired");
          setMessage("Sesi absensi sudah berakhir. Hubungi guru untuk membuka sesi baru.");
          return;
        }

        if (res.status === 403) {
          setStatus("not_siswa");
          setMessage(data.message || "Akun ini bukan akun siswa.");
          return;
        }

        if (!res.ok) {
          setStatus("error");
          setMessage(data.message || "Terjadi kesalahan saat memproses absensi.");
          return;
        }

        setStatus(data.already ? "already" : "success");
        setMessage(data.message);
      } catch (e) {
        setStatus("error");
        setMessage("Gagal terhubung ke server. Periksa koneksi internet kamu.");
      }
    };

    doScan();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(220,20%,97%)" }}>
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3" style={{ background: "hsl(231,59%,26%)" }}>
            <QrCode className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "hsl(231,59%,26%)" }}>SMP Negeri 2 Rambang</h1>
          <p className="text-sm text-muted-foreground">Absensi Digital</p>
        </div>

        <Card className="border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            {status === "loading" && (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Memproses absensi...</p>
                  <p className="text-sm text-muted-foreground mt-1">Harap tunggu sebentar</p>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">Berhasil Hadir!</p>
                  <p className="text-sm text-muted-foreground mt-1">{message}</p>
                </div>
                <Button variant="outline" className="mt-2 w-full rounded-xl" onClick={() => navigate("/absensi")}>
                  Lihat Rekap Absensi
                </Button>
              </>
            )}

            {status === "already" && (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-blue-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">Sudah Tercatat</p>
                  <p className="text-sm text-muted-foreground mt-1">{message}</p>
                </div>
                <Button variant="outline" className="mt-2 w-full rounded-xl" onClick={() => navigate("/absensi")}>
                  Lihat Rekap Absensi
                </Button>
              </>
            )}

            {status === "expired" && (
              <>
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-orange-600">Sesi Berakhir</p>
                  <p className="text-sm text-muted-foreground mt-1">{message}</p>
                </div>
              </>
            )}

            {(status === "error" || status === "not_siswa") && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">Gagal</p>
                  <p className="text-sm text-muted-foreground mt-1">{message}</p>
                </div>
                <Button variant="outline" className="mt-2 w-full rounded-xl" onClick={() => navigate("/dashboard")}>
                  Kembali ke Dashboard
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
