# yokatlas-api-wrapper

Bu proje, YÖK Atlas'ın tercih kılavuzu JSON API'sine Node.js ortamından doğrudan, hızlı ve güvenilir bir şekilde erişim sağlamak amacıyla geliştirilmiş, TypeScript tabanlı resmî olmayan bir sarmalayıcı (wrapper) kütüphanedir. Herhangi bir dış bağımlılığa veya ikili (binary) dosyaya ihtiyaç duymadan HTTP üzerinden güncel verileri çeker.

## Kurulum

Projeyi Node.js projenize dahil etmek için:

```bash
npm install yokatlas-api-wrapper
```

## Kullanım Başlangıcı

Modül tamamen statik bir sınıf üzerinden çalışır; örnekleme (instantiation) gerekmez. CommonJS ve ECMAScript Modules (ESM) yapıları tam olarak desteklenmektedir.

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

// Boğaziçi'nde sayısal tüm programlar (akıllı arama: serbest yazım otomatik ID'ye çözülür)
const sayfa = await YokAtlas.search({ puanTuru: 'SAY', universite: 'boğaziçi' }, { size: 20 });

console.log(`Toplam: ${sayfa.totalElements}`);
for (const program of sayfa.content) {
  console.log(`${program.universiteAdi} — ${program.birimAdi} | ${program.current.minPuan} (${program.current.basariSirasi})`);
}

// Tek bir program (kılavuz kodu ile)
const program = await YokAtlas.getProgram(102210277);
if (program) {
  console.log(program.current, program.history);
}
```

### Net Sihirbazı (son yerleşen kişinin netleri)

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

const sayfa = await YokAtlas.searchNetler({
  universite: 'boğaziçi',
  program: 'bilgisayar mühendisliği',
});

for (const net of sayfa.content) {
  console.log(`${net.yil}: TYT Mat ${net.tytMatNet} / AYT Fizik ${net.aytFizNet}`);
}
```

### Akıllı arama (fuzzy Türkçe eşleşme)

`universite`, `program` ve `il` alanları serbest yazımı kabul eder; Türkçe karakter normalizasyonu ve fuzzy eşleşme ile en yakın kayda çözülür — büyük/küçük harf, ünlü noktalama (İ/I, Ş/S...) ve küçük yazım hataları önemli değildir.

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

await YokAtlas.search({ universite: 'ODTÜ', il: 'ankara' });
await YokAtlas.search({ universite: 'bogazici' }); // "Boğaziçi" ile eşleşir

// Lookup kaydının kendisini almak istiyorsanız:
const uni = await YokAtlas.findUniversity('boğazici');
console.log(uni.universiteId, uni.universiteAdi);
```

Eşleşme bulunamazsa `YokAtlasLookupError` fırlatılır ve en yakın 3 öneriyi içerir.

## API Referansı ve Fonksiyonlar

Aşağıdaki metotlar `YokAtlas` sınıfı üzerinden statik olarak erişilebilir durumdadır:

### 1. Temel Arama

- **`YokAtlas.search(filters?, options?)`**: Tercih kılavuzunda program arar, sayfalanmış `SearchPage<Program>` döner.
- **`YokAtlas.searchNetler(filters?, options?)`**: Net Sihirbazı'nı sorgular, sayfalanmış `SearchPage<Net>` döner.
- **`YokAtlas.getProgram(kilavuzKodu)`**: Tek bir programı ÖSYM kılavuz kodundan getirir; bulunamazsa `null` döner.
- **`YokAtlas.getPrograms(kilavuzKodlari, { concurrency? })`**: Birden çok programı sınırlı eşzamanlılıkla getirir; her kod bağımsız `fulfilled`/`rejected` sonucuyla döner (biri başarısız olursa diğerlerini etkilemez).
- **`YokAtlas.searchAllPages(filters?, options?)`**: `search()`'ü otomatik olarak sayfa sayfa dolaşıp tüm sonuçları düz bir `Program[]` dizisine toplar (`maxPages` güvenlik sınırıyla).

### 2. Lookup Tabloları

- **`YokAtlas.listUniversities()`**: Tüm üniversiteleri (ID + ad) döner.
- **`YokAtlas.listProgramGroups()`**: Tüm program gruplarını (ID + ad + puan türü) döner.
- **`YokAtlas.listCities()`**: Tüm illeri (kod + ad) döner.
- **`YokAtlas.findUniversity(name)` / `findProgramGroup(name)` / `findCity(name)`**: Serbest yazılmış bir adı fuzzy eşleştirerek ilgili lookup kaydına çözer.
- **`YokAtlas.refreshLookups()`**: Lookup önbelleğini zorla yeniler.
- **`YokAtlas.clearCache()`**: Lookup önbelleğini boşaltır.
- **`YokAtlas.getCacheStatus()`**: Önbelleğin dolu olup olmadığını, ne zaman çekildiğini ve kaç kayıt içerdiğini döner.

### 3. Kısayol Aramalar

Sık kullanılan filtre kombinasyonları için okunabilirlik kısayolları:

- **`YokAtlas.searchByUniversity(universiteAdi, filters?, options?)`**
- **`YokAtlas.searchByProgram(programAdi, filters?, options?)`**
- **`YokAtlas.searchByCity(ilAdi, filters?, options?)`**
- **`YokAtlas.searchLisans(filters?, options?)`**: Sadece lisans (4 yıllık) programları.
- **`YokAtlas.searchOnlisans(filters?, options?)`**: Sadece ön lisans (2 yıllık) programları.
- **`YokAtlas.searchBurslu(filters?, options?)`**: Sadece ücretsiz/tam burslu programlar.
- **`YokAtlas.searchByScoreRange({ min?, max? }, filters?, options?)`**: Belirli bir başarı sırası aralığı.

```typescript
const programlar = await YokAtlas.searchByUniversity('İTÜ', { puanTuru: 'SAY' });
const hukukProgramlari = await YokAtlas.searchByProgram('hukuk', { universiteTuru: 'DEVLET' });
const tumIstanbul = await YokAtlas.searchAllPages({ il: 'istanbul', puanTuru: 'EA' });
```

### 4. Türetilmiş / Çevrimdışı Analiz Yardımcıları

Bu metotlar ekstra bir ağ isteği yapmaz; zaten çekilmiş `Program` nesneleri üzerinde çalışır.

- **`YokAtlas.estimateAdmission(program, basariSirasi)`**: Kullanıcının kendi başarı sırasını programın güncel yıl kesme sırasıyla karşılaştırıp `"kesine yakın" | "olası" | "sınırda" | "zayıf" | "belirsiz"` şeklinde kaba bir yerleşme tahmini üretir.
- **`YokAtlas.compare(programA, programB)`**: İki programı güncel yıl rekabet düzeyi (başarı sırası) ve kontenjan farkı açısından karşılaştırır.
- **`YokAtlas.getTrend(program)`**: Programın `history` + `current` verisindeki başarı sırası dizisine bakarak `"yükseliyor" | "düşüyor" | "sabit" | "belirsiz"` eğilimini kestirir.
- **`YokAtlas.groupBy(programs, keyFn)`**: Bir program dizisini verilen anahtar fonksiyonuna göre gruplar (örn. şehre, üniversite türüne).
- **`YokAtlas.sortByScore(programs, direction?)`**: Bir program dizisini güncel yıl başarı sırasına göre sıralar.
- **`YokAtlas.formatSummary(program)`**: Bir programı tek satırlık okunur bir özet metnine çevirir (log/konsol için).

```typescript
const boğaziçiBilgisayar = await YokAtlas.getProgram(102210277);
if (boğaziçiBilgisayar) {
  const tahmin = YokAtlas.estimateAdmission(boğaziçiBilgisayar, 950);
  console.log(tahmin.verdict, tahmin.message);

  const trend = YokAtlas.getTrend(boğaziçiBilgisayar);
  console.log(trend.direction, trend.message);
}

const tumProgramlar = await YokAtlas.searchAllPages({ il: 'izmir' });
const sehreGoreGrupla = YokAtlas.groupBy(tumProgramlar, (p) => p.universiteAdi);
const enIyiden = YokAtlas.sortByScore(tumProgramlar, 'asc');
console.log(tumProgramlar.map(YokAtlas.formatSummary).join('\n'));
```

### 5. Yapılandırma

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

YokAtlas.configure({
  timeoutMs: 60_000,
  maxRetries: 3,
  lookupCacheTtlMs: 600_000, // 10 dakika
  userAgent: 'kendi-uygulamam/1.0',
});
```

| Alan | Varsayılan | Açıklama |
|---|---|---|
| `baseUrl` | `https://yokatlas.yok.gov.tr` | API kökü |
| `timeoutMs` | `30000` | HTTP zaman aşımı (ms) |
| `maxRetries` | `2` | Ağ hatalarında (bağlantı kopması vb.) yeniden deneme sayısı |
| `lookupCacheTtlMs` | `3600000` | Üniversite/program/il lookup önbelleği ömrü (ms), `0` = sonsuz |
| `userAgent` | `yokatlas-api-wrapper/1.0` | User-Agent başlığı |

## Filtreler

### `search()` — `SearchFilters`

| Alan | Tip | Açıklama |
|---|---|---|
| `puanTuru` | `"SAY" \| "SÖZ" \| "EA" \| "DİL" \| "TYT"` | Puan türü |
| `universite` / `universiteId` | `string \| string[]` / `number[]` | Üniversite (akıllı veya ID) |
| `program` / `birimGrupId` | `string \| string[]` / `number[]` | Program grubu |
| `il` / `ilKodu` | `string \| string[]` / `number[]` | İl |
| `birimTuruId` | `number` | 46 = LİSANS, 47 = ÖNLİSANS |
| `universiteTuru` | `"DEVLET" \| "VAKIF"` | Üniversite türü |
| `bursOraniId` | `number` | 0 = Ücretsiz/Burslu |
| `ogrenimTuruId` | `number` | Örgün/İkinci öğretim |
| `kilavuzKodu` | `number` | Tek programa filtre |
| `minBasariSirasi` / `maxBasariSirasi` | `number` | Başarı sırası aralığı |

> Akıllı (string) alanlar ile ID alanları aynı anda verilmemelidir — biri seçilir.

### `searchNetler()` — `NetFilters`

`SearchFilters`'in aksine `universiteId`/`birimGrupId` **tekildir** — Net Sihirbazı endpoint'i liste kabul etmez. Ayrıca `universite`/`program` de tekildir (liste değil).

## Yapı

Bir `Program` 4 yıllık veri taşır:

```typescript
program.current  // YearlyStats: en güncel yıl
program.history  // YearlyStats[]: 3 önceki yıl (yeni → eski)
```

`YearlyStats` alanları: `year, kontenjan, yerlesen, kontenjanObs, kontenjanY34, prof, doc, dou, ogrGor, arGor, kpss1, kpss2, minPuan, basariSirasi`.

## Sabitler ve Etiketler

Sık kullanılan ID'ler ve okunur Türkçe etiket çeviricileri `src/constants.ts` altında dışa aktarılır:

```typescript
import { BIRIM_TURU, getPuanTuruLabel, getBirimTuruLabel, getUniversiteTuruLabel } from 'yokatlas-api-wrapper';

BIRIM_TURU.LISANS;    // 46
BIRIM_TURU.ONLISANS;  // 47

getPuanTuruLabel('SAY');          // "Sayısal"
getBirimTuruLabel('ONLISANS');    // "Ön Lisans"
getUniversiteTuruLabel('VAKIF');  // "Vakıf Üniversitesi"
```

## Hata Yönetimi

Kütüphane, ayırt edilebilir hata sınıfları fırlatır (hepsi `YokAtlasError`'dan türer):

- **`YokAtlasValidationError`**: Geçersiz bir parametre verildiğinde (örn. sayısal olmayan kılavuz kodu).
- **`YokAtlasAPIError`**: Ağ isteği başarısız olduğunda, YÖK Atlas sunucusu HTTP hata kodu döndüğünde veya cevap JSON olarak parse edilemediğinde (`status` ve `body` alanlarını taşır).
- **`YokAtlasNotFoundError`**: Sunucu 404 döndüğünde (`YokAtlasAPIError`'dan türer).
- **`YokAtlasRateLimitError`**: Sunucu oran sınırlama (418/429) döndüğünde (`YokAtlasAPIError`'dan türer).
- **`YokAtlasLookupError`**: Akıllı arama bir isim/kayıt çözemediğinde (`kind` ve `suggestions` alanlarını taşır).

```typescript
import { YokAtlas, YokAtlasLookupError, YokAtlasAPIError } from 'yokatlas-api-wrapper';

try {
  await YokAtlas.search({ universite: 'var olmayan bir üniversite' });
} catch (e) {
  if (e instanceof YokAtlasLookupError) {
    console.log('Bulunamadı:', e.message, e.suggestions);
  } else if (e instanceof YokAtlasAPIError) {
    console.log('API hatası:', e.message, e.status);
  }
}
```

## Geliştirme

```bash
npm install
npm run build
npm test
```

## Lisans

MIT
