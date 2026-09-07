import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YokAtlas } from "../src/yokatlas";
import { YokAtlasLookupError, YokAtlasNotFoundError, YokAtlasValidationError } from "../src/errors";

const UNIVERSITIES = [
  { universiteId: 1, universiteAdi: "BOĞAZİÇİ ÜNİVERSİTESİ" },
  { universiteId: 2, universiteAdi: "ORTA DOĞU TEKNİK ÜNİVERSİTESİ" },
];
const PROGRAM_GROUPS = [
  { birimGrupId: 10, birimGrupAdi: "BİLGİSAYAR MÜHENDİSLİĞİ", puanTuru: "SAY" },
  { birimGrupId: 11, birimGrupAdi: "HUKUK", puanTuru: "SÖZ" },
];
const CITIES = [
  { ilKodu: 34, ilAdi: "İSTANBUL" },
  { ilKodu: 6, ilAdi: "ANKARA" },
];

function makeProgramRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    yil: 2025,
    kilavuzKodu: 102210277,
    universiteId: 1,
    universiteAdi: "BOĞAZİÇİ ÜNİVERSİTESİ",
    birimAdi: "Bilgisayar Mühendisliği",
    birimGrupId: 10,
    birimGrupAdi: "BİLGİSAYAR MÜHENDİSLİĞİ",
    birimTuruAdi: "LISANS",
    puanTuru: "SAY",
    universiteTuru: "DEVLET",
    kontenjan: 80,
    gkY: 78,
    minPuan: 545.12,
    basariSirasi: 1200,
    kontenjan1: 80,
    gkY1: 79,
    minPuan1: 540.5,
    basariSirasi1: 1300,
    kontenjan2: 75,
    gkY2: 75,
    minPuan2: 538.2,
    basariSirasi2: 1400,
    kontenjan3: 75,
    gkY3: 74,
    minPuan3: 536.9,
    basariSirasi3: 1500,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchSequence(responses: (Response | (() => Response))[]): void {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const entry = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return typeof entry === "function" ? entry() : entry;
    }),
  );
}

function mockLookupsThen(...pageResponses: unknown[]): void {
  mockFetchSequence([
    jsonResponse(UNIVERSITIES),
    jsonResponse(PROGRAM_GROUPS),
    jsonResponse(CITIES),
    ...pageResponses.map((body) => jsonResponse(body)),
  ]);
}

beforeEach(() => {
  YokAtlas.clearCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("YokAtlas.search", () => {
  it("bir programı current/history yıllık istatistiklerine gruplar", async () => {
    mockFetchSequence([
      jsonResponse({
        content: [makeProgramRow()],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 1,
        empty: false,
      }),
    ]);

    const page = await YokAtlas.search({ kilavuzKodu: 102210277 }, { smartSearch: false });

    expect(page.totalElements).toBe(1);
    expect(page.content).toHaveLength(1);
    const program = page.content[0];
    expect(program.current.year).toBe(2025);
    expect(program.current.basariSirasi).toBe(1200);
    expect(program.history).toHaveLength(3);
    expect(program.history[0]).toMatchObject({ year: 2024, basariSirasi: 1300 });
    expect(program.history[2]).toMatchObject({ year: 2022, basariSirasi: 1500 });
  });

  it("ÖNLISANS yazımını ONLISANS'a normalize eder", async () => {
    mockFetchSequence([
      jsonResponse({
        content: [makeProgramRow({ birimTuruAdi: "ÖNLISANS" })],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 1,
        empty: false,
      }),
    ]);

    const page = await YokAtlas.search({}, { smartSearch: false });
    expect(page.content[0].birimTuruAdi).toBe("ONLISANS");
  });

  it("akıllı (string) filtreleri lookup üzerinden ID'ye çözer", async () => {
    mockLookupsThen({
      content: [makeProgramRow()],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
      numberOfElements: 1,
      empty: false,
    });

    const page = await YokAtlas.search({ universite: "boğazici", program: "bilgisayar mühendisliği" });
    expect(page.content).toHaveLength(1);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const searchCall = fetchMock.mock.calls[3];
    const body = JSON.parse(searchCall[1].body as string);
    expect(body.filters.universiteId).toEqual([1]);
    expect(body.filters.birimGrupId).toEqual([10]);
  });

  it("çözümlenemeyen bir akıllı filtrede YokAtlasLookupError fırlatır", async () => {
    mockLookupsThen();
    await expect(YokAtlas.search({ universite: "tamamen alakasız bir şey xyz" })).rejects.toThrow(YokAtlasLookupError);
  });
});

describe("YokAtlas.getProgram", () => {
  it("kılavuz kodu bulunamazsa null döner", async () => {
    mockFetchSequence([
      jsonResponse({
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 1,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 0,
        empty: true,
      }),
    ]);
    const program = await YokAtlas.getProgram(999999999);
    expect(program).toBeNull();
  });

  it("geçersiz kılavuz kodunda YokAtlasValidationError fırlatır", async () => {
    await expect(YokAtlas.getProgram("abc")).rejects.toThrow(YokAtlasValidationError);
  });

  it("HTTP 404 durumunda YokAtlasNotFoundError fırlatır", async () => {
    mockFetchSequence([jsonResponse({ error: "not found" }, 404)]);
    await expect(YokAtlas.getProgram(1)).rejects.toThrow(YokAtlasNotFoundError);
  });
});

describe("YokAtlas lookup yardımcıları", () => {
  it("findUniversity Türkçe karakter/typo farklarını tolere eder", async () => {
    mockFetchSequence([jsonResponse(UNIVERSITIES), jsonResponse(PROGRAM_GROUPS), jsonResponse(CITIES)]);
    const uni = await YokAtlas.findUniversity("bogazici");
    expect(uni.universiteId).toBe(1);
  });

  it("getCacheStatus önbellek doluluğunu doğru raporlar", async () => {
    expect(YokAtlas.getCacheStatus().cached).toBe(false);
    mockFetchSequence([jsonResponse(UNIVERSITIES), jsonResponse(PROGRAM_GROUPS), jsonResponse(CITIES)]);
    await YokAtlas.listUniversities();
    const status = YokAtlas.getCacheStatus();
    expect(status.cached).toBe(true);
    expect(status.universiteSayisi).toBe(2);
  });
});

describe("çevrimdışı analiz yardımcıları", () => {
  it("estimateAdmission kullanıcı sırası kesmeden iyiyse 'kesine yakın' döner", () => {
    const row = makeProgramRow();
    const program = { ...row } as unknown as Parameters<typeof YokAtlas.estimateAdmission>[0];
    // current.basariSirasi = 1200; kullanıcı sırası çok daha iyi (küçük)
    const built = { current: { basariSirasi: 1200 } } as never;
    const estimate = YokAtlas.estimateAdmission(built, 500);
    expect(estimate.verdict).toBe("kesine yakın");
  });

  it("getTrend başarı sırası küçülüyorsa 'yükseliyor' döner", () => {
    const program = {
      current: { year: 2025, basariSirasi: 1000 },
      history: [
        { year: 2024, basariSirasi: 1100 },
        { year: 2023, basariSirasi: 1300 },
        { year: 2022, basariSirasi: 1500 },
      ],
    } as never;
    const trend = YokAtlas.getTrend(program);
    expect(trend.direction).toBe("yükseliyor");
  });

  it("compare daha iyi (küçük) başarı sırasına sahip programı 'a' ya da 'b' olarak işaretler", () => {
    const a = { current: { basariSirasi: 500, kontenjan: 50 } } as never;
    const b = { current: { basariSirasi: 1500, kontenjan: 30 } } as never;
    const result = YokAtlas.compare(a, b);
    expect(result.moreCompetitive).toBe("a");
    expect(result.quotaDiff).toBe(20);
  });

  it("degreeType ve bursTuru filtrelerini doğru ID'lere dönüştürür", async () => {
    mockFetchSequence([
      jsonResponse({
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 20,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 0,
        empty: true,
      }),
    ]);
    await YokAtlas.search({ degreeType: "bachelor", bursTuru: "ucretsiz" });
    const fetchMock = vi.mocked(fetch);
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.filters.birimTuruId).toBe(46);
    expect(body.filters.bursOraniId).toBe(0);
  });

  it("hem akıllı filtre hem de ID verildiğinde YokAtlasValidationError fırlatır", async () => {
    await expect(
      YokAtlas.search({ universite: "boğaziçi", universiteId: [1] }),
    ).rejects.toThrow(YokAtlasValidationError);
  });

  it("allYears ve YokAtlas.getAllYears kronolojik veriyi tam döner", async () => {
    mockFetchSequence([
      jsonResponse({
        content: [makeProgramRow()],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 1,
        empty: false,
      }),
    ]);
    const res = await YokAtlas.search();
    const prog = res.content[0];
    expect(prog.allYears.length).toBe(4);
    expect(prog.allYears[0].year).toBe(2025);
    expect(prog.allYears[1].year).toBe(2024);
    expect(YokAtlas.getAllYears(prog).length).toBe(4);
  });

  it("compareNets öğrencinin deneme netlerini hedef programla kıyaslar", () => {
    const targetNet: any = {
      kilavuzKodu: 102210277,
      universiteAdi: "BOĞAZİÇİ",
      birimAdi: "Bilgisayar",
      puanTuru: "SAY",
      yil: 2024,
      tabanPuan: 545,
      tytMatNet: 35.0,
      aytMatNet: 38.0,
      aytFizNet: 12.0,
    };

    const userNets = {
      tytMatNet: 37.5, // +2.5 önde
      aytMatNet: 35.0, // -3.0 geride
      aytFizNet: 12.0, // eşit
    };

    const comp = YokAtlas.compareNets(userNets, targetNet);
    expect(comp.totalUserNet).toBe(84.5);
    expect(comp.totalTargetNet).toBe(85.0);
    expect(comp.totalDiff).toBe(-0.5);
    expect(comp.aheadLessons).toContain("TYT Matematik");
    expect(comp.behindLessons).toContain("AYT Matematik");
  });

  it("checkPrerequisites ÖSYM yasal baraj şartlarını doğru tespit eder", () => {
    const tipProg: any = { birimAdi: "Tıp Fakültesi", birimGrupAdi: "Tıp" };
    const mühProg: any = { birimAdi: "Bilgisayar Mühendisliği", birimGrupAdi: "Bilgisayar Mühendisliği" };
    const isletmeProg: any = { birimAdi: "İşletme", birimGrupAdi: "İşletme" };

    // Tıp barajı: 50.000
    expect(YokAtlas.checkPrerequisites(tipProg, 40000).eligible).toBe(true);
    expect(YokAtlas.checkPrerequisites(tipProg, 60000).eligible).toBe(false);

    // Mühendislik barajı: 300.000
    expect(YokAtlas.checkPrerequisites(mühProg, 250000).eligible).toBe(true);
    expect(YokAtlas.checkPrerequisites(mühProg, 350000).eligible).toBe(false);

    // İşletme (baraj yok)
    expect(YokAtlas.checkPrerequisites(isletmeProg, 400000).eligible).toBe(true);
    expect(YokAtlas.checkPrerequisites(isletmeProg, 400000).category).toBeNull();
  });

  it("validatePreferenceList tercih listesini analiz eder ve ölü tercihleri tespit eder", () => {
    const progA: any = {
      birimAdi: "Hukuk",
      universiteAdi: "A Üniversitesi",
      current: { basariSirasi: 50000 },
      history: [],
    };
    const progB: any = {
      birimAdi: "Bilgisayar Mühendisliği",
      universiteAdi: "B Üniversitesi",
      current: { basariSirasi: 5000 }, // çok daha yüksek sıra (daha zor) ama 2. sıraya konmuş
      history: [],
    };

    const analysis = YokAtlas.validatePreferenceList([progA, progB], 30000);
    expect(analysis.totalPreferences).toBe(2);
    expect(analysis.warnings.some((w) => w.includes("ölü tercih"))).toBe(true);
  });

  it("ağ hatası olduğunda yerleşik lookup snapshot yedeğini (offline fallback) devreye sokar", async () => {
    // Fetch network hatası fırlatsın
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Ağ bağlantısı koptu (offline)");
      }),
    );
    const unis = await YokAtlas.listUniversities();
    expect(unis.length).toBeGreaterThan(200);
    const status = YokAtlas.getCacheStatus();
    expect(status.isOfflineFallback).toBe(true);
  });
});
