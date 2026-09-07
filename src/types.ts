/** Puan türleri (sınav kategorisi). */
export type PuanTuru = "SAY" | "SÖZ" | "EA" | "DİL" | "TYT";

/** Üniversite türü. */
export type UniversiteTuru = "DEVLET" | "VAKIF" | "VAKIF MYO";

/** Birim (program) türü — LİSANS ya da ÖNLİSANS. API "ÖNLISANS" gönderir, bu kütüphane "ONLISANS" olarak normalize eder. */
export type BirimTuru = "LISANS" | "ONLISANS";

/** Program seviyesi için kullanıcı dostu tip ("bachelor" | "associate" | "lisans" | "onlisans"). */
export type DegreeType = "bachelor" | "associate" | "lisans" | "onlisans";

/** Sık kullanılan burs oranı etiketleri. */
export type BursTuru = "ucretsiz" | "tam" | "%50" | "%25";

/** Sık kullanılan öğrenim türü etiketleri. */
export type OgrenimTuru = "orgun" | "ikinci" | "uzaktan";

export interface University {
  universiteId: number;
  universiteAdi: string;
}

export interface ProgramGroup {
  birimGrupId: number;
  birimGrupAdi: string;
  puanTuru: string;
}

export interface City {
  ilKodu: number;
  ilAdi: string;
}

/** Tek bir yıla ait kontenjan/kadro/puan/sıra/KPSS istatistikleri. */
export interface YearlyStats {
  year: number;
  kontenjan: number | null;
  /** Genel kontenjandan yerleşen (gkY). */
  yerlesen: number | null;
  kontenjanObs: number | null;
  kontenjanY34: number | null;
  prof: number | null;
  doc: number | null;
  dou: number | null;
  ogrGor: number | null;
  arGor: number | null;
  kpss1: number | null;
  kpss2: number | null;
  minPuan: number | null;
  basariSirasi: number | null;
}

/** `/api/tercih-kilavuz/search` endpoint'inden dönen tek bir program satırı. */
export interface Program {
  osymKilavuzId: number | null;
  sinav: string | null;
  yil: number;
  donem: string | null;
  tabloTuru: string | null;
  birimId: number | null;
  birimHiyerarsi: string | null;
  kilavuzKodu: number;

  universiteId: number;
  universiteAdi: string;
  uniIlKodu: number | null;
  uniIlAdi: string | null;
  uniIlceKodu: number | null;
  uniIlceAdi: string | null;

  fymkId: number | null;
  fymkAdi: string | null;
  fymkIlKodu: number | null;
  fymkIlAdi: string | null;
  fymkIlceKodu: number | null;
  fymkIlceAdi: string | null;

  birimAdi: string;
  birimGrupId: number | null;
  birimGrupAdi: string | null;
  birimTuruId: number | null;
  birimTuruAdi: BirimTuru;

  ogrenimTuruId: number | null;
  ogrenimTuruAdi: string | null;
  ogrenimSuresi: number | null;
  puanTuru: string;
  ogrenimDiliId: number | null;
  ogrenimDiliAdi: string | null;
  bursOraniId: number | null;
  bursOraniAdi: string | null;

  ilKodu: number | null;
  ilAdi: string | null;
  ilceKodu: number | null;
  ilceAdi: string | null;
  universiteTuru: UniversiteTuru;

  /** En güncel yılın istatistikleri. */
  current: YearlyStats;
  /** Önceki 3 yıl (yeni → eski). */
  history: YearlyStats[];
  /** Tüm yılların kronolojik sıralaması: current ilk sırada, ardından geçmiş yıllar [current, ...history]. */
  allYears: YearlyStats[];
}

/**
 * Net Sihirbazı sonucu — bir program/üniversite/yıl için son yerleşen
 * kişinin TYT/AYT/YDT net sayıları (`/api/netler/search`).
 *
 * Hangi `*Net` alanlarının dolu geleceği `puanTuru`'ye bağlıdır: TYT alanları
 * her zaman gelir; SAY `aytMat/Fiz/Kim/BioNet` ekler; SÖZ `aytTde/Trh1/Cog1/
 * Trh2/Cog2/Fel/DinNet` ekler; EA ikisinin bir alt kümesini ekler; DİL
 * `ydtYdilNet` ekler.
 */
export interface Net {
  yil: number;
  kilavuzKodu: number;
  puanTuru: string;
  katsayi: number | null;
  tabanPuan: number | null;
  obp: number | null;

  tytTrkNet: number | null;
  tytSosNet: number | null;
  tytMatNet: number | null;
  tytFenNet: number | null;

  aytMatNet: number | null;
  aytFizNet: number | null;
  aytKimNet: number | null;
  aytBioNet: number | null;

  aytTdeNet: number | null;
  aytTrh1Net: number | null;
  aytCog1Net: number | null;
  aytTrh2Net: number | null;
  aytCog2Net: number | null;
  aytFelNet: number | null;
  aytDinNet: number | null;

  ydtYdilNet: number | null;

  universiteId: number;
  universiteAdi: string;
  birimGrupId: number | null;
  birimGrupAdi: string | null;
  birimId: number | null;
  birimAdi: string;
  birimTuruId: number | null;
  birimTuruAdi: BirimTuru;
  universiteTuru: UniversiteTuru;
}

/** Spring-tarzı sayfalanmış sonuç zarfı. */
export interface SearchPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
  yil?: number | null;
  source?: string | null;
}

/**
 * `YokAtlas.search()` tarafından kabul edilen filtreler.
 *
 * *Akıllı* (string) alanlar (`universite`, `program`, `il`) `smartSearch`
 * açıkken (varsayılan) istek anında ID karşılıklarına çözülür. ID
 * alanlarıyla (`universiteId`, `birimGrupId`, `ilKodu`) aynı anda verilemez.
 */
export interface SearchFilters {
  puanTuru?: PuanTuru | null;
  universiteId?: number[] | null;
  birimGrupId?: number[] | null;
  ilKodu?: number[] | null;
  /** 46 = LİSANS, 47 = ÖNLİSANS. Bkz. {@link BIRIM_TURU}. */
  birimTuruId?: number | null;
  /** Program seviyesi ('bachelor'/'lisans'=46, 'associate'/'onlisans'=47). `birimTuruId` yerine kullanılabilir. */
  degreeType?: DegreeType | null;
  universiteTuru?: "DEVLET" | "VAKIF" | null;
  /** 0 = Ücretsiz/Burslu. */
  bursOraniId?: number | null;
  /** Sık kullanılan burs oranı ('ucretsiz'/'tam'=0, '%50'=50, '%25'=25). `bursOraniId` yerine kullanılabilir. */
  bursTuru?: BursTuru | null;
  ogrenimTuruId?: number | null;
  /** Sık kullanılan öğretim türü ('orgun'=1, 'ikinci'=2, 'uzaktan'=3). `ogrenimTuruId` yerine kullanılabilir. */
  ogrenimTuru?: OgrenimTuru | null;
  kilavuzKodu?: number | null;
  minBasariSirasi?: number | null;
  maxBasariSirasi?: number | null;

  /** Akıllı alan — serbest yazım, fuzzy eşleşir (örn. "boğaziçi"). */
  universite?: string | string[] | null;
  /** Akıllı alan — serbest yazım, fuzzy eşleşir (örn. "bilgisayar mühendisliği"). */
  program?: string | string[] | null;
  /** Akıllı alan — serbest yazım, fuzzy eşleşir (örn. "ankara"). */
  il?: string | string[] | null;
}

/**
 * `YokAtlas.searchNetler()` tarafından kabul edilen filtreler.
 *
 * {@link SearchFilters}'in aksine `universiteId`/`birimGrupId` *tekildir* —
 * Net Sihirbazı endpoint'i liste kabul etmez.
 */
export interface NetFilters {
  puanTuru?: PuanTuru | null;
  universiteId?: number | null;
  birimGrupId?: number | null;
  birimTuruId?: number | null;
  universiteTuru?: "DEVLET" | "VAKIF" | null;
  yil?: number | null;
  katsayi?: number | null;

  universite?: string | null;
  program?: string | null;
}

export interface SearchOptions {
  page?: number;
  size?: number;
  sortBy?: string;
  direction?: "ASC" | "DESC";
  /** Akıllı (string) filtreleri otomatik ID'ye çözer. Varsayılan: true. */
  smartSearch?: boolean;
  signal?: AbortSignal;
}

export interface NetSearchOptions {
  page?: number;
  size?: number;
  smartSearch?: boolean;
  signal?: AbortSignal;
}

/** {@link YokAtlas.searchAllPages} için seçenekler. */
export interface SearchAllPagesOptions extends Omit<SearchOptions, "page"> {
  /** Sayfa başına kaç kayıt çekileceği. Varsayılan: 100. */
  pageSize?: number;
  /** En fazla kaç sayfa gezileceği (güvenlik sınırı). Varsayılan: 50. */
  maxPages?: number;
}

/** Kullanıcının başarı sırasına göre bir programa yerleşme olasılığı tahmini. */
export interface AdmissionEstimate {
  program: Program;
  /** Kullanıcının kendi başarı sırası. */
  basariSirasi: number;
  /** Programın güncel yıl kesme başarı sırası. */
  cutoffBasariSirasi: number | null;
  verdict: "kesine yakın" | "olası" | "sınırda" | "zayıf" | "belirsiz";
  /** Kullanıcı sırası ile kesme sırası arasındaki fark (negatif = kullanıcı daha iyi sırada). */
  margin: number | null;
  message: string;
}

/** İki program arasındaki karşılaştırma sonucu. */
export interface ProgramComparison {
  a: Program;
  b: Program;
  /** Hangisinin güncel başarı sırası daha iyi (küçük) — o daha rekabetçidir. */
  moreCompetitive: "a" | "b" | "eşit" | "belirsiz";
  scoreDiff: number | null;
  quotaDiff: number | null;
}

/** Bir programın yıllar içindeki başarı sırası eğilimi. */
export interface ProgramTrend {
  program: Program;
  direction: "yükseliyor" | "düşüyor" | "sabit" | "belirsiz";
  /** Eskiden yeniye başarı sıraları (null'lar atlanır). */
  series: { year: number; basariSirasi: number | null }[];
  message: string;
}

export interface LookupCacheStatus {
  cached: boolean;
  fetchedAt: number | null;
  ageMs: number | null;
  ttlMs: number;
  universiteSayisi: number;
  programGrubuSayisi: number;
  ilSayisi: number;
  /** Önbellek verisinin ağ yerine yerel statik snapshot'tan yüklenip yüklenmediği. */
  isOfflineFallback?: boolean;
}

export interface YokAtlasConfig {
  baseUrl?: string;
  /** HTTP istek zaman aşımı (ms). Varsayılan: 30000. */
  timeoutMs?: number;
  userAgent?: string;
  /** Ağ hatalarında (bağlantı kopması vb.) kaç kez yeniden denenir. Varsayılan: 2. */
  maxRetries?: number;
  /** Üniversite/program/il lookup önbelleğinin ömrü (ms). Varsayılan: 3600000 (1 saat). 0 = sonsuz. */
  lookupCacheTtlMs?: number;
  /** Ağ hatası durumunda yerel lookup snapshot yedeğinin devreye girip girmeyeceği. Varsayılan: true. */
  offlineFallback?: boolean;
}

/** Kullanıcının deneme/sınav netleri. */
export interface UserNetScores {
  tytTrkNet?: number | null;
  tytSosNet?: number | null;
  tytMatNet?: number | null;
  tytFenNet?: number | null;
  aytMatNet?: number | null;
  aytFizNet?: number | null;
  aytKimNet?: number | null;
  aytBioNet?: number | null;
  aytTdeNet?: number | null;
  aytTrh1Net?: number | null;
  aytCog1Net?: number | null;
  aytTrh2Net?: number | null;
  aytCog2Net?: number | null;
  aytFelNet?: number | null;
  aytDinNet?: number | null;
  ydtYdilNet?: number | null;
}

/** Tek bir ders bazında net karşılaştırması. */
export interface LessonNetDiff {
  lessonKey: string;
  lessonName: string;
  userNet: number;
  targetNet: number;
  diff: number;
  status: "ahead" | "behind" | "equal";
}

/** Net Sihirbazı kıyaslama raporu. */
export interface NetComparison {
  program: {
    kilavuzKodu: number;
    universiteAdi: string;
    birimAdi: string;
    puanTuru: string;
    yil: number;
    tabanPuan: number | null;
  };
  lessons: LessonNetDiff[];
  totalUserNet: number;
  totalTargetNet: number;
  totalDiff: number;
  aheadLessons: string[];
  behindLessons: string[];
  summary: string;
}

/** ÖSYM yasal baraj şartı kategori kodu. */
export type OsymBarajKategori =
  | "TIP"
  | "DIS"
  | "ECZACILIK"
  | "HUKUK"
  | "MIMARLIK"
  | "MUHENDISLIK"
  | "OGRETMENLIK";

/** ÖSYM başarı sırası baraj şartı denetimi sonucu. */
export interface PrerequisiteCheck {
  program: Program;
  basariSirasi: number;
  category: OsymBarajKategori | null;
  categoryName: string | null;
  barajSira: number | null;
  eligible: boolean;
  margin: number | null;
  message: string;
}

/** Tercih listesi analizi için girdi öğesi. */
export interface PreferenceInput {
  program: Program;
  userOrder?: number;
}

/** İncelenmiş tek bir tercih kaydı. */
export interface AnalyzedPreferenceItem {
  userOrder: number;
  program: Program;
  tier: "güvenli" | "ideal" | "hayal" | "belirsiz";
  estimate: AdmissionEstimate;
  prerequisite: PrerequisiteCheck;
  warning?: string;
}

/** 24 tercih listesinin bütünsel değerlendirmesi. */
export interface PreferenceListAnalysis {
  userRank: number;
  totalPreferences: number;
  tierCounts: {
    guvenli: number;
    ideal: number;
    hayal: number;
    belirsiz: number;
  };
  items: AnalyzedPreferenceItem[];
  warnings: string[];
  overallAdvice: string;
}
