# YÖK Atlas API Node.js Wrapper

This project is an unofficial, TypeScript-based wrapper library built to provide direct, fast and reliable access to the YÖK Atlas admissions guide ("tercih kılavuzu") and Net Wizard ("Net Sihirbazı") JSON APIs from a Node.js environment. It fetches live data over plain HTTP and needs no Python, `uv` or any binary dependency. In addition to the library, the package ships a terminal CLI (`yokatlas`) and a built-in **Model Context Protocol (MCP)** server.

## Installation

```bash
npm install yokatlas-api-wrapper
```

Or install it globally to use the command-line tool:

```bash
npm install -g yokatlas-api-wrapper
```

The CLI and the MCP server can also be run without installing anything, straight through `npx`:

```bash
npx -y yokatlas-api-wrapper --help
```

## Command-Line Interface (CLI) Usage

A global install exposes the `yokatlas` command. Output is human-readable by default; append `--json` to any command to print raw single-line JSON instead (for scripting/automation).

```bash
yokatlas search "boğaziçi bilgisayar" --say        # search bachelor/associate programs
yokatlas netler "itü makine"                       # Net Wizard (last placed student's nets)
yokatlas info 102210277 --sira 1200                # 4-year detail card + admission/threshold analysis
yokatlas compare 102210277 105610543              # compare two programs
yokatlas baraj 102210277 250000                   # ÖSYM legal success-rank threshold check
yokatlas unis                                      # list all universities
yokatlas cities                                    # list all cities
yokatlas mcp                                       # start the MCP stdio server
```

Common options: `--say` / `--soz` / `--ea` / `--dil` / `--tyt` (score type), `--lisans` / `--onlisans` (degree level), `--devlet` / `--vakif` (university type), `--limit <n>`, `--sira <n>` (rank for the `info` command's admission estimate), `--json`, `--help`.

## Getting Started

The library works entirely through a static class; no instantiation is required. Both CommonJS and ECMAScript Modules (ESM) builds are fully supported.

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

// All numeric ("say") programs at Boğaziçi — smart search resolves the free-text
// name to an ID automatically.
const page = await YokAtlas.search({ puanTuru: 'SAY', universite: 'boğaziçi' }, { size: 20 });

console.log(`Total: ${page.totalElements}`);
for (const program of page.content) {
  console.log(`${program.universiteAdi} — ${program.birimAdi} | ${program.current.minPuan} (${program.current.basariSirasi})`);
}

// A single program, by ÖSYM guide code
const program = await YokAtlas.getProgram(102210277);
if (program) {
  console.log(program.current, program.history);
}
```

### Net Wizard (last placed student's nets)

```typescript
const nets = await YokAtlas.searchNetler({
  universite: 'boğaziçi',
  program: 'bilgisayar mühendisliği',
});

for (const net of nets.content) {
  console.log(`${net.yil}: TYT Math ${net.tytMatNet} / AYT Physics ${net.aytFizNet}`);
}
```

### Smart search (fuzzy Turkish matching)

The `universite`, `program` and `il` fields accept free text. Turkish character normalization and fuzzy matching resolve them to the nearest record — casing, dotted/dotless vowels (İ/I, Ş/S…) and small typos do not matter.

```typescript
await YokAtlas.search({ universite: 'ODTÜ', il: 'ankara' });
await YokAtlas.search({ universite: 'bogazici' }); // matches "Boğaziçi"

// To get the lookup record itself:
const uni = await YokAtlas.findUniversity('boğazici');
console.log(uni.universiteId, uni.universiteAdi);
```

If no match is found, a `YokAtlasLookupError` is thrown carrying the 3 closest suggestions.

## API Reference and Functions

All methods below are accessible statically on the `YokAtlas` class.

### 1. Core Search

- **`YokAtlas.search(filters?, options?)`**: Searches the admissions guide for programs; returns a paginated `SearchPage<Program>`.
- **`YokAtlas.searchNetler(filters?, options?)`**: Queries the Net Wizard; returns a paginated `SearchPage<Net>`.
- **`YokAtlas.getProgram(kilavuzKodu)`**: Fetches a single program by its ÖSYM guide code; returns `null` if not found.
- **`YokAtlas.getPrograms(kilavuzKodlari, { concurrency? })`**: Fetches multiple programs with bounded concurrency; each code resolves independently as `fulfilled`/`rejected` (one failure does not affect the others).
- **`YokAtlas.searchAllPages(filters?, options?)`**: Walks `search()` page by page automatically and collects every result into a flat `Program[]` array (guarded by a `maxPages` safety limit).

### 2. Lookup Tables

- **`YokAtlas.listUniversities()`**: Returns all universities (ID + name).
- **`YokAtlas.listProgramGroups()`**: Returns all program groups (ID + name + score type).
- **`YokAtlas.listCities()`**: Returns all cities (code + name).
- **`YokAtlas.findUniversity(name)` / `findProgramGroup(name)` / `findCity(name)`**: Fuzzy-matches a free-text name to its lookup record.
- **`YokAtlas.refreshLookups()`**: Forcibly refreshes the lookup cache.
- **`YokAtlas.clearCache()`**: Empties the lookup cache.
- **`YokAtlas.getCacheStatus()`**: Reports whether the cache is populated, when it was fetched, how many records it holds, and whether it was loaded from the offline snapshot rather than the network.

### 3. Shortcut Searches

Readability shortcuts for common filter combinations:

- **`YokAtlas.searchByUniversity(universiteAdi, filters?, options?)`**
- **`YokAtlas.searchByProgram(programAdi, filters?, options?)`**
- **`YokAtlas.searchByCity(ilAdi, filters?, options?)`**
- **`YokAtlas.searchLisans(filters?, options?)`**: Bachelor (4-year) programs only.
- **`YokAtlas.searchOnlisans(filters?, options?)`**: Associate (2-year) programs only.
- **`YokAtlas.searchBurslu(filters?, options?)`**: Full-scholarship / tuition-free programs only.
- **`YokAtlas.searchByScoreRange({ min?, max? }, filters?, options?)`**: A specific success-rank range.

```typescript
const programs = await YokAtlas.searchByUniversity('İTÜ', { puanTuru: 'SAY' });
const lawPrograms = await YokAtlas.searchByProgram('hukuk', { universiteTuru: 'DEVLET' });
const allIstanbul = await YokAtlas.searchAllPages({ il: 'istanbul', puanTuru: 'EA' });
```

### 4. Derived / Offline Analysis Helpers

These methods make no extra network request; they operate on `Program` / `Net` objects you have already fetched.

- **`YokAtlas.estimateAdmission(program, basariSirasi)`**: Compares the user's own success rank against the program's current-year cutoff rank and produces a rough verdict: `"kesine yakın"` (near-certain), `"olası"` (likely), `"sınırda"` (borderline), `"zayıf"` (weak) or `"belirsiz"` (unknown).
- **`YokAtlas.compareNets(userNets, targetNet)`**: Compares your own trial-exam nets against a Net Wizard record subject by subject; returns per-subject diffs, totals, the subjects you are ahead/behind on, and a summary sentence.
- **`YokAtlas.checkPrerequisites(program, basariSirasi)`**: Checks a program against the ÖSYM legal success-rank thresholds — Medicine (50k), Dentistry (80k), Pharmacy (100k), Law (125k), Architecture (250k), Engineering (300k), Teaching/PDR (300k). Returns `{ eligible, category, barajSira, margin, message }`.
- **`YokAtlas.validatePreferenceList(preferences, userRank)`**: Groups a preference list (up to 24 items) into `"güvenli"` (safe), `"ideal"`, `"hayal"` (reach) and `"belirsiz"` tiers, flags threshold blocks and out-of-order ("dead") preferences, and returns tier counts plus overall advice.
- **`YokAtlas.compare(programA, programB)`**: Compares two programs by current-year competitiveness (success rank) and quota difference.
- **`YokAtlas.getTrend(program)`**: Reads the success-rank series across the program's `allYears` data and estimates a direction: `"yükseliyor"` (rising), `"düşüyor"` (falling), `"sabit"` (stable) or `"belirsiz"` (unknown).
- **`YokAtlas.getAllYears(program)`**: Returns the program's yearly stats in chronological order (`[current, ...history]`).
- **`YokAtlas.groupBy(programs, keyFn)`**: Groups a program array by the given key function (e.g. by city, by university type).
- **`YokAtlas.sortByScore(programs, direction?)`**: Sorts a program array by current-year success rank.
- **`YokAtlas.formatSummary(program)`**: Turns a program into a one-line readable summary (for logs/console).

```typescript
const bogaziciCs = await YokAtlas.getProgram(102210277);
if (bogaziciCs) {
  const estimate = YokAtlas.estimateAdmission(bogaziciCs, 950);
  console.log(estimate.verdict, estimate.message);

  const trend = YokAtlas.getTrend(bogaziciCs);
  console.log(trend.direction, trend.message);

  const check = YokAtlas.checkPrerequisites(bogaziciCs, 250_000);
  console.log(check.eligible, check.message);
}

const all = await YokAtlas.searchAllPages({ il: 'izmir' });
const byUniversity = YokAtlas.groupBy(all, (p) => p.universiteAdi);
const bestFirst = YokAtlas.sortByScore(all, 'asc');
console.log(all.map(YokAtlas.formatSummary).join('\n'));
```

### 5. Configuration

```typescript
import { YokAtlas } from 'yokatlas-api-wrapper';

YokAtlas.configure({
  timeoutMs: 60_000,
  maxRetries: 3,
  lookupCacheTtlMs: 600_000, // 10 minutes
  userAgent: 'my-app/1.0',
  offlineFallback: true,
});
```

| Field | Default | Description |
|---|---|---|
| `baseUrl` | `https://yokatlas.yok.gov.tr` | API root |
| `timeoutMs` | `30000` | HTTP request timeout (ms) |
| `maxRetries` | `2` | Retry count on network errors (dropped connections etc.) |
| `lookupCacheTtlMs` | `3600000` | University/program/city lookup cache lifetime (ms); `0` = forever |
| `userAgent` | `yokatlas-api-wrapper/1.0` | User-Agent header |
| `offlineFallback` | `true` | When the YÖK Atlas servers are unreachable, serve lookup tables from the bundled static snapshot instead of failing |

## Filters

### `search()` — `SearchFilters`

| Field | Type | Description |
|---|---|---|
| `puanTuru` | `"SAY" \| "SÖZ" \| "EA" \| "DİL" \| "TYT"` | Score type |
| `degreeType` | `"bachelor" \| "associate" \| "lisans" \| "onlisans"` | Bachelor (46) / associate (47) shortcut for `birimTuruId` |
| `universite` / `universiteId` | `string \| string[]` / `number[]` | University name (smart fuzzy) or ID |
| `program` / `birimGrupId` | `string \| string[]` / `number[]` | Program group name (smart fuzzy) or ID |
| `il` / `ilKodu` | `string \| string[]` / `number[]` | City name (smart fuzzy) or plate code |
| `birimTuruId` | `number` | 46 = LİSANS, 47 = ÖNLİSANS |
| `universiteTuru` | `"DEVLET" \| "VAKIF"` | University type |
| `bursTuru` / `bursOraniId` | `"ucretsiz" \| "tam" \| "%50" \| "%25"` / `number` | Scholarship rate |
| `ogrenimTuru` / `ogrenimTuruId` | `"orgun" \| "ikinci" \| "uzaktan"` / `number` | Instruction type |
| `minBasariSirasi` / `maxBasariSirasi` | `number` | Success-rank range |
| `kilavuzKodu` | `number` | Single 9-digit program code |

> Smart (string) fields and their ID counterparts must not be supplied at the same time — pick one.

### `searchNetler()` — `NetFilters`

Unlike `SearchFilters`, `universiteId` / `birimGrupId` are **singular** — the Net Wizard endpoint does not accept lists. `universite` / `program` are singular too.

## Data Shape

A `Program` carries 4 years of data:

```typescript
program.current  // YearlyStats: most recent year
program.history  // YearlyStats[]: previous 3 years (new → old)
program.allYears // YearlyStats[]: [current, ...history]
```

`YearlyStats` fields: `year, kontenjan, yerlesen, kontenjanObs, kontenjanY34, prof, doc, dou, ogrGor, arGor, kpss1, kpss2, minPuan, basariSirasi`.

A `Net` record holds the last placed candidate's TYT/AYT/YDT subject nets (`tytMatNet`, `aytFizNet`, …) plus `tabanPuan`, `obp` and `katsayi`. Which `*Net` fields are populated depends on `puanTuru`.

## Constants and Labels

Common IDs and readable Turkish label converters are exported from `src/constants.ts`:

```typescript
import {
  BIRIM_TURU,
  OSYM_BARAJLARI,
  NET_DERSLERI,
  getPuanTuruLabel,
  getBirimTuruLabel,
  getUniversiteTuruLabel,
} from 'yokatlas-api-wrapper';

BIRIM_TURU.LISANS;    // 46
BIRIM_TURU.ONLISANS;  // 47

getPuanTuruLabel('SAY');          // "Sayısal"
getBirimTuruLabel('ONLISANS');    // "Ön Lisans"
getUniversiteTuruLabel('VAKIF');  // "Vakıf Üniversitesi"
```

The offline lookup snapshot itself is exported as `LOOKUP_SNAPSHOT`.

## Model Context Protocol (MCP)

The package bundles an MCP stdio server, so you can wire YÖK Atlas into Claude Desktop, Cursor, Antigravity or any MCP client through Node.js alone — no Python or `uv`.

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

Exposed tools: `search_programs`, `search_netler`, `get_program`, `estimate_admission`, `compare_programs`, `get_program_trend`, `compare_nets`, `check_prerequisites`, `list_universities`, `list_program_groups`, `list_cities`.

The server can also be embedded programmatically via the exported `createMcpServer()` / `runMcpServer()`.

## Error Handling

The library throws distinguishable error classes (all extend `YokAtlasError`):

- **`YokAtlasValidationError`**: An invalid parameter was passed (e.g. a non-numeric guide code).
- **`YokAtlasAPIError`**: The request failed at the network/HTTP level, the YÖK Atlas server returned an error status, or the response could not be parsed as JSON (carries `status` and `body`).
- **`YokAtlasNotFoundError`**: The server returned 404 (extends `YokAtlasAPIError`).
- **`YokAtlasRateLimitError`**: The server returned a rate-limit status (418/429) (extends `YokAtlasAPIError`).
- **`YokAtlasLookupError`**: Smart search could not resolve a name/record (carries `kind` and `suggestions`).

```typescript
import { YokAtlas, YokAtlasLookupError, YokAtlasAPIError } from 'yokatlas-api-wrapper';

try {
  await YokAtlas.search({ universite: 'a university that does not exist' });
} catch (e) {
  if (e instanceof YokAtlasLookupError) {
    console.log('Not found:', e.message, e.suggestions);
  } else if (e instanceof YokAtlasAPIError) {
    console.log('API error:', e.message, e.status);
  }
}
```

## Development

```bash
npm install
npm run build   # emits CJS, ESM and DTS outputs
npm test        # runs the unit tests with Vitest
```

## License

MIT
