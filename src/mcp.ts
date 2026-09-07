import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { YokAtlas } from "./yokatlas";
import type { DegreeType, PuanTuru, SearchFilters, UserNetScores } from "./types";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "YOKATLAS API Server",
    version: "1.1.0",
  });

  // 1. Program arama
  server.tool(
    "search_programs",
    "YÖK Atlas tercih kılavuzunda (lisans ve önlisans) akıllı arama yapar. Her sonuç 4 yıllık kontenjan, yerleşen, taban puanı ve başarı sırası istatistiklerini içerir.",
    {
      degree_type: z
        .enum(["bachelor", "associate", "lisans", "onlisans"])
        .optional()
        .describe("Program seviyesi: 'bachelor'/'lisans' (46) veya 'associate'/'onlisans' (47). Boş bırakılırsa ikisi de döner."),
      puan_turu: z
        .enum(["SAY", "SÖZ", "EA", "DİL", "TYT", "SOZ", "DIL"])
        .optional()
        .describe("Puan türü: SAY, SÖZ, EA, DİL veya TYT. ASCII (SOZ/DIL) otomatik normalize edilir."),
      universite: z
        .string()
        .optional()
        .describe("Üniversite adı (akıllı fuzzy eşleştirme, örn: 'boğaziçi' -> 'BOĞAZİÇİ ÜNİVERSİTESİ')."),
      program: z
        .string()
        .optional()
        .describe("Program grubu (akıllı fuzzy eşleştirme, örn: 'bilgisayar' -> 'Bilgisayar Mühendisliği')."),
      il: z
        .string()
        .optional()
        .describe("İl adı (akıllı fuzzy eşleştirme, örn: 'ankara', 'istanbul')."),
      universite_turu: z
        .enum(["DEVLET", "VAKIF"])
        .optional()
        .describe("Üniversite türü: DEVLET veya VAKIF."),
      burs_turu: z
        .enum(["ucretsiz", "tam", "%50", "%25"])
        .optional()
        .describe("Burs oranı filtre kısayolu."),
      kilavuz_kodu: z
        .number()
        .int()
        .optional()
        .describe("ÖSYM kılavuz kodu — tek bir programa filtreler (örn: 102210277)."),
      min_basari_sirasi: z
        .number()
        .int()
        .optional()
        .describe("Minimum başarı sırası (alt sınır)."),
      max_basari_sirasi: z
        .number()
        .int()
        .optional()
        .describe("Maksimum başarı sırası (üst sınır)."),
      sort_by: z
        .string()
        .default("basariSirasi")
        .describe("Sıralama alanı (basariSirasi, minPuan, kontenjan)."),
      direction: z
        .enum(["ASC", "DESC"])
        .default("ASC")
        .describe("Sıralama yönü (ASC veya DESC)."),
      page: z
        .number()
        .int()
        .default(0)
        .describe("Sayfa numarası (0-indexed)."),
      size: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(20)
        .describe("Sayfa başına kayıt sayısı (en fazla 500)."),
    },
    async (args) => {
      try {
        const filters: SearchFilters = {};
        if (args.degree_type) filters.degreeType = args.degree_type as DegreeType;
        if (args.puan_turu) filters.puanTuru = args.puan_turu as PuanTuru;
        if (args.universite) filters.universite = args.universite;
        if (args.program) filters.program = args.program;
        if (args.il) filters.il = args.il;
        if (args.universite_turu) filters.universiteTuru = args.universite_turu;
        if (args.burs_turu) filters.bursTuru = args.burs_turu;
        if (args.kilavuz_kodu) filters.kilavuzKodu = args.kilavuz_kodu;
        if (args.min_basari_sirasi) filters.minBasariSirasi = args.min_basari_sirasi;
        if (args.max_basari_sirasi) filters.maxBasariSirasi = args.max_basari_sirasi;

        const result = await YokAtlas.search(filters, {
          page: args.page,
          size: args.size,
          sortBy: args.sort_by,
          direction: args.direction,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 2. Net Sihirbazı
  server.tool(
    "search_netler",
    "YÖK Atlas Net Sihirbazı'nı sorgular: program ve üniversiteye yerleşen son kişinin ders bazındaki TYT/AYT/YDT net sayıları.",
    {
      universite: z
        .string()
        .optional()
        .describe("Üniversite adı (akıllı fuzzy eşleştirme)."),
      program: z
        .string()
        .optional()
        .describe("Program adı (akıllı fuzzy eşleştirme)."),
      puan_turu: z
        .enum(["SAY", "SÖZ", "EA", "DİL", "TYT", "SOZ", "DIL"])
        .optional()
        .describe("Puan türü."),
      universite_turu: z
        .enum(["DEVLET", "VAKIF"])
        .optional()
        .describe("Üniversite türü."),
      yil: z
        .number()
        .int()
        .optional()
        .describe("Yıl filtresi (örn: 2024)."),
      page: z
        .number()
        .int()
        .default(0)
        .describe("Sayfa numarası (0-indexed)."),
      size: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(20)
        .describe("Sayfa boyutu."),
    },
    async (args) => {
      try {
        const result = await YokAtlas.searchNetler(
          {
            universite: args.universite,
            program: args.program,
            puanTuru: args.puan_turu as PuanTuru,
            universiteTuru: args.universite_turu,
            yil: args.yil,
          },
          { page: args.page, size: args.size }
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 3. Tekil program getirme
  server.tool(
    "get_program",
    "ÖSYM kılavuz koduna (9 haneli) göre tek bir programın tüm güncel ve geçmiş 3 yıllık detaylarını getirir.",
    {
      kilavuz_kodu: z
        .union([z.number().int(), z.string()])
        .describe("ÖSYM kılavuz kodu (örn: 102210277)."),
    },
    async ({ kilavuz_kodu }) => {
      try {
        const program = await YokAtlas.getProgram(kilavuz_kodu);
        if (!program) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Program bulunamadı" }, null, 2) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(program, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 4. Üniversite listesi
  server.tool(
    "list_universities",
    "YÖK Atlas sistemindeki tüm üniversitelerin (ID ve resmi ad) listesini döner.",
    {},
    async () => {
      try {
        const unis = await YokAtlas.listUniversities();
        return {
          content: [{ type: "text", text: JSON.stringify({ count: unis.length, universities: unis }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 5. Program grupları listesi
  server.tool(
    "list_program_groups",
    "YÖK Atlas sistemindeki tüm kanonik program gruplarını (ID, ad, puan türü) listeler.",
    {},
    async () => {
      try {
        const groups = await YokAtlas.listProgramGroups();
        return {
          content: [{ type: "text", text: JSON.stringify({ count: groups.length, programGroups: groups }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 6. İl listesi
  server.tool(
    "list_cities",
    "YÖK Atlas sisteminde yer alan tüm illeri (plaka kodu ve ad) listeler.",
    {},
    async () => {
      try {
        const cities = await YokAtlas.listCities();
        return {
          content: [{ type: "text", text: JSON.stringify({ count: cities.length, cities }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 7. Yerleşme tahmini
  server.tool(
    "estimate_admission",
    "Öğrencinin kendi YKS başarı sırasını hedef programın kesme sırasıyla kıyaslayarak yerleşme olasılığı tahmini üretir.",
    {
      kilavuz_kodu: z.number().int().describe("ÖSYM kılavuz kodu."),
      basari_sirasi: z.number().int().describe("Öğrencinin sınav başarı sırası."),
    },
    async ({ kilavuz_kodu, basari_sirasi }) => {
      try {
        const program = await YokAtlas.getProgram(kilavuz_kodu);
        if (!program) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Program bulunamadı" }, null, 2) }],
            isError: true,
          };
        }
        const estimate = YokAtlas.estimateAdmission(program, basari_sirasi);
        return {
          content: [{ type: "text", text: JSON.stringify(estimate, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 8. İki programı karşılaştırma
  server.tool(
    "compare_programs",
    "İki üniversite programını güncel yıl kesme başarı sıraları, taban puanları ve kontenjanları açısından kıyaslar.",
    {
      kilavuz_kodu_a: z.number().int().describe("İlk programın kılavuz kodu."),
      kilavuz_kodu_b: z.number().int().describe("İkinci programın kılavuz kodu."),
    },
    async ({ kilavuz_kodu_a, kilavuz_kodu_b }) => {
      try {
        const [a, b] = await Promise.all([
          YokAtlas.getProgram(kilavuz_kodu_a),
          YokAtlas.getProgram(kilavuz_kodu_b),
        ]);
        if (!a || !b) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Programlardan biri veya ikisi bulunamadı." }, null, 2) }],
            isError: true,
          };
        }
        const comparison = YokAtlas.compare(a, b);
        return {
          content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 9. Program başarı sırası eğilimi
  server.tool(
    "get_program_trend",
    "Bir programın geçmiş yıllardaki başarı sıralarına bakarak rekabet eğilimini (yükseliyor, düşüyor, sabit) raporlar.",
    {
      kilavuz_kodu: z.number().int().describe("ÖSYM kılavuz kodu."),
    },
    async ({ kilavuz_kodu }) => {
      try {
        const program = await YokAtlas.getProgram(kilavuz_kodu);
        if (!program) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Program bulunamadı" }, null, 2) }],
            isError: true,
          };
        }
        const trend = YokAtlas.getTrend(program);
        return {
          content: [{ type: "text", text: JSON.stringify(trend, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 10. Net karşılaştırması
  server.tool(
    "compare_nets",
    "Öğrencinin kendi TYT ve AYT deneme netlerini bir programın Net Sihirbazı verisiyle ders bazında kıyaslar.",
    {
      kilavuz_kodu: z.number().int().describe("Hedef programın ÖSYM kılavuz kodu."),
      tyt_trk: z.number().optional().describe("TYT Türkçe neti."),
      tyt_sos: z.number().optional().describe("TYT Sosyal neti."),
      tyt_mat: z.number().optional().describe("TYT Matematik neti."),
      tyt_fen: z.number().optional().describe("TYT Fen neti."),
      ayt_mat: z.number().optional().describe("AYT Matematik neti."),
      ayt_fiz: z.number().optional().describe("AYT Fizik neti."),
      ayt_kim: z.number().optional().describe("AYT Kimya neti."),
      ayt_bio: z.number().optional().describe("AYT Biyoloji neti."),
      ayt_tde: z.number().optional().describe("AYT Edebiyat neti."),
      ayt_trh1: z.number().optional().describe("AYT Tarih-1 neti."),
      ayt_cog1: z.number().optional().describe("AYT Coğrafya-1 neti."),
      ydt_ydil: z.number().optional().describe("YDT Yabancı Dil neti."),
    },
    async (args) => {
      try {
        const netPage = await YokAtlas.searchNetler({
          kilavuzKodu: args.kilavuz_kodu,
        } as any, { size: 1 });

        if (!netPage.content.length) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Hedef program için Net Sihirbazı verisi bulunamadı." }, null, 2) }],
            isError: true,
          };
        }

        const userNets: UserNetScores = {
          tytTrkNet: args.tyt_trk,
          tytSosNet: args.tyt_sos,
          tytMatNet: args.tyt_mat,
          tytFenNet: args.tyt_fen,
          aytMatNet: args.ayt_mat,
          aytFizNet: args.ayt_fiz,
          aytKimNet: args.ayt_kim,
          aytBioNet: args.ayt_bio,
          aytTdeNet: args.ayt_tde,
          aytTrh1Net: args.ayt_trh1,
          aytCog1Net: args.ayt_cog1,
          ydtYdilNet: args.ydt_ydil,
        };

        const comparison = YokAtlas.compareNets(userNets, netPage.content[0]);
        return {
          content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  // 11. ÖSYM baraj şartı kontrolü
  server.tool(
    "check_prerequisites",
    "Bir program için ÖSYM yasal başarı sırası baraj şartının (Tıp 50k, Diş 80k, Eczacılık 100k, Hukuk 125k, Mimarlık 250k, Mühendislik 300k, Öğretmenlik 300k) sağlanıp sağlanmadığını kontrol eder.",
    {
      kilavuz_kodu: z.number().int().describe("ÖSYM kılavuz kodu."),
      basari_sirasi: z.number().int().describe("Öğrencinin başarı sırası."),
    },
    async ({ kilavuz_kodu, basari_sirasi }) => {
      try {
        const program = await YokAtlas.getProgram(kilavuz_kodu);
        if (!program) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Program bulunamadı" }, null, 2) }],
            isError: true,
          };
        }
        const check = YokAtlas.checkPrerequisites(program, basari_sirasi);
        return {
          content: [{ type: "text", text: JSON.stringify(check, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
