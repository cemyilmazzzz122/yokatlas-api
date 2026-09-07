# yokatlas-api-wrapper

> YÖK Atlas tercih kılavuzu JSON API'si için modern Node.js/TypeScript sarmalayıcısı, terminal CLI aracı ve yerleşik **Model Context Protocol (MCP)** sunucusu.

Bu proje, YÖK Atlas'ın tercih kılavuzu ve Net Sihirbazı JSON API'lerine Node.js ortamından doğrudan erişim sağlamak amacıyla geliştirilmiş, çok amaçlı resmî olmayan bir kütüphanedir. Herhangi bir Python veya ikili (binary) bağımlılığı gerektirmeden saf JavaScript/TypeScript ile çalışır.

---

## 🌟 Öne Çıkan Yetenekler

- 🚀 **Yerleşik MCP Sunucusu:** Claude Desktop, Cursor, Antigravity ve 5ire gibi LLM ortamlarına sıfır kurulumla (`npx -y yokatlas-api-wrapper mcp`) doğrudan bağlanabilen hazır tool seti.
- 💻 **Terminal CLI Aracı:** Terminalden tek komutla program arama, Net Sihirbazı sorgulama ve program detay kartı görüntüleme (`yokatlas search`, `yokatlas info`).
- 🔍 **Akıllı Fuzzy Arama:** Üniversite, program ve il adlarında Türkçe karakter ve yazım hatası tolere eden akıllı eşleştirme (örn. `"boğaziçi"` → `"BOĞAZİÇİ ÜNİVERSİTESİ"`).
- 📊 **4 Yıllık İstatistikler:** Her program için güncel ve geriye dönük 3 yılın kontenjan, yerleşen, taban puanı, başarı sırası ve akademik kadro verileri (`program.allYears`).
- 🎯 **Gelişmiş Analitik Araçlar:**
  - **Yerleşme Tahmini (`estimateAdmission`):** Başarı sıranıza göre kazanma olasılığı tahmini.
  - **Net Karşılaştırması (`compareNets`):** Deneme netleriniz ile hedef programın son yerleşen netlerinin ders bazında kıyaslaması.
  - **ÖSYM Yasal Baraj Kontrolü (`checkPrerequisites`):** Tıp (50k), Diş (80k), Eczacılık (100k), Hukuk (125k), Mimarlık (250k), Mühendislik (300k), Öğretmenlik (300k) baraj denetimleri.
  - **Tercih Listesi Simülatörü (`validatePreferenceList`):** 24 tercihi güvenli/ideal/hayal kategorilerine ayıran ve olası ölü tercihleri tespit eden analiz.
- 🛡️ **Çevrimdışı Yedek Önbellek (Offline Fallback):** YÖK Atlas sunucuları yanıt vermediğinde yerleşik snapshot verisinden lookup tablolarını 0ms gecikmeyle kesintisiz sunar.

---

## 📦 Kurulum

```bash
npm install yokatlas-api-wrapper
```

Global CLI veya MCP kullanımı için kuruluma gerek yoktur, doğrudan `npx` ile çalıştırılabilir:
```bash
npx -y yokatlas-api-wrapper --help
```

---

## 🤖 Model Context Protocol (MCP) Kullanımı

Python veya `uv` kurmaya gerek kalmadan, Node.js üzerinden Claude Desktop, Cursor veya Antigravity'ye bağlayabilirsiniz.

### Claude Desktop Yapılandırması (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "yokatlas": {
      "command": "npx",
      "args": ["-y", "yokatlas-api-wrapper", "mcp"]
    }
  }
}
```

### Google Antigravity / Cursor Yapılandırması

```json
{
  "mcpServers": {
    "yokatlas": {
      "command": "npx",
      "args": ["-y", "yokatlas-api-wrapper", "mcp"]
    }
  }
}
```

### Sunulan MCP Araçları (Tools)

1. `search_programs`: Lisans/önlisans smart fuzzy arama (4 yıllık istatistikler).
2. `search_netler`: Net Sihirbazı (son yerleşen adayın TYT/AYT/YDT ders netleri).
3. `get_program`: ÖSYM kılavuz koduyla tek program detayı.
4. `estimate_admission`: Başarı sırasına göre yerleşme olasılığı tahmini.
5. `compare_programs`: İki programın puan, sıra ve kontenjan kıyaslaması.
6. `get_program_trend`: Programın yıllara göre yükselme/düşme eğilimi.
7. `compare_nets`: Deneme netleri ile hedef programın netlerini kıyaslama.
8. `check_prerequisites`: ÖSYM yasal başarı sırası baraj şartı kontrolü.
9. `list_universities`, `list_program_groups`, `list_cities`: Lookup tabloları.

---

## 💻 Terminal CLI Kullanımı

```bash
# Lisans ve önlisans programlarında akıllı arama
npx yokatlas-api-wrapper search "bilgisayar mühendisliği" --say --devlet --limit 5

# Belirli bir üniversitenin sayısal programları
npx yokatlas-api-wrapper search --uni "boğaziçi" --say

# Net Sihirbazı sorgusu
npx yokatlas-api-wrapper netler "tıp" --limit 3

# Kılavuz koduyla program kartı ve 1.200. sıra için kazanma & baraj analizi
npx yokatlas-api-wrapper info 102210277 --sira 1200

# İki programı karşılaştır
npx yokatlas-api-wrapper compare 102210277 105610543

# ÖSYM yasal başarı sırası baraj kontrolü
npx yokatlas-api-wrapper baraj 102210277 250000
```

---

## 🚀 Kütüphane Olarak Kullanım (TypeScript & JavaScript)

### 1. Program Arama (`YokAtlas.search`)

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

// degreeType, bursTuru veya serbest metin akıllı arama
const sayfa = await YokAtlas.search({
  universite: 'boğaziçi',
  degreeType: 'bachelor', // 'bachelor' | 'associate' | 'lisans' | 'onlisans'
  puanTuru: 'SAY',
});

for (const prog of sayfa.content) {
  console.log(`${prog.universiteAdi} — ${prog.birimAdi}`);
  console.log(`Son Yıl: Puan: ${prog.current.minPuan} | Sıra: ${prog.current.basariSirasi}`);
  // Tüm 4 yılın geçmişi:
  console.log(prog.allYears.map((y) => `${y.year}: ${y.basariSirasi}`).join(' · '));
}
```

### 2. Net Sihirbazı & Net Karşılaştırması (`compareNets`)

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

const netPage = await YokAtlas.searchNetler({
  universite: 'boğaziçi',
  program: 'bilgisayar mühendisliği',
});

const hedefProgramNeti = netPage.content[0];

// Kendi deneme netlerinizle kıyaslayın:
const analiz = YokAtlas.compareNets(
  {
    tytMatNet: 38.0,
    tytFenNet: 18.5,
    aytMatNet: 36.0,
    aytFizNet: 13.0,
  },
  hedefProgramNeti
);

console.log(analiz.summary);
// "+1.5 net öndesiniz (2 derste daha yüksek)."
console.log(analiz.lessons);
```

### 3. ÖSYM Yasal Baraj Kontrolü (`checkPrerequisites`)

Tıp, Hukuk, Mühendislik, Mimarlık, Eczacılık, Diş Hekimliği ve Öğretmenlik programları için ÖSYM başarı sırası barajlarını denetler:

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

const program = await YokAtlas.getProgram(102210277); // Mühendislik (Baraj: 300.000)

const denetim1 = YokAtlas.checkPrerequisites(program!, 250_000);
console.log(denetim1.eligible); // true
console.log(denetim1.message); // "ÖSYM Mühendislik başarı sırası baraj şartını (300.000) sağlıyorsunuz."

const denetim2 = YokAtlas.checkPrerequisites(program!, 350_000);
console.log(denetim2.eligible); // false
console.log(denetim2.message); // "ÖSYM Mühendislik için en az ilk 300.000 içinde olma şartı aramaktadır..."
```

### 4. Tercih Listesi Simülatörü (`validatePreferenceList`)

24 tercihinizi risk seviyelerine göre gruplar ve ölü tercih sıralama uyarıları verir:

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

const tercihlerim = await Promise.all([
  YokAtlas.getProgram(102210277), // Boğaziçi Bilgisayar
  YokAtlas.getProgram(105610543), // İTÜ Bilgisayar
]);

const listeAnalizi = YokAtlas.validatePreferenceList(tercihlerim as any, 2500);

console.log(listeAnalizi.tierCounts); // { guvenli: 1, ideal: 1, hayal: 0, belirsiz: 0 }
console.log(listeAnalizi.warnings);   // Varsa baraj veya ölü tercih uyarıları
console.log(listeAnalizi.overallAdvice);
```

### 5. Yerleşme Tahmini & Trend Analizi

```typescript
const program = await YokAtlas.getProgram(102210277);

// Öğrencinin sırasına göre kazanma olasılığı
const tahmin = YokAtlas.estimateAdmission(program!, 1100);
console.log(tahmin.verdict); // "kesine yakın" | "olası" | "sınırda" | "zayıf"

// Yıllara göre rekabet eğilimi
const trend = YokAtlas.getTrend(program!);
console.log(trend.direction); // "yükseliyor" | "düşüyor" | "sabit"
```

---

## ⚙️ Yapılandırma

```typescript
YokAtlas.configure({
  timeoutMs: 30_000,
  maxRetries: 2,
  lookupCacheTtlMs: 3_600_000, // 1 saat
  offlineFallback: true,        // Ağ kesintisinde yerel snapshot devreye girer
});
```

---

## 🛠️ Filtre Parametreleri (`SearchFilters`)

| Alan | Tip | Açıklama |
|---|---|---|
| `puanTuru` | `"SAY" \| "SÖZ" \| "EA" \| "DİL" \| "TYT"` | Puan türü |
| `degreeType` | `"bachelor" \| "associate" \| "lisans" \| "onlisans"` | Lisans (46) veya önlisans (47) kısayolu |
| `universite` / `universiteId` | `string \| string[]` / `number[]` | Üniversite adı (akıllı fuzzy) veya ID |
| `program` / `birimGrupId` | `string \| string[]` / `number[]` | Program adı (akıllı fuzzy) veya ID |
| `il` / `ilKodu` | `string \| string[]` / `number[]` | Şehir adı (akıllı fuzzy) veya plaka kodu |
| `universiteTuru` | `"DEVLET" \| "VAKIF"` | Üniversite türü |
| `bursTuru` | `"ucretsiz" \| "tam" \| "%50" \| "%25"` | Sık kullanılan burs oranları |
| `ogrenimTuru` | `"orgun" \| "ikinci" \| "uzaktan"` | Öğretim türü |
| `minBasariSirasi` / `maxBasariSirasi` | `number` | Başarı sırası aralığı |
| `kilavuzKodu` | `number` | 9 haneli tek program kodu |

---

## 🧪 Testler ve Geliştirme

```bash
npm test        # Vitest ile birim testleri çalıştırır
npm run build   # CJS, ESM ve DTS çıktılarını derler
```

---

## 📜 Lisans

MIT
