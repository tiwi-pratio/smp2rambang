export const TINGKAT_OPTIONS = [7, 8, 9] as const;
export const ROMBEL_OPTIONS = ["A", "B", "C", "D", "E", "F"] as const;

export type Tingkat = (typeof TINGKAT_OPTIONS)[number];
export type Rombel = (typeof ROMBEL_OPTIONS)[number];

const ROMAN: Record<number, string> = { 7: "VII", 8: "VIII", 9: "IX" };

export function tingkatToRoman(tingkat: number): string {
  return ROMAN[tingkat] ?? String(tingkat);
}

export function buildNamaKelas(tingkat: number, rombel: string): string {
  return `${tingkatToRoman(tingkat)}-${rombel}`;
}

export function parseRombelFromNamaKelas(namaKelas: string): string {
  const parts = namaKelas.split("-");
  return parts.length >= 2 ? parts[parts.length - 1] : "";
}

export function parseTingkatFromNamaKelas(namaKelas: string): number | null {
  const roman = namaKelas.split("-")[0]?.trim().toUpperCase();
  const found = Object.entries(ROMAN).find(([, v]) => v === roman);
  return found ? Number(found[0]) : null;
}
