/** `birimTuruId` filtre değerleri. */
export const BIRIM_TURU = {
  LISANS: 46,
  ONLISANS: 47,
} as const;

/** Program seviyesi ('bachelor' / 'associate' vb.) ID eşlemeleri. */
export const DEGREE_TYPE_MAP: Record<string, number> = {
  bachelor: 46,
  lisans: 46,
  associate: 47,
  onlisans: 47,
};

/** `bursOraniId` sık kullanılan değerler. */
export const BURS_ORANI = {
  /** Ücretsiz / tam burslu. */
  UCRETSIZ: 0,
} as const;

/** Burs türü kısayol eşlemeleri. */
export const BURS_TURU_MAP: Record<string, number> = {
  ucretsiz: 0,
  tam: 0,
  "%50": 50,
  "%25": 25,
};

/** Öğrenim türü kısayol eşlemeleri. */
export const OGRENIM_TURU_MAP: Record<string, number> = {
  orgun: 1,
  ikinci: 2,
  uzaktan: 3,
};

/** ÖSYM yasal başarı sırası barajları. */
export const OSYM_BARAJLARI: Record<string, { barajSira: number; categoryName: string }> = {
  TIP: { barajSira: 50_000, categoryName: "Tıp" },
  DIS: { barajSira: 80_000, categoryName: "Diş Hekimliği" },
  ECZACILIK: { barajSira: 100_000, categoryName: "Eczacılık" },
  HUKUK: { barajSira: 125_000, categoryName: "Hukuk" },
  MIMARLIK: { barajSira: 250_000, categoryName: "Mimarlık" },
  MUHENDISLIK: { barajSira: 300_000, categoryName: "Mühendislik" },
  OGRETMENLIK: { barajSira: 300_000, categoryName: "Öğretmenlik / PDR" },
};

/** Net Sihirbazı ders alanları ve Türkçe adları. */
export const NET_DERSLERI: { key: string; label: string }[] = [
  { key: "tytTrkNet", label: "TYT Türkçe" },
  { key: "tytSosNet", label: "TYT Sosyal" },
  { key: "tytMatNet", label: "TYT Matematik" },
  { key: "tytFenNet", label: "TYT Fen" },
  { key: "aytMatNet", label: "AYT Matematik" },
  { key: "aytFizNet", label: "AYT Fizik" },
  { key: "aytKimNet", label: "AYT Kimya" },
  { key: "aytBioNet", label: "AYT Biyoloji" },
  { key: "aytTdeNet", label: "AYT Edebiyat" },
  { key: "aytTrh1Net", label: "AYT Tarih-1" },
  { key: "aytCog1Net", label: "AYT Coğrafya-1" },
  { key: "aytTrh2Net", label: "AYT Tarih-2" },
  { key: "aytCog2Net", label: "AYT Coğrafya-2" },
  { key: "aytFelNet", label: "AYT Felsefe" },
  { key: "aytDinNet", label: "AYT Din Kültürü" },
  { key: "ydtYdilNet", label: "YDT Yabancı Dil" },
];

/** `puanTuru` kısaltmalarının okunur Türkçe karşılıkları. */
export const PUAN_TURU_ETIKETLERI: Record<string, string> = {
  SAY: "Sayısal",
  "SÖZ": "Sözel",
  EA: "Eşit Ağırlık",
  "DİL": "Dil",
  TYT: "TYT (Ön Lisans)",
};

/** `birimTuruAdi` değerlerinin okunur Türkçe karşılıkları. */
export const BIRIM_TURU_ETIKETLERI: Record<string, string> = {
  LISANS: "Lisans",
  ONLISANS: "Ön Lisans",
};

/** `universiteTuru` değerlerinin okunur Türkçe karşılıkları. */
export const UNIVERSITE_TURU_ETIKETLERI: Record<string, string> = {
  DEVLET: "Devlet Üniversitesi",
  VAKIF: "Vakıf Üniversitesi",
  "VAKIF MYO": "Vakıf Meslek Yüksekokulu",
};

/** Verilen puan türü kodunu okunur Türkçe etikete çevirir; bilinmiyorsa kodu olduğu gibi döner. */
export function getPuanTuruLabel(puanTuru: string | null | undefined): string {
  if (!puanTuru) return "Bilinmiyor";
  return PUAN_TURU_ETIKETLERI[puanTuru.toUpperCase()] ?? puanTuru;
}

/** Verilen birim türü kodunu okunur Türkçe etikete çevirir; bilinmiyorsa kodu olduğu gibi döner. */
export function getBirimTuruLabel(birimTuruAdi: string | null | undefined): string {
  if (!birimTuruAdi) return "Bilinmiyor";
  return BIRIM_TURU_ETIKETLERI[birimTuruAdi.toUpperCase()] ?? birimTuruAdi;
}

/** Verilen üniversite türü kodunu okunur Türkçe etikete çevirir; bilinmiyorsa kodu olduğu gibi döner. */
export function getUniversiteTuruLabel(universiteTuru: string | null | undefined): string {
  if (!universiteTuru) return "Bilinmiyor";
  return UNIVERSITE_TURU_ETIKETLERI[universiteTuru.toUpperCase()] ?? universiteTuru;
}
