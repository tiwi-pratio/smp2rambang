function getToken() {
  return localStorage.getItem("siakad_token") || "";
}

export async function fetchMySiswa() {
  const res = await fetch(`/api/auth/me/siswa`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Gagal memuat data profil");
  return res.json();
}

export async function updateMySiswa(body: Record<string, string>) {
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
