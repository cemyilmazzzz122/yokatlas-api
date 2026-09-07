import type {
  AdmissionEstimate,
  AnalyzedPreferenceItem,
  BursTuru,
  City,
  DegreeType,
  LessonNetDiff,
  LookupCacheStatus,
  Net,
  NetComparison,
  NetFilters,
  NetSearchOptions,
  OgrenimTuru,
  PreferenceInput,
  PreferenceListAnalysis,
  PrerequisiteCheck,
  Program,
  ProgramComparison,
  ProgramGroup,
  ProgramTrend,
  PuanTuru,
  SearchAllPagesOptions,
  SearchFilters,
  SearchOptions,
  SearchPage,
  University,
  UserNetScores,
  YearlyStats,
  YokAtlasConfig,
} from "./types";
import { YokAtlasAPIError, YokAtlasNotFoundError, YokAtlasRateLimitError, YokAtlasValidationError } from "./errors";
import { resolveByName } from "./lookup";
import { BURS_TURU_MAP, DEGREE_TYPE_MAP, NET_DERSLERI, OGRENIM_TURU_MAP, OSYM_BARAJLARI } from "./constants";
import { LOOKUP_SNAPSHOT } from "./data/snapshot";

const SEARCH_PATH = "/api/tercih-kilavuz/search";
const UNIVERSITIES_PATH = "/api/tercih-kilavuz/universiteler";
const PROGRAMS_PATH = "/api/tercih-kilavuz/universite-programlar";
const CITIES_PATH = "/api/tercih-kilavuz/universite-iller";
const NETLER_SEARCH_PATH = "/api/netler/search";

const YEARLY_OFFSET_FIELDS: Record<keyof Omit<YearlyStats, "year">, string> = {
  kontenjan: "kontenjan",
  yerlesen: "gkY",
  kontenjanObs: "kontenjanObs",
  kontenjanY34: "kontenjanY34",
  prof: "prof",
  doc: "doc",
  dou: "dou",
  ogrGor: "ogrGor",
  arGor: "arGor",
  kpss1: "kpss1",
  kpss2: "kpss2",
  minPuan: "minPuan",
  basariSirasi: "basariSirasi",
};

interface LookupCacheState {
  universities: University[];
  programGroups: ProgramGroup[];
  cities: City[];
  fetchedAt: number;
  isOfflineFallback: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>;

/**
 * YÖK Atlas tercih kılavuzu JSON API'si için statik istemci.
 *
 * Tüm metotlar `static`'tir — örnekleme gerekmez, doğrudan `YokAtlas.search(...)`
 * gibi çağırılır. Üniversite/program/il lookup tabloları süreç içi (in-process)
 * bir TTL önbellekte tutulur ve akıllı arama (`universite`, `program`, `il`
 * serbest metin filtreleri) için otomatik olarak kullanılır.
 */
export class YokAtlas {
  private static baseUrl = "https://yokatlas.yok.gov.tr";
  private static timeoutMs = 30_000;
  private static userAgent = "yokatlas-api-wrapper/1.0 (+https://www.npmjs.com/package/yokatlas-api-wrapper)";
  private static maxRetries = 2;
  private static lookupCacheTtlMs = 3_600_000;
  private static offlineFallback = true;

  private static lookupCache: LookupCacheState | null = null;

  private constructor() {
    // Statik sınıf — örneklenemez.
  }

  // ---------------------------------------------------------------------
  // Yapılandırma
  // ---------------------------------------------------------------------

  /** İstemcinin temel URL'sini, zaman aşımını, User-Agent'ını, retry ve önbellek ayarlarını değiştirir. */
  static configure(config: YokAtlasConfig): void {
    if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    if (config.timeoutMs !== undefined) this.timeoutMs = config.timeoutMs;
    if (config.userAgent !== undefined) this.userAgent = config.userAgent;
    if (config.maxRetries !== undefined) this.maxRetries = config.maxRetries;
    if (config.lookupCacheTtlMs !== undefined) this.lookupCacheTtlMs = config.lookupCacheTtlMs;
    if (config.offlineFallback !== undefined) this.offlineFallback = config.offlineFallback;
  }

  // ---------------------------------------------------------------------
  // Temel arama
  // ---------------------------------------------------------------------

  /** YÖK Atlas tercih kılavuzunda program arar. */
  static async search(filters: SearchFilters = {}, options: SearchOptions = {}): Promise<SearchPage<Program>> {
    const { page = 0, size = 20, sortBy = "basariSirasi", direction = "ASC", smartSearch = true, signal } = options;

    this.validateFilterCollisions(filters);

    let resolved = filters;
    if (smartSearch && (filters.universite != null || filters.program != null || filters.il != null)) {
      await this.ensureLookups();
      resolved = this.resolveSmartFilters(filters);
    }

    const body = {
      filters: this.filtersToPayload(resolved),
      page,
      size,
      sortBy,
      direction: direction.toUpperCase(),
    };
    const raw = await this.postJson<{ content: RawRow[] } & Record<string, unknown>>(SEARCH_PATH, body, signal);
    return this.toSearchPage<Program>(raw, (row) => this.buildProgram(row));
  }

  /** Net Sihirbazı'nı sorgular: son yerleşen kişinin TYT/AYT/YDT netleri. */
  static async searchNetler(filters: NetFilters = {}, options: NetSearchOptions = {}): Promise<SearchPage<Net>> {
    const { page = 0, size = 20, smartSearch = true, signal } = options;

    this.validateNetFilterCollisions(filters);

    let resolved = filters;
    if (smartSearch && (filters.universite != null || filters.program != null)) {
      await this.ensureLookups();
      resolved = this.resolveNetSmartFilters(filters);
    }

    const body = { filters: this.netFiltersToPayload(resolved), page, size };
    const raw = await this.postJson<{ content: RawRow[] } & Record<string, unknown>>(NETLER_SEARCH_PATH, body, signal);
    return this.toSearchPage<Net>(raw, (row) => this.buildNet(row));
  }

  /** Tek bir programı ÖSYM kılavuz kodundan getirir; bulunamazsa `null` döner. */
  static async getProgram(kilavuzKodu: number | string, signal?: AbortSignal): Promise<Program | null> {
    const code = Number(kilavuzKodu);
    if (!Number.isFinite(code)) {
      throw new YokAtlasValidationError(`kilavuzKodu bir sayı olmalı (alınan: ${String(kilavuzKodu)})`);
    }
    const page = await this.search({ kilavuzKodu: code }, { size: 1, smartSearch: false, signal });
    return page.content[0] ?? null;
  }

  /**
   * Birden çok programı kılavuz koduyla, sınırlı eşzamanlılıkla getirir.
   * Her kod bağımsız çözülür — biri başarısız olursa diğerlerini etkilemez.
   */
  static async getPrograms(
    kilavuzKodlari: (number | string)[],
    options: { concurrency?: number; signal?: AbortSignal } = {},
  ): Promise<{ kilavuzKodu: number | string; status: "fulfilled" | "rejected"; program?: Program | null; reason?: unknown }[]> {
    const { concurrency = 4, signal } = options;
    const results: { kilavuzKodu: number | string; status: "fulfilled" | "rejected"; program?: Program | null; reason?: unknown }[] = new Array(
      kilavuzKodlari.length,
    );

    let index = 0;
    const worker = async (): Promise<void> => {
      while (index < kilavuzKodlari.length) {
        const i = index++;
        const kod = kilavuzKodlari[i];
        try {
          const program = await this.getProgram(kod, signal);
          results[i] = { kilavuzKodu: kod, status: "fulfilled", program };
        } catch (reason) {
          results[i] = { kilavuzKodu: kod, status: "rejected", reason };
        }
      }
    };

    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, kilavuzKodlari.length || 1)) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  /**
   * `search()`'ü sayfa sayfa dolaşıp tüm sonuçları düz bir diziye toplar.
   * `maxPages` güvenlik sınırına takılırsa erken durur.
   */
  static async searchAllPages(filters: SearchFilters = {}, options: SearchAllPagesOptions = {}): Promise<Program[]> {
    const { pageSize = 100, maxPages = 50, sortBy, direction, smartSearch = true, signal } = options;
    const all: Program[] = [];

    // Akıllı (string) alanları bir kez ID'ye çözüp her sayfada aynı ID'leri
    // kullanıyoruz — aksi halde smartSearch'ü sonraki turlarda kapatmak
    // orijinal string filtreleri ID'siz bırakır ve API'ye hiç ulaşmazlardı.
    let resolvedFilters = filters;
    if (smartSearch && (filters.universite != null || filters.program != null || filters.il != null)) {
      await this.ensureLookups(signal);
      resolvedFilters = this.resolveSmartFilters(filters);
    }

    for (let page = 0; page < maxPages; page++) {
      const result = await this.search(resolvedFilters, {
        page,
        size: pageSize,
        sortBy,
        direction,
        smartSearch: false,
        signal,
      });
      all.push(...result.content);
      if (result.last || result.content.length === 0) break;
    }
    return all;
  }

  // ---------------------------------------------------------------------
  // Lookup tabloları
  // ---------------------------------------------------------------------

  /** Tüm üniversiteleri (ID + ad) döner. */
  static async listUniversities(signal?: AbortSignal): Promise<University[]> {
    await this.ensureLookups(signal);
    return [...this.lookupCache!.universities];
  }

  /** Tüm program gruplarını (ID + ad + puan türü) döner. */
  static async listProgramGroups(signal?: AbortSignal): Promise<ProgramGroup[]> {
    await this.ensureLookups(signal);
    return [...this.lookupCache!.programGroups];
  }

  /** Tüm illeri (kod + ad) döner. */
  static async listCities(signal?: AbortSignal): Promise<City[]> {
    await this.ensureLookups(signal);
    return [...this.lookupCache!.cities];
  }

  /** Lookup önbelleğini zorla yeniler. */
  static async refreshLookups(signal?: AbortSignal): Promise<void> {
    this.lookupCache = null;
    await this.fetchLookups(signal);
  }

  /** Lookup önbelleğini boşaltır (bir sonraki çağrıda yeniden çekilir). */
  static clearCache(): void {
    this.lookupCache = null;
  }

  /** Lookup önbelleğinin durumunu (dolu mu, ne zaman çekildi, kaç kayıt var) döner. */
  static getCacheStatus(): LookupCacheStatus {
    const cache = this.lookupCache;
    return {
      cached: cache !== null,
      fetchedAt: cache?.fetchedAt ?? null,
      ageMs: cache ? Date.now() - cache.fetchedAt : null,
      ttlMs: this.lookupCacheTtlMs,
      universiteSayisi: cache?.universities.length ?? 0,
      programGrubuSayisi: cache?.programGroups.length ?? 0,
      ilSayisi: cache?.cities.length ?? 0,
      isOfflineFallback: cache?.isOfflineFallback ?? false,
    };
  }

  /** Serbest yazılmış bir üniversite adını fuzzy eşleştirerek {@link University} kaydına çözer. */
  static async findUniversity(name: string, signal?: AbortSignal): Promise<University> {
    await this.ensureLookups(signal);
    return resolveByName(name, this.lookupCache!.universities, (u) => u.universiteAdi, "üniversite");
  }

  /** Serbest yazılmış bir program adını fuzzy eşleştirerek {@link ProgramGroup} kaydına çözer. */
  static async findProgramGroup(name: string, signal?: AbortSignal): Promise<ProgramGroup> {
    await this.ensureLookups(signal);
    return resolveByName(name, this.lookupCache!.programGroups, (p) => p.birimGrupAdi, "program");
  }

  /** Serbest yazılmış bir il adını fuzzy eşleştirerek {@link City} kaydına çözer. */
  static async findCity(name: string, signal?: AbortSignal): Promise<City> {
    await this.ensureLookups(signal);
    return resolveByName(name, this.lookupCache!.cities, (c) => c.ilAdi, "il");
  }

  // ---------------------------------------------------------------------
  // Kısayol aramalar
  // ---------------------------------------------------------------------

  /** Belirli bir üniversitenin (serbest yazım) tüm programlarını arar. */
  static async searchByUniversity(
    universiteAdi: string,
    filters: Omit<SearchFilters, "universite"> = {},
    options: SearchOptions = {},
  ): Promise<SearchPage<Program>> {
    return this.search({ ...filters, universite: universiteAdi }, options);
  }

  /** Belirli bir program grubunu (serbest yazım) tüm üniversitelerde arar. */
  static async searchByProgram(
    programAdi: string,
    filters: Omit<SearchFilters, "program"> = {},
    options: SearchOptions = {},
  ): Promise<SearchPage<Program>> {
    return this.search({ ...filters, program: programAdi }, options);
  }

  /** Belirli bir ildeki (serbest yazım) tüm programları arar. */
  static async searchByCity(
    ilAdi: string,
    filters: Omit<SearchFilters, "il"> = {},
    options: SearchOptions = {},
  ): Promise<SearchPage<Program>> {
    return this.search({ ...filters, il: ilAdi }, options);
  }

  /** Sadece lisans (4 yıllık) programlarını arar. */
  static async searchLisans(filters: Omit<SearchFilters, "birimTuruId"> = {}, options: SearchOptions = {}): Promise<SearchPage<Program>> {
    return this.search({ ...filters, birimTuruId: 46 }, options);
  }

  /** Sadece ön lisans (2 yıllık) programlarını arar. */
  static async searchOnlisans(filters: Omit<SearchFilters, "birimTuruId"> = {}, options: SearchOptions = {}): Promise<SearchPage<Program>> {
    return this.search({ ...filters, birimTuruId: 47 }, options);
  }

  /** Sadece ücretsiz/tam burslu programları arar. */
  static async searchBurslu(filters: Omit<SearchFilters, "bursOraniId"> = {}, options: SearchOptions = {}): Promise<SearchPage<Program>> {
    return this.search({ ...filters, bursOraniId: 0 }, options);
  }

  /** Belirli bir başarı sırası aralığındaki programları arar (`minBasariSirasi`/`maxBasariSirasi` kısayolu). */
  static async searchByScoreRange(
    range: { min?: number; max?: number },
    filters: Omit<SearchFilters, "minBasariSirasi" | "maxBasariSirasi"> = {},
    options: SearchOptions = {},
  ): Promise<SearchPage<Program>> {
    return this.search({ ...filters, minBasariSirasi: range.min ?? null, maxBasariSirasi: range.max ?? null }, options);
  }

  // ---------------------------------------------------------------------
  // Türetilmiş / çevrimdışı analiz yardımcıları (ekstra ağ isteği yapmaz)
  // ---------------------------------------------------------------------

  /**
   * Kullanıcının kendi başarı sırasını, bir programın güncel yıl kesme
   * sırasıyla karşılaştırarak kaba bir yerleşme tahmini üretir. Sıra ne
   * kadar küçükse o kadar iyi bir konumdur (1. sıra en iyisidir).
   */
  static estimateAdmission(program: Program, basariSirasi: number): AdmissionEstimate {
    const cutoff = program.current.basariSirasi;
    if (cutoff === null) {
      return {
        program,
        basariSirasi,
        cutoffBasariSirasi: null,
        verdict: "belirsiz",
        margin: null,
        message: "Bu program için güncel yıl başarı sırası verisi yok; tahmin yapılamıyor.",
      };
    }

    const margin = basariSirasi - cutoff; // negatif: kullanıcı daha iyi sırada
    const relativeMargin = margin / cutoff;

    let verdict: AdmissionEstimate["verdict"];
    let message: string;
    if (relativeMargin <= -0.1) {
      verdict = "kesine yakın";
      message = `Sıranız (${basariSirasi.toLocaleString("tr-TR")}) geçen yılki kesme sırasından (${cutoff.toLocaleString("tr-TR")}) belirgin şekilde iyi; yerleşme olasılığınız yüksek.`;
    } else if (relativeMargin <= 0) {
      verdict = "olası";
      message = `Sıranız (${basariSirasi.toLocaleString("tr-TR")}) geçen yılki kesme sırasından (${cutoff.toLocaleString("tr-TR")}) iyi; yerleşmeniz olası ama kesin değil.`;
    } else if (relativeMargin <= 0.1) {
      verdict = "sınırda";
      message = `Sıranız (${basariSirasi.toLocaleString("tr-TR")}) geçen yılki kesme sırasına (${cutoff.toLocaleString("tr-TR")}) yakın; sınırda bir durum.`;
    } else {
      verdict = "zayıf";
      message = `Sıranız (${basariSirasi.toLocaleString("tr-TR")}) geçen yılki kesme sırasından (${cutoff.toLocaleString("tr-TR")}) belirgin şekilde geride; yerleşme olasılığınız düşük.`;
    }

    return { program, basariSirasi, cutoffBasariSirasi: cutoff, verdict, margin, message };
  }

  /** İki programı güncel yıl rekabet düzeyi (başarı sırası) ve kontenjan açısından karşılaştırır. */
  static compare(a: Program, b: Program): ProgramComparison {
    const aScore = a.current.basariSirasi;
    const bScore = b.current.basariSirasi;
    let moreCompetitive: ProgramComparison["moreCompetitive"] = "belirsiz";
    if (aScore !== null && bScore !== null) {
      if (aScore < bScore) moreCompetitive = "a";
      else if (bScore < aScore) moreCompetitive = "b";
      else moreCompetitive = "eşit";
    }

    const scoreDiff = aScore !== null && bScore !== null ? aScore - bScore : null;
    const aQuota = a.current.kontenjan;
    const bQuota = b.current.kontenjan;
    const quotaDiff = aQuota !== null && bQuota !== null ? aQuota - bQuota : null;

    return { a, b, moreCompetitive, scoreDiff, quotaDiff };
  }

  /**
   * Bir programın `history` + `current` verisindeki başarı sırası dizisine
   * bakarak eğilimini ("yükseliyor"/"düşüyor"/"sabit") kestirir. Başarı
   * sırasının küçülmesi programın *daha* rekabetçi hale geldiği anlamına gelir.
   */
  static getTrend(program: Program): ProgramTrend {
    const series = [...program.history]
      .slice()
      .reverse()
      .concat(program.current)
      .map((s) => ({ year: s.year, basariSirasi: s.basariSirasi }));

    const known = series.filter((s) => s.basariSirasi !== null) as { year: number; basariSirasi: number }[];
    if (known.length < 2) {
      return { program, direction: "belirsiz", series, message: "Eğilim hesaplamak için yeterli yıllık veri yok." };
    }

    const first = known[0].basariSirasi;
    const last = known[known.length - 1].basariSirasi;
    const changeRatio = (last - first) / first;

    let direction: ProgramTrend["direction"];
    let message: string;
    if (changeRatio <= -0.05) {
      direction = "yükseliyor";
      message = `Başarı sırası ${known[0].year}'den ${known[known.length - 1].year}'e küçülmüş (${first.toLocaleString("tr-TR")} → ${last.toLocaleString("tr-TR")}); program giderek daha rekabetçi hale geliyor.`;
    } else if (changeRatio >= 0.05) {
      direction = "düşüyor";
      message = `Başarı sırası ${known[0].year}'den ${known[known.length - 1].year}'e büyümüş (${first.toLocaleString("tr-TR")} → ${last.toLocaleString("tr-TR")}); programın rekabet düzeyi azalıyor.`;
    } else {
      direction = "sabit";
      message = `Başarı sırası ${known[0].year}'den ${known[known.length - 1].year}'e büyük ölçüde stabil kalmış (${first.toLocaleString("tr-TR")} → ${last.toLocaleString("tr-TR")}).`;
    }

    return { program, direction, series, message };
  }

  /** Bir program dizisini, verilen anahtar fonksiyonuna göre gruplar. */
  static groupBy<K extends string | number>(programs: Program[], keyFn: (p: Program) => K): Record<K, Program[]> {
    const result = {} as Record<K, Program[]>;
    for (const program of programs) {
      const key = keyFn(program);
      if (!result[key]) result[key] = [];
      result[key].push(program);
    }
    return result;
  }

  /** Bir program dizisini güncel yıl başarı sırasına göre sıralar (varsayılan: küçükten büyüğe / en iyi önce). */
  static sortByScore(programs: Program[], direction: "asc" | "desc" = "asc"): Program[] {
    const withScore = programs.filter((p) => p.current.basariSirasi !== null);
    const withoutScore = programs.filter((p) => p.current.basariSirasi === null);
    withScore.sort((a, b) => {
      const diff = (a.current.basariSirasi as number) - (b.current.basariSirasi as number);
      return direction === "asc" ? diff : -diff;
    });
    return [...withScore, ...withoutScore];
  }

  /** Bir programı tek satırlık okunur bir özet metnine çevirir (log/konsol için). */
  static formatSummary(program: Program): string {
    const puan = program.current.minPuan !== null ? program.current.minPuan.toLocaleString("tr-TR") : "—";
    const sira = program.current.basariSirasi !== null ? program.current.basariSirasi.toLocaleString("tr-TR") : "—";
    return `${program.universiteAdi} — ${program.birimAdi} (${program.puanTuru}, ${program.current.year}) | Puan: ${puan} · Sıra: ${sira}`;
  }

  /**
   * Bir programın tüm yıllara ait verilerini döner.
   * Listenin ilk elemanı güncel yıldır (current), devamı ise geriye dönük 3 yıldır (history).
   */
  static getAllYears(program: Program): YearlyStats[] {
    return program.allYears ?? [program.current, ...program.history];
  }

  /**
   * Kullanıcının TYT/AYT deneme netlerini bir programın Net Sihirbazı (son yerleşen)
   * verileriyle kıyaslar; ders bazında farkları ve toplam net durumunu analiz eder.
   */
  static compareNets(userNets: UserNetScores, targetNet: Net): NetComparison {
    const lessons: LessonNetDiff[] = [];
    let totalUserNet = 0;
    let totalTargetNet = 0;
    const aheadLessons: string[] = [];
    const behindLessons: string[] = [];

    for (const def of NET_DERSLERI) {
      const targetVal = targetNet[def.key as keyof Net] as number | null | undefined;
      const userVal = userNets[def.key as keyof UserNetScores] as number | null | undefined;

      const hasTarget = targetVal !== null && targetVal !== undefined;
      const hasUser = userVal !== null && userVal !== undefined;

      if (hasTarget || hasUser) {
        const target = typeof targetVal === "number" ? targetVal : 0;
        const user = typeof userVal === "number" ? userVal : 0;
        const diff = Math.round((user - target) * 100) / 100;
        totalUserNet += user;
        totalTargetNet += target;

        let status: LessonNetDiff["status"] = "equal";
        if (diff > 0) {
          status = "ahead";
          aheadLessons.push(def.label);
        } else if (diff < 0) {
          status = "behind";
          behindLessons.push(def.label);
        }

        lessons.push({
          lessonKey: def.key,
          lessonName: def.label,
          userNet: user,
          targetNet: target,
          diff,
          status,
        });
      }
    }

    const totalDiff = Math.round((totalUserNet - totalTargetNet) * 100) / 100;
    let summary = "";
    if (totalDiff > 0) {
      summary = `Toplamda +${totalDiff} net öndesiniz (${aheadLessons.length} derste daha yüksek).`;
    } else if (totalDiff < 0) {
      summary = `Toplamda ${totalDiff} net geridesiniz (${behindLessons.length} derste artış gerekiyor).`;
    } else {
      summary = "Net toplamınız hedef programın son yerleşen netleriyle tam olarak başa baş.";
    }

    return {
      program: {
        kilavuzKodu: targetNet.kilavuzKodu,
        universiteAdi: targetNet.universiteAdi,
        birimAdi: targetNet.birimAdi,
        puanTuru: targetNet.puanTuru,
        yil: targetNet.yil,
        tabanPuan: targetNet.tabanPuan,
      },
      lessons,
      totalUserNet: Math.round(totalUserNet * 100) / 100,
      totalTargetNet: Math.round(totalTargetNet * 100) / 100,
      totalDiff,
      aheadLessons,
      behindLessons,
      summary,
    };
  }

  /**
   * Bir program için ÖSYM yasal başarı sırası baraj şartının (Tıp 50k, Hukuk 125k,
   * Mühendislik 300k vb.) sağlanıp sağlanmadığını denetler.
   */
  static checkPrerequisites(program: Program, basariSirasi: number): PrerequisiteCheck {
    const name = `${program.birimAdi} ${program.birimGrupAdi ?? ""}`.toLocaleLowerCase("tr-TR");
    let category: PrerequisiteCheck["category"] = null;

    if (name.includes("diş hekimliği")) {
      category = "DIS";
    } else if (name.includes("eczacılık")) {
      category = "ECZACILIK";
    } else if (name.includes("tıp") && !name.includes("veteriner") && !name.includes("tıbbi") && !name.includes("biyomedikal")) {
      category = "TIP";
    } else if (name.includes("hukuk")) {
      category = "HUKUK";
    } else if (name.includes("mimarlık") && !name.includes("iç mimarlık") && !name.includes("peyzaj")) {
      category = "MIMARLIK";
    } else if (
      (name.includes("mühendisliği") || name.includes("mühendislik")) &&
      !name.includes("ziraat") &&
      !name.includes("su ürünleri") &&
      !name.includes("orman") &&
      !name.includes("ağaç işleri")
    ) {
      category = "MUHENDISLIK";
    } else if (name.includes("öğretmenliği") || name.includes("rehberlik ve psikolojik danışmanlık")) {
      category = "OGRETMENLIK";
    }

    if (category) {
      const baraj = OSYM_BARAJLARI[category];
      const eligible = basariSirasi <= baraj.barajSira;
      const margin = basariSirasi - baraj.barajSira;
      const message = eligible
        ? `ÖSYM ${baraj.categoryName} başarı sırası baraj şartını (${baraj.barajSira.toLocaleString("tr-TR")}) sağlıyorsunuz (Sıranız: ${basariSirasi.toLocaleString("tr-TR")}).`
        : `ÖSYM ${baraj.categoryName} için en az ilk ${baraj.barajSira.toLocaleString("tr-TR")} içinde olma şartı aramaktadır. Sıranız (${basariSirasi.toLocaleString("tr-TR")}) bu barajın dışında kaldığı için tercih yapılamaz.`;

      return {
        program,
        basariSirasi,
        category,
        categoryName: baraj.categoryName,
        barajSira: baraj.barajSira,
        eligible,
        margin,
        message,
      };
    }

    return {
      program,
      basariSirasi,
      category: null,
      categoryName: null,
      barajSira: null,
      eligible: true,
      margin: null,
      message: "Bu program için ÖSYM başarı sırası baraj şartı bulunmamaktadır.",
    };
  }

  /**
   * Tercih listesini bütünsel olarak inceler; tercihleri güvenlik seviyelerine göre
   * (güvenli / ideal / hayal) sınıflandırır, yasal baraj takılmalarını ve olası ölü
   * tercih sıralama hatalarını tespit eder.
   */
  static validatePreferenceList(
    preferences: (PreferenceInput | Program)[],
    userRank: number,
  ): PreferenceListAnalysis {
    const items: AnalyzedPreferenceItem[] = [];
    const tierCounts = { guvenli: 0, ideal: 0, hayal: 0, belirsiz: 0 };
    const warnings: string[] = [];

    preferences.forEach((pref, idx) => {
      const isInput = typeof pref === "object" && pref !== null && "program" in pref;
      const program: Program = isInput ? (pref as PreferenceInput).program : (pref as Program);
      const userOrder = isInput && typeof (pref as PreferenceInput).userOrder === "number"
        ? (pref as PreferenceInput).userOrder!
        : idx + 1;

      const estimate = this.estimateAdmission(program, userRank);
      const prerequisite = this.checkPrerequisites(program, userRank);

      let tier: AnalyzedPreferenceItem["tier"] = "belirsiz";
      if (estimate.verdict === "kesine yakın") {
        tier = "güvenli";
        tierCounts.guvenli++;
      } else if (estimate.verdict === "olası" || estimate.verdict === "sınırda") {
        tier = "ideal";
        tierCounts.ideal++;
      } else if (estimate.verdict === "zayıf") {
        tier = "hayal";
        tierCounts.hayal++;
      } else {
        tierCounts.belirsiz++;
      }

      let warning: string | undefined;
      if (!prerequisite.eligible) {
        warning = `Baraj engeli: ${prerequisite.message}`;
        warnings.push(`${userOrder}. Tercih (${program.universiteAdi} - ${program.birimAdi}): ${prerequisite.message}`);
      }

      items.push({
        userOrder,
        program,
        tier,
        estimate,
        prerequisite,
        warning,
      });
    });

    for (let i = 0; i < items.length - 1; i++) {
      const curr = items[i];
      const next = items[i + 1];
      const currCutoff = curr.program.current.basariSirasi;
      const nextCutoff = next.program.current.basariSirasi;
      if (currCutoff !== null && nextCutoff !== null) {
        if (nextCutoff < currCutoff * 0.7) {
          warnings.push(
            `Olası ölü tercih: ${next.userOrder}. tercih (${next.program.birimAdi} - ${nextCutoff.toLocaleString("tr-TR")}) kesme sırası olarak ${curr.userOrder}. tercihten (${curr.program.birimAdi} - ${currCutoff.toLocaleString("tr-TR")}) belirgin şekilde daha yüksek, ancak daha alt sıraya yazılmış.`
          );
        }
      }
    }

    let overallAdvice = "";
    if (tierCounts.guvenli === 0) {
      overallAdvice = "Listenizde 'güvenli' kategorisinde hiç tercih bulunmuyor. Açıkta kalma riskini azaltmak için sıranızın gerisinde birkaç garanti tercih eklemeniz önerilir.";
    } else if (tierCounts.ideal === 0 && tierCounts.hayal > 0) {
      overallAdvice = "Listeniz ağırlıklı olarak hayal tercihlerden oluşuyor. Sıranıza yakın 'ideal' tercihler eklemek yerleşme şansınızı dengeler.";
    } else {
      overallAdvice = `Listeniz dengeli görünüyor: ${tierCounts.hayal} hayal, ${tierCounts.ideal} ideal, ${tierCounts.guvenli} güvenli tercih bulunuyor.`;
    }

    return {
      userRank,
      totalPreferences: items.length,
      tierCounts,
      items,
      warnings,
      overallAdvice,
    };
  }

  // ---------------------------------------------------------------------
  // İç mekanizma — lookup önbelleği
  // ---------------------------------------------------------------------

  private static async ensureLookups(signal?: AbortSignal): Promise<void> {
    const cache = this.lookupCache;
    const fresh = cache !== null && (this.lookupCacheTtlMs <= 0 || Date.now() - cache.fetchedAt < this.lookupCacheTtlMs);
    if (fresh) return;
    await this.fetchLookups(signal);
  }

  private static async fetchLookups(signal?: AbortSignal): Promise<void> {
    try {
      const [universities, programGroups, cities] = await Promise.all([
        this.getJson<University[]>(UNIVERSITIES_PATH, signal),
        this.getJson<ProgramGroup[]>(PROGRAMS_PATH, signal),
        this.getJson<City[]>(CITIES_PATH, signal),
      ]);
      this.lookupCache = {
        universities,
        programGroups,
        cities,
        fetchedAt: Date.now(),
        isOfflineFallback: false,
      };
    } catch (err) {
      if (this.offlineFallback) {
        this.lookupCache = {
          universities: LOOKUP_SNAPSHOT.universities,
          programGroups: LOOKUP_SNAPSHOT.programGroups,
          cities: LOOKUP_SNAPSHOT.cities,
          fetchedAt: Date.now(),
          isOfflineFallback: true,
        };
        return;
      }
      throw err;
    }
  }

  private static resolveSmartFilters(filters: SearchFilters): SearchFilters {
    const cache = this.lookupCache!;
    const resolved: SearchFilters = { ...filters };

    if (filters.universite != null) {
      const names = Array.isArray(filters.universite) ? filters.universite : [filters.universite];
      resolved.universiteId = names.map((n) => resolveByName(n, cache.universities, (u) => u.universiteAdi, "üniversite").universiteId);
      resolved.universite = null;
    }
    if (filters.program != null) {
      const names = Array.isArray(filters.program) ? filters.program : [filters.program];
      resolved.birimGrupId = names.map((n) => resolveByName(n, cache.programGroups, (p) => p.birimGrupAdi, "program").birimGrupId);
      resolved.program = null;
    }
    if (filters.il != null) {
      const names = Array.isArray(filters.il) ? filters.il : [filters.il];
      resolved.ilKodu = names.map((n) => resolveByName(n, cache.cities, (c) => c.ilAdi, "il").ilKodu);
      resolved.il = null;
    }
    return resolved;
  }

  private static resolveNetSmartFilters(filters: NetFilters): NetFilters {
    const cache = this.lookupCache!;
    const resolved: NetFilters = { ...filters };

    if (filters.universite != null) {
      resolved.universiteId = resolveByName(filters.universite, cache.universities, (u) => u.universiteAdi, "üniversite").universiteId;
      resolved.universite = null;
    }
    if (filters.program != null) {
      const resolvedProgram = resolveByName(filters.program, cache.programGroups, (p) => p.birimGrupAdi, "program");
      resolved.birimGrupId = resolvedProgram.birimGrupId;
      resolved.program = null;
      if (filters.puanTuru == null) {
        resolved.puanTuru = resolvedProgram.puanTuru as PuanTuru;
      }
    }
    return resolved;
  }

  // ---------------------------------------------------------------------
  // İç mekanizma — payload/response dönüşümleri
  // ---------------------------------------------------------------------

  private static normalizePuanTuru(value?: PuanTuru | string | null): string | null {
    if (!value) return null;
    const upper = value.toUpperCase();
    if (upper === "SOZ") return "SÖZ";
    if (upper === "DIL") return "DİL";
    return upper;
  }

  private static validateFilterCollisions(f: SearchFilters): void {
    if (f.universite != null && f.universiteId != null && f.universiteId.length > 0) {
      throw new YokAtlasValidationError("universite (akıllı serbest metin) ile universiteId (sayısal ID) aynı anda verilemez.");
    }
    if (f.program != null && f.birimGrupId != null && f.birimGrupId.length > 0) {
      throw new YokAtlasValidationError("program (akıllı serbest metin) ile birimGrupId (sayısal ID) aynı anda verilemez.");
    }
    if (f.il != null && f.ilKodu != null && f.ilKodu.length > 0) {
      throw new YokAtlasValidationError("il (akıllı serbest metin) ile ilKodu (sayısal ID) aynı anda verilemez.");
    }
  }

  private static validateNetFilterCollisions(f: NetFilters): void {
    if (f.universite != null && f.universiteId != null) {
      throw new YokAtlasValidationError("universite (akıllı serbest metin) ile universiteId aynı anda verilemez.");
    }
    if (f.program != null && f.birimGrupId != null) {
      throw new YokAtlasValidationError("program (akıllı serbest metin) ile birimGrupId aynı anda verilemez.");
    }
  }

  private static filtersToPayload(f: SearchFilters): Record<string, unknown> {
    let birimTuruId = f.birimTuruId ?? null;
    if (birimTuruId == null && f.degreeType) {
      birimTuruId = DEGREE_TYPE_MAP[f.degreeType.toLowerCase()] ?? null;
    }

    let bursOraniId = f.bursOraniId ?? null;
    if (bursOraniId == null && f.bursTuru) {
      bursOraniId = BURS_TURU_MAP[f.bursTuru.toLowerCase()] ?? null;
    }

    let ogrenimTuruId = f.ogrenimTuruId ?? null;
    if (ogrenimTuruId == null && f.ogrenimTuru) {
      ogrenimTuruId = OGRENIM_TURU_MAP[f.ogrenimTuru.toLowerCase()] ?? null;
    }

    return {
      puanTuru: this.normalizePuanTuru(f.puanTuru),
      universiteId: f.universiteId ?? [],
      birimGrupId: f.birimGrupId ?? [],
      ilKodu: f.ilKodu ?? [],
      birimTuruId,
      universiteTuru: f.universiteTuru ?? null,
      bursOraniId,
      ogrenimTuruId,
      kilavuzKodu: f.kilavuzKodu ?? null,
      minBasariSirasi: f.minBasariSirasi ?? null,
      maxBasariSirasi: f.maxBasariSirasi ?? null,
    };
  }

  private static netFiltersToPayload(f: NetFilters): Record<string, unknown> {
    return {
      puanTuru: this.normalizePuanTuru(f.puanTuru),
      universiteId: f.universiteId ?? null,
      birimGrupId: f.birimGrupId ?? null,
      birimTuruId: f.birimTuruId ?? null,
      universiteTuru: f.universiteTuru ?? null,
      yil: f.yil != null ? String(f.yil) : null,
      katsayi: f.katsayi ?? null,
    };
  }

  private static toSearchPage<T>(raw: RawRow, mapRow: (row: RawRow) => T): SearchPage<T> {
    const content: RawRow[] = Array.isArray(raw.content) ? raw.content : [];
    return {
      content: content.map(mapRow),
      totalElements: Number(raw.totalElements ?? content.length),
      totalPages: Number(raw.totalPages ?? 1),
      size: Number(raw.size ?? content.length),
      number: Number(raw.number ?? 0),
      first: Boolean(raw.first ?? true),
      last: Boolean(raw.last ?? true),
      numberOfElements: Number(raw.numberOfElements ?? content.length),
      empty: Boolean(raw.empty ?? content.length === 0),
      yil: raw.yil != null ? Number(raw.yil) : null,
      source: (raw.source as string | undefined) ?? null,
    };
  }

  private static normalizeOnlisansSpelling(row: RawRow): RawRow {
    if (row.birimTuruAdi === "ÖNLISANS") {
      return { ...row, birimTuruAdi: "ONLISANS" };
    }
    return row;
  }

  private static toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private static buildYearlyStats(row: RawRow, suffix: string, year: number): YearlyStats {
    const stats = { year } as YearlyStats;
    for (const [field, apiBase] of Object.entries(YEARLY_OFFSET_FIELDS) as [keyof Omit<YearlyStats, "year">, string][]) {
      stats[field] = this.toNumber(row[`${apiBase}${suffix}`]);
    }
    return stats;
  }

  private static buildProgram(rawRow: RawRow): Program {
    const row = this.normalizeOnlisansSpelling(rawRow);
    const year = this.toNumber(row.yil) ?? 0;
    const current = this.buildYearlyStats(row, "", year);
    const history = [1, 2, 3].map((offset) => this.buildYearlyStats(row, String(offset), year - offset));
    const allYears = [current, ...history];

    return {
      osymKilavuzId: this.toNumber(row.osymKilavuzId),
      sinav: row.sinav ?? null,
      yil: year,
      donem: row.donem ?? null,
      tabloTuru: row.tabloTuru ?? null,
      birimId: this.toNumber(row.birimId),
      birimHiyerarsi: row.birimHiyerarsi ?? null,
      kilavuzKodu: this.toNumber(row.kilavuzKodu) as number,

      universiteId: this.toNumber(row.universiteId) as number,
      universiteAdi: row.universiteAdi,
      uniIlKodu: this.toNumber(row.uniIlKodu),
      uniIlAdi: row.uniIlAdi ?? null,
      uniIlceKodu: this.toNumber(row.uniIlceKodu),
      uniIlceAdi: row.uniIlceAdi ?? null,

      fymkId: this.toNumber(row.fymkId),
      fymkAdi: row.fymkAdi ?? null,
      fymkIlKodu: this.toNumber(row.fymkIlKodu),
      fymkIlAdi: row.fymkIlAdi ?? null,
      fymkIlceKodu: this.toNumber(row.fymkIlceKodu),
      fymkIlceAdi: row.fymkIlceAdi ?? null,

      birimAdi: row.birimAdi,
      birimGrupId: this.toNumber(row.birimGrupId),
      birimGrupAdi: row.birimGrupAdi ?? null,
      birimTuruId: this.toNumber(row.birimTuruId),
      birimTuruAdi: row.birimTuruAdi,

      ogrenimTuruId: this.toNumber(row.ogrenimTuruId),
      ogrenimTuruAdi: row.ogrenimTuruAdi ?? null,
      ogrenimSuresi: this.toNumber(row.ogrenimSuresi),
      puanTuru: row.puanTuru,
      ogrenimDiliId: this.toNumber(row.ogrenimDiliId),
      ogrenimDiliAdi: row.ogrenimDiliAdi ?? null,
      bursOraniId: this.toNumber(row.bursOraniId),
      bursOraniAdi: row.bursOraniAdi ?? null,

      ilKodu: this.toNumber(row.ilKodu),
      ilAdi: row.ilAdi ?? null,
      ilceKodu: this.toNumber(row.ilceKodu),
      ilceAdi: row.ilceAdi ?? null,
      universiteTuru: row.universiteTuru,

      current,
      history,
      allYears,
    };
  }

  private static buildNet(rawRow: RawRow): Net {
    const row = this.normalizeOnlisansSpelling(rawRow);
    return {
      yil: this.toNumber(row.yil) as number,
      kilavuzKodu: this.toNumber(row.kilavuzKodu) as number,
      puanTuru: row.puanTuru,
      katsayi: this.toNumber(row.katsayi),
      tabanPuan: this.toNumber(row.tabanPuan),
      obp: this.toNumber(row.obp),

      tytTrkNet: this.toNumber(row.tytTrkNet),
      tytSosNet: this.toNumber(row.tytSosNet),
      tytMatNet: this.toNumber(row.tytMatNet),
      tytFenNet: this.toNumber(row.tytFenNet),

      aytMatNet: this.toNumber(row.aytMatNet),
      aytFizNet: this.toNumber(row.aytFizNet),
      aytKimNet: this.toNumber(row.aytKimNet),
      aytBioNet: this.toNumber(row.aytBioNet),

      aytTdeNet: this.toNumber(row.aytTdeNet),
      aytTrh1Net: this.toNumber(row.aytTrh1Net),
      aytCog1Net: this.toNumber(row.aytCog1Net),
      aytTrh2Net: this.toNumber(row.aytTrh2Net),
      aytCog2Net: this.toNumber(row.aytCog2Net),
      aytFelNet: this.toNumber(row.aytFelNet),
      aytDinNet: this.toNumber(row.aytDinNet),

      ydtYdilNet: this.toNumber(row.ydtYdilNet),

      universiteId: this.toNumber(row.universiteId) as number,
      universiteAdi: row.universiteAdi,
      birimGrupId: this.toNumber(row.birimGrupId),
      birimGrupAdi: row.birimGrupAdi ?? null,
      birimId: this.toNumber(row.birimId),
      birimAdi: row.birimAdi,
      birimTuruId: this.toNumber(row.birimTuruId),
      birimTuruAdi: row.birimTuruAdi,
      universiteTuru: row.universiteTuru,
    };
  }

  // ---------------------------------------------------------------------
  // İç mekanizma — HTTP taşıma katmanı
  // ---------------------------------------------------------------------

  private static async getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: "GET", signal });
  }

  private static async postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body), signal });
  }

  private static async request<T>(path: string, init: { method: "GET" | "POST"; body?: string; signal?: AbortSignal }): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), this.timeoutMs);
      const onExternalAbort = (): void => timeoutController.abort();
      init.signal?.addEventListener("abort", onExternalAbort);

      try {
        const response = await fetch(url, {
          method: init.method,
          headers: {
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            "User-Agent": this.userAgent,
          },
          body: init.body,
          signal: timeoutController.signal,
        });
        return await this.handleResponse<T>(response, path);
      } catch (error) {
        lastError = error;
        if (error instanceof YokAtlasAPIError) throw error;
        if (init.signal?.aborted) {
          throw new YokAtlasAPIError(`İstek iptal edildi: ${path}`, { cause: error });
        }
        if (attempt === this.maxRetries) {
          throw new YokAtlasAPIError(`YÖK Atlas API isteği başarısız: ${path}`, { cause: error });
        }
        // Ağ hatası — kısa bir bekleme sonrası yeniden dene.
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      } finally {
        clearTimeout(timeoutId);
        init.signal?.removeEventListener("abort", onExternalAbort);
      }
    }

    throw new YokAtlasAPIError(`YÖK Atlas API isteği başarısız: ${path}`, { cause: lastError });
  }

  private static async handleResponse<T>(response: Response, path: string): Promise<T> {
    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      const message = `YÖK Atlas API hatası ${response.status}: ${path}`;
      if (response.status === 404) throw new YokAtlasNotFoundError(message, { status: response.status, body });
      if (response.status === 418 || response.status === 429) throw new YokAtlasRateLimitError(message, { status: response.status, body });
      throw new YokAtlasAPIError(message, { status: response.status, body });
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new YokAtlasAPIError(`YÖK Atlas API yanıtı JSON olarak ayrıştırılamadı: ${path}`, { status: response.status, cause: error });
    }
  }
}
