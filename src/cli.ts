#!/usr/bin/env node

import { YokAtlas } from "./yokatlas";
import { runMcpServer } from "./mcp";
import type { DegreeType, PuanTuru, SearchFilters } from "./types";
import { getBirimTuruLabel, getPuanTuruLabel, getUniversiteTuruLabel } from "./constants";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

function printHelp(): void {
  console.log(`
${c.bold}${c.cyan}YÖK Atlas API & MCP CLI${c.reset} ${c.dim}(v1.1.1)${c.reset}
Türk Yükseköğretim Atlası resmi JSON API istemcisi ve MCP sunucusu.

${c.bold}KULLANIM:${c.reset}
  yokatlas <komut> [seçenekler]
  npx -y yokatlas-api-wrapper <komut>

${c.bold}KOMUTLAR:${c.reset}
  ${c.green}mcp${c.reset}                             MCP (Model Context Protocol) stdio sunucusunu başlatır.
  ${c.green}search <kelime>${c.reset}                  Lisans ve önlisans programlarında arama yapar.
  ${c.green}netler <kelime>${c.reset}                  Net Sihirbazı'nda (son yerleşenin netleri) arama yapar.
  ${c.green}info <kılavuzKodu>${c.reset}              Tek bir programın 4 yıllık detay kartını basar.
  ${c.green}compare <kod1> <kod2>${c.reset}           İki programı karşılaştırır.
  ${c.green}baraj <kılavuzKodu> <sıra>${c.reset}      ÖSYM yasal baraj şartı kontrolü (Tıp, Hukuk, Müh. vb.).
  ${c.green}unis${c.reset}                            Tüm üniversiteleri listeler.
  ${c.green}cities${c.reset}                          Tüm illeri listeler.

${c.bold}SEÇENEKLER:${c.reset}
  ${c.yellow}--say, --soz, --ea, --dil, --tyt${c.reset} Puan türü filtresi
  ${c.yellow}--lisans, --onlisans${c.reset}            Program seviyesi
  ${c.yellow}--devlet, --vakif${c.reset}               Üniversite türü
  ${c.yellow}--limit <n>${c.reset}                      Listelenecek kayıt sayısı (varsayılan: 10)
  ${c.yellow}--sira <n>${c.reset}                       info komutu ile kazanma ve baraj tahmini yapar
  ${c.yellow}--json${c.reset}                           Sonucu ham JSON formatında yazdırır
  ${c.yellow}--help, -h${c.reset}                       Bu yardım metnini gösterir

${c.bold}ÖRNEKLER:${c.reset}
  ${c.dim}# Boğaziçi'ndeki sayısal programları ara${c.reset}
  yokatlas search "boğaziçi bilgisayar" --say

  ${c.dim}# İTÜ Makine için son yerleşenin netleri${c.reset}
  yokatlas netler "itü makine"

  ${c.dim}# Kılavuz kodu 102210277 olan programın detayları ve 1200. sıra için kazanma tahmini${c.reset}
  yokatlas info 102210277 --sira 1200

  ${c.dim}# Claude Desktop veya Cursor'a MCP sunucusu olarak bağlama${c.reset}
  yokatlas mcp
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  // Eğer program doğrudan `yokatlas-mcp` adıyla çalıştırıldıysa veya komut `mcp` ise
  const binaryName = process.argv[1]?.toLowerCase() || "";
  if (binaryName.includes("yokatlas-mcp") || command === "mcp" || argv.includes("--mcp")) {
    await runMcpServer();
    return;
  }

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const isJson = argv.includes("--json");
  const getOpt = (name: string): string | null => {
    const idx = argv.indexOf(name);
    return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null;
  };

  const hasFlag = (name: string): boolean => argv.includes(name);

  try {
    switch (command) {
      case "search": {
        const query = argv[1] && !argv[1].startsWith("-") ? argv[1] : "";
        const limit = Number(getOpt("--limit")) || 10;
        const filters: SearchFilters = {};

        if (hasFlag("--say")) filters.puanTuru = "SAY";
        else if (hasFlag("--soz")) filters.puanTuru = "SÖZ";
        else if (hasFlag("--ea")) filters.puanTuru = "EA";
        else if (hasFlag("--dil")) filters.puanTuru = "DİL";
        else if (hasFlag("--tyt")) filters.puanTuru = "TYT";

        if (hasFlag("--lisans")) filters.degreeType = "lisans";
        else if (hasFlag("--onlisans")) filters.degreeType = "onlisans";

        if (hasFlag("--devlet")) filters.universiteTuru = "DEVLET";
        else if (hasFlag("--vakif")) filters.universiteTuru = "VAKIF";

        const uniOpt = getOpt("--uni");
        const progOpt = getOpt("--prog");
        const ilOpt = getOpt("--il");
        if (uniOpt) filters.universite = uniOpt;
        if (progOpt) filters.program = progOpt;
        if (ilOpt) filters.il = ilOpt;

        if (query && !filters.program && !filters.universite) {
          const parts = query.trim().split(/\s+/);
          if (parts.length >= 2) {
            try {
              const u = await YokAtlas.findUniversity(parts[0]);
              filters.universite = u.universiteAdi;
              filters.program = parts.slice(1).join(" ");
            } catch {
              filters.program = query;
            }
          } else {
            filters.program = query;
          }
        }

        const result = await YokAtlas.search(filters, { size: limit });

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(`\n${c.bold}Toplam bulunan: ${c.cyan}${result.totalElements}${c.reset} program (Gösterilen: ${result.content.length})\n`);
        result.content.forEach((prog, i) => {
          const puan = prog.current.minPuan ? `${prog.current.minPuan.toFixed(2)}` : "—";
          const sira = prog.current.basariSirasi ? prog.current.basariSirasi.toLocaleString("tr-TR") : "—";
          const kontenjan = prog.current.kontenjan ? `${prog.current.kontenjan} kontenjan` : "";

          console.log(
            ` ${c.bold}${c.green}${i + 1}.${c.reset} ${c.bold}${prog.universiteAdi}${c.reset} — ${c.cyan}${prog.birimAdi}${c.reset} ${c.dim}(${prog.kilavuzKodu})${c.reset}`
          );
          console.log(
            `    ${c.yellow}${prog.puanTuru}${c.reset} · ${getBirimTuruLabel(prog.birimTuruAdi)} · ${getUniversiteTuruLabel(prog.universiteTuru)} · Taban Puan: ${c.bold}${puan}${c.reset} · Sıra: ${c.bold}${sira}${c.reset} ${c.dim}(${kontenjan})${c.reset}`
          );
          console.log();
        });
        break;
      }

      case "netler": {
        const query = argv[1] && !argv[1].startsWith("-") ? argv[1] : "";
        const limit = Number(getOpt("--limit")) || 10;
        const filters: any = {};
        const uniOpt = getOpt("--uni");
        const progOpt = getOpt("--prog");
        if (uniOpt) filters.universite = uniOpt;
        if (progOpt) filters.program = progOpt;

        if (query && !filters.program && !filters.universite) {
          const parts = query.trim().split(/\s+/);
          if (parts.length >= 2) {
            try {
              const u = await YokAtlas.findUniversity(parts[0]);
              filters.universite = u.universiteAdi;
              filters.program = parts.slice(1).join(" ");
            } catch {
              filters.program = query;
            }
          } else {
            filters.program = query;
          }
        }

        const result = await YokAtlas.searchNetler(filters, { size: limit });

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(`\n${c.bold}Net Sihirbazı Sonuçları (Toplam: ${c.cyan}${result.totalElements}${c.reset})\n`);
        result.content.forEach((net, i) => {
          console.log(
            ` ${c.bold}${c.green}${i + 1}.${c.reset} ${c.bold}${net.universiteAdi}${c.reset} — ${c.cyan}${net.birimAdi}${c.reset} ${c.dim}(${net.yil})${c.reset}`
          );
          const tytParts: string[] = [];
          if (net.tytTrkNet != null) tytParts.push(`Türkçe: ${net.tytTrkNet}`);
          if (net.tytMatNet != null) tytParts.push(`Matematik: ${net.tytMatNet}`);
          if (net.tytFenNet != null) tytParts.push(`Fen: ${net.tytFenNet}`);
          if (net.tytSosNet != null) tytParts.push(`Sosyal: ${net.tytSosNet}`);

          const aytParts: string[] = [];
          if (net.aytMatNet != null) aytParts.push(`Mat: ${net.aytMatNet}`);
          if (net.aytFizNet != null) aytParts.push(`Fiz: ${net.aytFizNet}`);
          if (net.aytKimNet != null) aytParts.push(`Kim: ${net.aytKimNet}`);
          if (net.aytBioNet != null) aytParts.push(`Bio: ${net.aytBioNet}`);
          if (net.aytTdeNet != null) aytParts.push(`Edebiyat: ${net.aytTdeNet}`);

          if (tytParts.length) console.log(`    ${c.yellow}TYT:${c.reset} ${tytParts.join(" · ")}`);
          if (aytParts.length) console.log(`    ${c.blue}AYT:${c.reset} ${aytParts.join(" · ")}`);
          if (net.tabanPuan) console.log(`    ${c.dim}Taban Puan: ${net.tabanPuan} · OBP: ${net.obp ?? "—"}${c.reset}`);
          console.log();
        });
        break;
      }

      case "info": {
        const kod = argv[1];
        if (!kod) {
          console.error(`${c.red}Hata:${c.reset} Lütfen bir ÖSYM kılavuz kodu belirtin (örn: yokatlas info 102210277).`);
          process.exit(1);
        }
        const program = await YokAtlas.getProgram(kod);
        if (!program) {
          console.error(`${c.red}Hata:${c.reset} ${kod} kodlu program bulunamadı.`);
          process.exit(1);
        }

        if (isJson) {
          console.log(JSON.stringify(program, null, 2));
          return;
        }

        console.log(`\n${c.bold}${c.cyan}═════════════════════════════════════════════════════════════════════${c.reset}`);
        console.log(` ${c.bold}${program.universiteAdi}${c.reset} — ${c.bold}${c.green}${program.birimAdi}${c.reset}`);
        console.log(` ${c.dim}Kılavuz Kodu:${c.reset} ${c.bold}${program.kilavuzKodu}${c.reset} · ${c.yellow}${program.puanTuru}${c.reset} · ${getBirimTuruLabel(program.birimTuruAdi)} · ${getUniversiteTuruLabel(program.universiteTuru)}`);
        console.log(`${c.bold}${c.cyan}═════════════════════════════════════════════════════════════════════${c.reset}\n`);

        console.log(`${c.bold}4 Yıllık İstatistik Geçmişi:${c.reset}`);
        const allYears = YokAtlas.getAllYears(program);
        allYears.forEach((y) => {
          const sira = y.basariSirasi ? y.basariSirasi.toLocaleString("tr-TR") : "—";
          const puan = y.minPuan ? y.minPuan.toFixed(2) : "—";
          const kont = y.kontenjan ?? "—";
          const yerl = y.yerlesen ?? "—";
          console.log(`  • ${c.bold}${y.year}:${c.reset} Sıra: ${c.bold}${sira}${c.reset} · Puan: ${puan} · Kontenjan/Yerleşen: ${yerl}/${kont}`);
        });

        const siraArg = getOpt("--sira");
        if (siraArg) {
          const sira = Number(siraArg);
          console.log(`\n${c.bold}Sıralama Analizi (${sira.toLocaleString("tr-TR")}. Sıra İçin):${c.reset}`);
          const estimate = YokAtlas.estimateAdmission(program, sira);
          const prereq = YokAtlas.checkPrerequisites(program, sira);

          console.log(`  • ${c.yellow}Yerleşme Tahmini:${c.reset} ${c.bold}${estimate.verdict.toUpperCase()}${c.reset}`);
          console.log(`    ${estimate.message}`);

          if (prereq.category) {
            console.log(`  • ${c.yellow}ÖSYM Yasal Baraj:${c.reset} ${prereq.eligible ? `${c.green}GEÇERLİ${c.reset}` : `${c.red}BARAJ ENGELİ${c.reset}`}`);
            console.log(`    ${prereq.message}`);
          }
        }
        console.log();
        break;
      }

      case "compare": {
        const kodA = argv[1];
        const kodB = argv[2];
        if (!kodA || !kodB) {
          console.error(`${c.red}Hata:${c.reset} Karşılaştırma için iki kılavuz kodu gereklidir (örn: yokatlas compare 102210277 105610543).`);
          process.exit(1);
        }
        const [a, b] = await Promise.all([YokAtlas.getProgram(kodA), YokAtlas.getProgram(kodB)]);
        if (!a || !b) {
          console.error(`${c.red}Hata:${c.reset} Programlardan biri veya ikisi bulunamadı.`);
          process.exit(1);
        }

        const cmp = YokAtlas.compare(a, b);
        if (isJson) {
          console.log(JSON.stringify(cmp, null, 2));
          return;
        }

        console.log(`\n${c.bold}Program Karşılaştırması:${c.reset}\n`);
        console.log(`  A: ${c.bold}${a.universiteAdi} - ${a.birimAdi}${c.reset}`);
        console.log(`     Sıra: ${a.current.basariSirasi?.toLocaleString("tr-TR") ?? "—"} · Puan: ${a.current.minPuan ?? "—"} · Kontenjan: ${a.current.kontenjan ?? "—"}`);
        console.log(`  B: ${c.bold}${b.universiteAdi} - ${b.birimAdi}${c.reset}`);
        console.log(`     Sıra: ${b.current.basariSirasi?.toLocaleString("tr-TR") ?? "—"} · Puan: ${b.current.minPuan ?? "—"} · Kontenjan: ${b.current.kontenjan ?? "—"}`);

        console.log(`\n  ${c.cyan}Sonuç:${c.reset}`);
        if (cmp.moreCompetitive === "a") {
          console.log(`  Program A, Program B'den ${Math.abs(cmp.scoreDiff!).toLocaleString("tr-TR")} sıra daha rekabetçi.`);
        } else if (cmp.moreCompetitive === "b") {
          console.log(`  Program B, Program A'dan ${Math.abs(cmp.scoreDiff!).toLocaleString("tr-TR")} sıra daha rekabetçi.`);
        } else {
          console.log(`  İki program başarı sırası açısından eşit veya belirsiz.`);
        }
        console.log();
        break;
      }

      case "baraj": {
        const kod = argv[1];
        const sira = Number(argv[2]);
        if (!kod || isNaN(sira)) {
          console.error(`${c.red}Hata:${c.reset} Kullanım: yokatlas baraj <kılavuzKodu> <başarıSırası>`);
          process.exit(1);
        }
        const program = await YokAtlas.getProgram(kod);
        if (!program) {
          console.error(`${c.red}Hata:${c.reset} ${kod} kodlu program bulunamadı.`);
          process.exit(1);
        }
        const check = YokAtlas.checkPrerequisites(program, sira);
        if (isJson) {
          console.log(JSON.stringify(check, null, 2));
          return;
        }
        console.log(`\n${c.bold}ÖSYM Baraj Kontrolü:${c.reset}`);
        console.log(`  Program: ${program.universiteAdi} - ${program.birimAdi}`);
        console.log(`  Durum: ${check.eligible ? `${c.green}GEÇERLİ / UYGUN${c.reset}` : `${c.red}TERCİH EDİLEMEZ${c.reset}`}`);
        console.log(`  Açıklama: ${check.message}\n`);
        break;
      }

      case "unis": {
        const unis = await YokAtlas.listUniversities();
        if (isJson) {
          console.log(JSON.stringify(unis, null, 2));
          return;
        }
        console.log(`\n${c.bold}YÖK Atlas Üniversiteleri (Toplam: ${unis.length}):${c.reset}\n`);
        unis.forEach((u) => console.log(`  ${c.dim}${u.universiteId.toString().padStart(4, " ")}${c.reset}  ${u.universiteAdi}`));
        console.log();
        break;
      }

      case "cities": {
        const cities = await YokAtlas.listCities();
        if (isJson) {
          console.log(JSON.stringify(cities, null, 2));
          return;
        }
        console.log(`\n${c.bold}YÖK Atlas İlleri (Toplam: ${cities.length}):${c.reset}\n`);
        cities.forEach((ci) => console.log(`  ${c.dim}${ci.ilKodu.toString().padStart(3, " ")}${c.reset}  ${ci.ilAdi}`));
        console.log();
        break;
      }

      default:
        console.error(`${c.red}Bilinmeyen komut:${c.reset} ${command}`);
        console.log(`Komut listesi için ${c.green}yokatlas --help${c.reset} çalıştırın.`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n${c.red}Hata:${c.reset} ${(err as Error).message || String(err)}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
