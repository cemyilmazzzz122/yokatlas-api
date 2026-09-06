/** `birimTuruId` filtre değerleri. */
export const BIRIM_TURU = {
  LISANS: 46,
  ONLISANS: 47,
} as const;

/** `bursOraniId` sık kullanılan değerler. */
export const BURS_ORANI = {
  /** Ücretsiz / tam burslu. */
  UCRETSIZ: 0,
} as const;

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
