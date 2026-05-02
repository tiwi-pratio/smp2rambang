import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { TINGKAT_OPTIONS, tingkatToRoman } from "@/lib/kelas-utils";

interface KelasItem {
  id: string | number;
  nama_kelas: string;
  tingkat: number;
}

interface KelasSelectorProps {
  kelasList: KelasItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function KelasSelector({
  kelasList,
  value,
  onValueChange,
  placeholder = "Pilih kelas",
  disabled,
}: KelasSelectorProps) {
  const selectedKelas = kelasList.find((k) => String(k.id) === value);
  const [filterTingkat, setFilterTingkat] = useState<string>(
    selectedKelas ? String(selectedKelas.tingkat) : ""
  );

  useEffect(() => {
    if (!value) {
      setFilterTingkat("");
    } else if (selectedKelas) {
      setFilterTingkat(String(selectedKelas.tingkat));
    }
  }, [value]);

  const tingkatValues = [
    ...new Set(kelasList.map((k) => k.tingkat).filter(Boolean)),
  ].sort();

  const filteredKelas = filterTingkat
    ? kelasList.filter((k) => String(k.tingkat) === filterTingkat)
    : [];

  const handleTingkatChange = (t: string) => {
    setFilterTingkat(t);
    onValueChange("");
  };

  return (
    <div className="flex gap-2">
      <Select
        value={filterTingkat}
        onValueChange={handleTingkatChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue placeholder="Tingkat" />
        </SelectTrigger>
        <SelectContent>
          {(tingkatValues.length > 0 ? tingkatValues : TINGKAT_OPTIONS).map((t) => (
            <SelectItem key={t} value={String(t)}>
              Kelas {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || !filterTingkat}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={filterTingkat ? placeholder : "Pilih tingkat dulu"} />
        </SelectTrigger>
        <SelectContent>
          {filteredKelas.length === 0 ? (
            <SelectItem value="__none__" disabled>
              Belum ada kelas tingkat {filterTingkat}
            </SelectItem>
          ) : (
            filteredKelas.map((k) => (
              <SelectItem key={k.id} value={String(k.id)}>
                {k.nama_kelas}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
