// server/index-prod.ts
import fs6 from "node:fs";
import path6 from "node:path";

// server/app.ts
import express from "express";

// server/routes.ts
import { Router } from "express";

// server/storage.ts
import fs from "fs/promises";
import path from "path";
var DATA_FILE = path.join(process.cwd(), "client", "src", "data", "db_expedientes.json");
var JSONStorage = class {
  async getAllExpedientes() {
    try {
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const expedientes = JSON.parse(data);
      return expedientes.sort((a, b) => {
        const dateA = new Date(a.fecha_ingreso);
        const dateB = new Date(b.fecha_ingreso);
        if (dateB.getTime() === dateA.getTime()) {
          const numA = parseInt(a.expediente.match(/^(\d+)/)?.[1] || "0");
          const numB = parseInt(b.expediente.match(/^(\d+)/)?.[1] || "0");
          return numB - numA;
        }
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error("[Storage] Error al leer expedientes:", error);
      return [];
    }
  }
  async getExpedienteById(id) {
    const expedientes = await this.getAllExpedientes();
    return expedientes.find((exp) => exp.id === id);
  }
  async searchExpedientes(query) {
    const expedientes = await this.getAllExpedientes();
    const q = query.toLowerCase();
    return expedientes.filter(
      (exp) => exp.expediente.toLowerCase().includes(q) || exp.sumario.toLowerCase().includes(q) || exp.autores.some((a) => a.toLowerCase().includes(q))
    );
  }
  async filterExpedientes(filters) {
    let expedientes = await this.getAllExpedientes();
    if (filters.camara && filters.camara !== "all") {
      expedientes = expedientes.filter((exp) => exp.c\u00E1mara === filters.camara);
    }
    if (filters.tipo && filters.tipo.length > 0) {
      expedientes = expedientes.filter((exp) => filters.tipo.includes(exp.tipo_expediente));
    }
    if (filters.estado && filters.estado.length > 0) {
      expedientes = expedientes.filter((exp) => filters.estado.includes(exp.estado));
    }
    if (filters.bloque && filters.bloque.length > 0) {
      expedientes = expedientes.filter(
        (exp) => exp.bloque.some((b) => filters.bloque.includes(b))
      );
    }
    if (filters.provincia && filters.provincia.length > 0) {
      expedientes = expedientes.filter(
        (exp) => exp.provincias.some((p) => filters.provincia.includes(p))
      );
    }
    if (filters.hasOD) {
      expedientes = expedientes.filter((exp) => exp.OD_DIPUTADOS || exp.OD_SENADO);
    }
    if (filters.inCommission) {
      expedientes = expedientes.filter(
        (exp) => exp.estado.toLowerCase().includes("comisi\xF3n") || exp.derivaciones && exp.derivaciones.length > 0
      );
    }
    if (filters.dateFrom) {
      expedientes = expedientes.filter((exp) => {
        const expDate = new Date(exp.fecha_ingreso);
        const fromDate = new Date(filters.dateFrom);
        return expDate >= fromDate;
      });
    }
    if (filters.dateTo) {
      expedientes = expedientes.filter((exp) => {
        const expDate = new Date(exp.fecha_ingreso);
        const toDate = new Date(filters.dateTo);
        return expDate <= toDate;
      });
    }
    return expedientes;
  }
  async saveExpedientes(expedientes) {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), "utf-8");
      console.log("[Storage] Expedientes guardados correctamente");
    } catch (error) {
      console.error("[Storage] Error al guardar expedientes:", error);
      throw error;
    }
  }
};
var storage = new JSONStorage();

// server/ordenes-scraper.ts
import axios from "axios";
import { parse } from "node-html-parser";
import fs2 from "fs/promises";
import path2 from "path";
var OD_DATA_FILE = path2.join(process.cwd(), "client", "src", "data", "db_ordenes_dia.json");
var OrdenesDiaScraper = class {
  baseUrlDiputados = "https://www2.hcdn.gob.ar/secparl/dcomisiones/s_od";
  senadoUrl = "https://www.senado.gob.ar";
  /**
   * Extrae Órdenes del Día de Diputados desde el buscador oficial
   * SOLO extrae OD que sean "Pedidos de Informes"
   * Fuente: https://www2.hcdn.gob.ar/secparl/dcomisiones/s_od/buscador.html
   */
  async scrapeOrdenesDiputados() {
    const ordenes = [];
    try {
      console.log("[OD Scraper] \u{1F3DB}\uFE0F Extrayendo \xD3rdenes del D\xEDa de HCDN (solo Pedidos de Informes)...");
      const url = `${this.baseUrlDiputados}/buscador.html`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SIL/1.0)" },
        timeout: 3e4
      });
      const html = parse(response.data);
      const rows = html.querySelectorAll("table tbody tr");
      console.log(`[OD Scraper] Encontradas ${rows.length} filas en el buscador`);
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) continue;
        try {
          const periodoText = cells[0]?.text.trim() || "";
          const numeroText = cells[1]?.text.trim() || "";
          const odNumeroCompleto = cells[2]?.text.trim() || "";
          const sumario = cells[3]?.text.trim() || "Sin sumario";
          const sumarioLower = sumario.toLowerCase();
          if (!sumarioLower.includes("pedido de informe") && !sumarioLower.includes("pedidos de informe")) {
            continue;
          }
          const comision = cells[4]?.text.trim() || "COMISION";
          const expedienteText = cells[5]?.text.trim() || "";
          const expedienteText2 = cells[6]?.text.trim() || "";
          const tipoProyecto = cells.length > 7 ? cells[7]?.text.trim() || "" : "";
          let pdfLink = null;
          for (let i = 7; i < cells.length; i++) {
            const linkEl = cells[i]?.querySelector("a");
            if (linkEl) {
              pdfLink = linkEl.getAttribute("href");
              break;
            }
          }
          const expedientes = [];
          const allExpText = expedienteText + " " + expedienteText2;
          const expMatches = allExpText.match(/(\d{4,5}-D-\d{4})/g);
          if (expMatches) {
            const uniqueExps = Array.from(new Set(expMatches));
            expedientes.push(...uniqueExps.slice(0, 10));
          }
          const autores = [];
          const autorMatches = expedienteText.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/g);
          if (autorMatches) {
            autores.push(...autorMatches.slice(0, 5));
          }
          if (autores.length === 0) autores.push("Diputado Nacional");
          const bloques = [];
          const bloquePatterns = [
            "UCR",
            "PRO",
            "FDT",
            "UNION POR LA PATRIA",
            "LA LIBERTAD AVANZA",
            "UP",
            "HACEMOS",
            "Coalici\xF3n C\xEDvica"
          ];
          for (const bloque of bloquePatterns) {
            if (sumario.toUpperCase().includes(bloque.toUpperCase())) {
              if (!bloques.includes(bloque)) bloques.push(bloque);
            }
          }
          if (bloques.length === 0) bloques.push("BLOQUE PARLAMENTARIO");
          let estado = "Presentado";
          if (tipoProyecto.toLowerCase().includes("ley")) {
            estado = "PENDIENTE en el MSN";
          } else if (tipoProyecto.toLowerCase().includes("resol")) {
            estado = "Presentado";
          }
          ordenes.push({
            id: `OD-${numeroText}-D`,
            numero_od: odNumeroCompleto || `OD-${numeroText}`,
            camara: "Diputados",
            fecha_od: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            comision,
            estado,
            expedientes,
            autores,
            bloque: bloques,
            extracto: sumario,
            link_pdf: pdfLink ? `https://www4.hcdn.gob.ar${pdfLink}` : void 0
          });
        } catch (err) {
          continue;
        }
      }
      console.log(`[OD Scraper] \u2705 Diputados: ${ordenes.length} \xD3rdenes del D\xEDa extra\xEDdas`);
    } catch (error) {
      console.error("[OD Scraper] \u274C Error extrayendo Diputados:", error.message);
    }
    return ordenes;
  }
  /**
   * Extrae Órdenes del Día del Senado
   * NOTA: La página oficial está en mantenimiento, usando números específicos de referencia
   * Números de OD extraídos del listado oficial: 671, 577, 575, 454, 374, 316, 279, 278, 277, 276, 275
   */
  async scrapeOrdenesSenado() {
    const ordenes = [];
    try {
      console.log("[OD Scraper] \u{1F3DB}\uFE0F Extrayendo \xD3rdenes del D\xEDa del Senado...");
      console.log("[OD Scraper] \u26A0\uFE0F  P\xE1gina en mantenimiento - usando n\xFAmeros de referencia");
      const odData = {
        671: { expedientes: ["S-1930/2025", "S-2039/2025"], pdfId: "43763", estado: "APROBADO" },
        577: { expedientes: ["S-577/2025"], pdfId: "43182", estado: "APROBADO" },
        575: { expedientes: ["S-575/2025"], pdfId: "43181", estado: "PENDIENTE" },
        454: { expedientes: ["S-454/2025"], pdfId: "42964", estado: "PENDIENTE" },
        374: { expedientes: ["S-374/2025"], pdfId: "42868", estado: "PENDIENTE" },
        316: { expedientes: ["S-316/2025"], pdfId: "42810", estado: "PENDIENTE" },
        279: { expedientes: ["S-279/2025"], pdfId: "42740", estado: "PENDIENTE" },
        278: { expedientes: ["S-278/2025"], pdfId: "42739", estado: "PENDIENTE" },
        277: { expedientes: ["S-277/2025"], pdfId: "42738", estado: "PENDIENTE" },
        276: { expedientes: ["S-276/2025"], pdfId: "42737", estado: "PENDIENTE" },
        275: { expedientes: ["S-275/2025"], pdfId: "42736", estado: "PENDIENTE" }
      };
      for (const [numero, data] of Object.entries(odData)) {
        const numOd = parseInt(numero);
        const pdfLink = data.pdfId !== "PENDING" ? `https://www.senado.gob.ar/parlamentario/parlamentaria/${data.pdfId}/downloadOrdenDia` : void 0;
        ordenes.push({
          id: `OD-${numOd}-S-2025`,
          numero_od: `${numOd}/2025`,
          camara: "Senado",
          fecha_od: "2025-01-15",
          comision: "COMISIONES PERMANENTES",
          estado: data.estado,
          expedientes: data.expedientes,
          autores: ["Senador Nacional"],
          bloque: ["BLOQUE SENADO"],
          extracto: `Orden del D\xEDa ${numOd}/2025 - Pedido de Informes al Poder Ejecutivo (${data.estado.toLowerCase()})`,
          link_pdf: pdfLink
        });
      }
      const pendientes = ordenes.filter((od) => od.estado === "PENDIENTE").length;
      const aprobadas = ordenes.filter((od) => od.estado === "APROBADO").length;
      console.log(`[OD Scraper] \u2705 Senado: ${ordenes.length} \xD3rdenes del D\xEDa (${pendientes} pendientes + ${aprobadas} aprobadas)`);
    } catch (error) {
      console.error("[OD Scraper] \u274C Error extrayendo Senado:", error.message);
    }
    return ordenes;
  }
  /**
   * Extrae todas las Órdenes del Día (ambas cámaras)
   */
  async scrapeAll() {
    console.log("\n[OD Scraper] \u{1F680} INICIANDO EXTRACCI\xD3N DE \xD3RDENES DEL D\xCDA\n");
    const diputados = await this.scrapeOrdenesDiputados();
    const senado = await this.scrapeOrdenesSenado();
    const allOrdenes = [...diputados, ...senado];
    allOrdenes.sort((a, b) => {
      const numA = parseInt(a.numero_od.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.numero_od.match(/\d+/)?.[0] || "0");
      return numB - numA;
    });
    await this.saveToFile(allOrdenes);
    console.log(`
[OD Scraper] \u2705 EXTRACCI\xD3N COMPLETADA`);
    console.log(`   \u{1F4CB} Total: ${allOrdenes.length} \xD3rdenes del D\xEDa`);
    console.log(`   \u{1F3DB}\uFE0F Diputados: ${diputados.length}`);
    console.log(`   \u{1F3DB}\uFE0F Senado: ${senado.length}`);
    return allOrdenes;
  }
  /**
   * Guardar en archivo JSON
   */
  async saveToFile(ordenes) {
    try {
      const dir = path2.dirname(OD_DATA_FILE);
      await fs2.mkdir(dir, { recursive: true });
      await fs2.writeFile(OD_DATA_FILE, JSON.stringify(ordenes, null, 2), "utf-8");
      console.log(`[OD Scraper] \u{1F4BE} Guardado: ${OD_DATA_FILE}`);
    } catch (error) {
      console.error("[OD Scraper] \u274C Error al guardar:", error);
    }
  }
  /**
   * Cargar desde archivo
   */
  async loadFromFile() {
    try {
      const data = await fs2.readFile(OD_DATA_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
};
var ordenesScraper = new OrdenesDiaScraper();

// server/hcdn-api-scraper.ts
import axios2 from "axios";
import fs3 from "fs/promises";
import path3 from "path";
var DATA_FILE2 = path3.join(process.cwd(), "client", "src", "data", "db_expedientes.json");
var HCDNApiScraper = class {
  apiUrl = "https://datos.hcdn.gob.ar/api/3/action/datastore_search";
  resourceId = "22b2d52c-7a0e-426b-ac0a-a3326c388ba6";
  /**
   * Extraer expedientes desde API HCDN
   */
  async scrapeExpedientes(tipo, year, limit = 1e3) {
    const expedientes = [];
    try {
      console.log(`[HCDN API] \u{1F50D} Buscando ${tipo} de ${year}...`);
      const searchQuery = tipo === "ALL" ? year : `${tipo} ${year}`;
      const response = await axios2.get(this.apiUrl, {
        params: {
          resource_id: this.resourceId,
          q: searchQuery,
          limit
        },
        timeout: 3e4
      });
      const records = response.data.result.records;
      console.log(`[HCDN API] \u2705 Encontrados ${records.length} registros`);
      for (const record of records) {
        const expDiputados = record["Exp. Diputados"];
        const expSenado = record["Exp. Senado"];
        const camara = record["C\xE1mara Origen"];
        const expedienteNum = camara === "Diputados" ? expDiputados : expSenado;
        if (!expedienteNum || expedienteNum === "NA") continue;
        if (!expedienteNum.match(/\d+-[DPS]-202[0-9]/)) continue;
        const titulo = record["T\xEDtulo"] || "";
        const tipoProyecto = record["Tipo"] || tipo;
        const fechaPublicacion = record["Publicaci\xF3n Fecha"] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const publicacionId = record["Publicaci\xF3n ID"] || "";
        const autoresMatch = titulo.match(/^([^:]+):/);
        const autores = autoresMatch ? autoresMatch[1].split(/[;,]/).map((a) => a.trim()).filter((a) => a.length > 0).slice(0, 5) : ["Legislador Nacional"];
        let sumario = titulo;
        if (autoresMatch) {
          sumario = titulo.substring(titulo.indexOf(":") + 1).trim();
        }
        const pdfLink = `https://rest.hcdn.gob.ar/tp/${publicacionId}/${expedienteNum.replace("/", "-")}.pdf`;
        expedientes.push({
          id: expedienteNum,
          expediente: expedienteNum,
          tipo_expediente: `Proyecto de ${tipoProyecto}`,
          c\u00E1mara: camara || (expedienteNum.includes("-D-") ? "Diputados" : "Senado"),
          fecha_ingreso: fechaPublicacion.split("T")[0],
          sumario,
          autores,
          estado: "Presentado",
          bloque: ["BLOQUE PARLAMENTARIO"],
          provincias: ["CABA"],
          derivaciones: [],
          TP: publicacionId || "",
          Link_EXPTE: pdfLink,
          OD_DIPUTADOS: "",
          OD_SENADO: "",
          Link_OD: ""
        });
      }
    } catch (error) {
      console.error(`[HCDN API] \u274C Error extrayendo ${tipo}:`, error.message);
    }
    return expedientes;
  }
  /**
   * Extrae TODOS los tipos de proyectos de 2025 con paginación
   */
  async scrapeAll2025() {
    console.log("\n[HCDN API] \u{1F680} INICIANDO EXTRACCI\xD3N MASIVA 2025 CON PAGINACI\xD3N\n");
    const allExpedientes = [];
    let offset = 0;
    const limit = 1e3;
    let hasMore = true;
    while (hasMore) {
      try {
        console.log(`[HCDN API] \u{1F4E5} Buscando desde offset ${offset}...`);
        const response = await axios2.get(this.apiUrl, {
          params: {
            resource_id: this.resourceId,
            q: "2025",
            limit,
            offset
          },
          timeout: 3e4
        });
        const records = response.data.result.records;
        const total = response.data.result.total;
        console.log(`[HCDN API] \u2705 Encontrados ${records.length} registros (${offset + records.length}/${total})`);
        if (records.length === 0) {
          hasMore = false;
          break;
        }
        for (const record of records) {
          const expDiputados = record["Exp. Diputados"];
          const expSenado = record["Exp. Senado"];
          const camara = record["C\xE1mara Origen"];
          const expedienteNum = camara === "Diputados" ? expDiputados : expSenado;
          if (!expedienteNum || expedienteNum === "NA") continue;
          if (!expedienteNum.match(/\d+-[DPS]-202[0-9]/)) continue;
          const titulo = record["T\xEDtulo"] || "";
          const tipoProyecto = record["Tipo"] || "LEY";
          const fechaPublicacion = record["Publicaci\xF3n Fecha"] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const publicacionId = record["Publicaci\xF3n ID"] || "";
          const autoresMatch = titulo.match(/^([^:]+):/);
          const autores = autoresMatch ? autoresMatch[1].split(/[;,]/).map((a) => a.trim()).filter((a) => a.length > 0).slice(0, 5) : ["Legislador Nacional"];
          let sumario = titulo;
          if (autoresMatch) {
            sumario = titulo.substring(titulo.indexOf(":") + 1).trim();
          }
          const pdfLink = `https://rest.hcdn.gob.ar/tp/${publicacionId}/${expedienteNum.replace("/", "-")}.pdf`;
          allExpedientes.push({
            id: expedienteNum,
            expediente: expedienteNum,
            tipo_expediente: `Proyecto de ${tipoProyecto}`,
            c\u00E1mara: camara || (expedienteNum.includes("-D-") ? "Diputados" : "Senado"),
            fecha_ingreso: fechaPublicacion.split("T")[0],
            sumario,
            autores,
            estado: "Presentado",
            bloque: ["BLOQUE PARLAMENTARIO"],
            provincias: ["CABA"],
            derivaciones: [],
            TP: publicacionId || "",
            Link_EXPTE: pdfLink,
            OD_DIPUTADOS: "",
            OD_SENADO: "",
            Link_OD: ""
          });
        }
        offset += limit;
        if (offset >= total || records.length < limit) {
          hasMore = false;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[HCDN API] \u274C Error en offset ${offset}:`, error.message);
        hasMore = false;
      }
    }
    const unique = this.removeDuplicates(allExpedientes);
    unique.sort((a, b) => {
      return new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime();
    });
    await this.saveToFile(unique);
    console.log(`
[HCDN API] \u2705 EXTRACCI\xD3N COMPLETADA`);
    console.log(`   \u{1F4CB} Total Expedientes: ${unique.length}`);
    console.log(`   \u{1F3DB}\uFE0F Diputados: ${unique.filter((e) => e.c\u00E1mara === "Diputados").length}`);
    console.log(`   \u{1F3DB}\uFE0F Senado: ${unique.filter((e) => e.c\u00E1mara === "Senado").length}`);
    console.log(`   \u{1F4DC} Resoluciones: ${unique.filter((e) => e.tipo_expediente.includes("RESOLUCION")).length}`);
    console.log(`   \u{1F4E2} Comunicaciones: ${unique.filter((e) => e.tipo_expediente.includes("COMUNICACION")).length}`);
    console.log(`   \u{1F4DD} Declaraciones: ${unique.filter((e) => e.tipo_expediente.includes("DECLARACION")).length}
`);
    return unique;
  }
  removeDuplicates(expedientes) {
    const seen = /* @__PURE__ */ new Set();
    return expedientes.filter((exp) => {
      if (seen.has(exp.expediente)) return false;
      seen.add(exp.expediente);
      return true;
    });
  }
  async saveToFile(expedientes) {
    try {
      await fs3.writeFile(DATA_FILE2, JSON.stringify(expedientes, null, 2), "utf-8");
      console.log(`[HCDN API] \u{1F4BE} Datos guardados en ${DATA_FILE2}`);
    } catch (error) {
      console.error("[HCDN API] \u274C Error al guardar archivo:", error);
      throw error;
    }
  }
  async loadFromFile() {
    try {
      const data = await fs3.readFile(DATA_FILE2, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("[HCDN API] Error al leer archivo:", error);
      return [];
    }
  }
};
var hcdnApiScraper = new HCDNApiScraper();

// server/hcdn-complete-scraper.ts
import axios3 from "axios";
import * as cheerio from "cheerio";
import fs4 from "fs/promises";
import path4 from "path";
var DATA_FILE3 = path4.join(process.cwd(), "client", "src", "data", "db_expedientes.json");
var BACKUP_DIR = path4.join(process.cwd(), "backups");
var HCDNCompleteScraper = class {
  baseUrl = "https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp";
  apiUrl = "https://datos.hcdn.gob.ar/api/3/action/datastore_search";
  resourceId = "22b2d52c-7a0e-426b-ac0a-a3326c388ba6";
  async scrapeExpedienteCompleto(expedienteNum) {
    try {
      const url = `${this.baseUrl}?exp=${expedienteNum}`;
      const response = await axios3.get(url, {
        timeout: 15e3,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"
        }
      });
      const $ = cheerio.load(response.data);
      const expedienteText = $('p:contains("Expediente")').text() || "";
      if (!expedienteText.includes(expedienteNum.split("-")[0])) {
        return null;
      }
      let tipoProyecto = "Proyecto de LEY";
      const sumarioElement = $('p:contains("Sumario:")').next("p").text().trim() || $('p:contains("Sumario:")').text().replace("Sumario:", "").trim();
      const sumarioText = sumarioElement || $("p").filter((_, el) => {
        const text = $(el).text();
        return text.includes("PEDIDO DE INFORMES") || text.includes("PROYECTO DE LEY") || text.includes("PROYECTO DE RESOLUCION") || text.includes("PROYECTO DE COMUNICACION") || text.includes("PROYECTO DE DECLARACION");
      }).first().text().trim();
      if (sumarioText.includes("PEDIDO DE INFORMES") || sumarioText.includes("PEDIDO DE INFORME")) {
        tipoProyecto = "PEDIDO DE INFORMES";
      } else if (sumarioText.includes("RESOLUCION") || sumarioText.includes("RESOLUCI\xD3N")) {
        tipoProyecto = "Proyecto de RESOLUCI\xD3N";
      } else if (sumarioText.includes("COMUNICACION") || sumarioText.includes("COMUNICACI\xD3N")) {
        tipoProyecto = "Proyecto de COMUNICACI\xD3N";
      } else if (sumarioText.includes("DECLARACION") || sumarioText.includes("DECLARACI\xD3N")) {
        tipoProyecto = "Proyecto de DECLARACI\xD3N";
      }
      let fecha = "";
      const fechaMatch = $('p:contains("Fecha:")').text().match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (fechaMatch) {
        fecha = `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
      } else {
        const anyFecha = $("body").text().match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/);
        if (anyFecha) {
          fecha = `${anyFecha[3]}-${anyFecha[2]}-${anyFecha[1]}`;
        }
      }
      let tramiteParlamentario = "";
      const tpMatch = $('p:contains("Publicado en:")').text().match(/Trámite Parlamentario N°?\s*(\d+)/i) || $("body").text().match(/Trámite Parlamentario N°?\s*(\d+)/i);
      if (tpMatch) {
        tramiteParlamentario = `TP-${tpMatch[1]}`;
      }
      const firmantes = [];
      $("table").each((_, table) => {
        const headers = $(table).find("th").map((_2, th) => $(th).text().trim().toLowerCase()).get();
        if (headers.some((h) => h.includes("firmante") || h.includes("diputado") || h.includes("senador"))) {
          $(table).find("tbody tr, tr").each((i, row) => {
            if (i === 0 && $(row).find("th").length > 0) return;
            const cells = $(row).find("td");
            if (cells.length >= 2) {
              const nombre = $(cells[0]).text().trim();
              const distrito = $(cells[1]).text().trim();
              const bloque = cells.length >= 3 ? $(cells[2]).text().trim() : "";
              if (nombre && nombre.length > 2 && !nombre.includes("Firmante")) {
                firmantes.push({
                  nombre,
                  distrito: distrito || void 0,
                  bloque: bloque || void 0,
                  tipo: firmantes.length === 0 ? "autor" : "coautor"
                });
              }
            }
          });
        }
      });
      const comisiones = [];
      $("table").each((_, table) => {
        const headers = $(table).find("th").map((_2, th) => $(th).text().trim().toLowerCase()).get();
        if (headers.some((h) => h.includes("comisi") || h.includes("giro"))) {
          $(table).find("tbody tr, tr").each((i, row) => {
            if (i === 0 && $(row).find("th").length > 0) return;
            const cell = $(row).find("td").first().text().trim();
            if (cell && cell.length > 2) {
              comisiones.push(cell.replace(/\s*\(Primera Competencia\)\s*/gi, "").trim());
            }
          });
        }
      });
      const bodyText = $("body").text();
      const giroMatch = bodyText.match(/Giro a comisiones[^:]*:?\s*([A-ZÁÉÍÓÚÑ\s,]+)(?:\.|$)/i);
      if (giroMatch && comisiones.length === 0) {
        const comisionesText = giroMatch[1].split(/[,;]/).map((c) => c.trim()).filter((c) => c.length > 3);
        comisiones.push(...comisionesText);
      }
      const tramites = [];
      $("table").each((_, table) => {
        const headers = $(table).find("th").map((_2, th) => $(th).text().trim().toLowerCase()).get();
        if (headers.some((h) => h.includes("movimiento") || h.includes("tr\xE1mite") || h.includes("tramite"))) {
          $(table).find("tbody tr, tr").each((i, row) => {
            if (i === 0 && $(row).find("th").length > 0) return;
            const cells = $(row).find("td");
            if (cells.length >= 2) {
              const camara = $(cells[0]).text().trim();
              const movimiento = $(cells[1]).text().trim();
              const fechaTramite = cells.length >= 3 ? $(cells[2]).text().trim() : "";
              const resultado = cells.length >= 4 ? $(cells[3]).text().trim() : "";
              if (movimiento && movimiento.length > 2) {
                tramites.push({
                  camara: camara || void 0,
                  movimiento,
                  fecha: fechaTramite || "",
                  resultado: resultado || void 0
                });
              }
            }
          });
        }
      });
      const autores = firmantes.length > 0 ? firmantes.slice(0, 5).map((f) => f.nombre) : ["Legislador Nacional"];
      const bloquesSet = /* @__PURE__ */ new Set();
      firmantes.forEach((f) => {
        if (f.bloque) bloquesSet.add(f.bloque);
      });
      const bloques = Array.from(bloquesSet);
      const provinciasSet = /* @__PURE__ */ new Set();
      firmantes.forEach((f) => {
        if (f.distrito) provinciasSet.add(f.distrito);
      });
      const provincias = Array.from(provinciasSet);
      const derivaciones = comisiones.map((comision) => ({
        comision,
        fecha: fecha || "",
        estado: "Giro"
      }));
      const pdfLink = `https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/${expedienteNum}.pdf`;
      const linkExpte = `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expedienteNum}`;
      console.log(`[Complete Scraper] \u2705 ${expedienteNum}: ${tipoProyecto} - ${firmantes.length} firmantes, ${comisiones.length} comisiones`);
      return {
        id: expedienteNum,
        expediente: expedienteNum,
        tipo_expediente: tipoProyecto,
        c\u00E1mara: expedienteNum.includes("-D-") ? "Diputados" : "Senado",
        estado: "Presentado",
        fecha_ingreso: fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        autores,
        bloque: bloques.length > 0 ? bloques : ["BLOQUE PARLAMENTARIO"],
        provincias: provincias.length > 0 ? provincias : ["CABA"],
        OD_DIPUTADOS: "",
        OD_SENADO: "",
        Fecha_OD: "",
        Link_OD: "",
        Link_EXPTE: linkExpte,
        TP: tramiteParlamentario,
        derivaciones,
        sumario: sumarioText || "Sin sumario disponible",
        extracto: sumarioText || "",
        firmantes,
        tramites,
        tramite_parlamentario: tramiteParlamentario
      };
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error(`[Complete Scraper] \u274C Error en ${expedienteNum}:`, error.message);
      }
      return null;
    }
  }
  async scrapeRangeWithDetails(startNum, endNum, year = "2025") {
    console.log(`
[Complete Scraper] \u{1F680} EXTRAYENDO EXPEDIENTES ${startNum}-${endNum} DE ${year} CON DATOS COMPLETOS
`);
    const expedientes = [];
    const concurrency = 3;
    const batchSize = 50;
    for (let batchStart = startNum; batchStart <= endNum; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, endNum);
      console.log(`[Complete Scraper] \u{1F4E5} Procesando lote ${batchStart}-${batchEnd}...`);
      const promises = [];
      for (let num = batchStart; num <= batchEnd; num++) {
        const expedienteNum = `${num}-D-${year}`;
        promises.push(this.scrapeExpedienteCompleto(expedienteNum));
        if (promises.length >= concurrency) {
          const results = await Promise.all(promises);
          const found = results.filter((exp) => exp !== null);
          expedientes.push(...found);
          promises.length = 0;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const found = results.filter((exp) => exp !== null);
        expedientes.push(...found);
      }
      console.log(`[Complete Scraper] \u2705 ${expedientes.length} expedientes encontrados hasta ahora`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return expedientes;
  }
  async enrichExpedientesFromAPI() {
    console.log("\n[Complete Scraper] \u{1F504} ENRIQUECIENDO DATOS DESDE API HCDN\n");
    const allExpedientes = [];
    let offset = 0;
    const limit = 1e3;
    let hasMore = true;
    while (hasMore) {
      try {
        console.log(`[Complete Scraper] \u{1F4E5} API offset ${offset}...`);
        const response = await axios3.get(this.apiUrl, {
          params: {
            resource_id: this.resourceId,
            q: "2025",
            limit,
            offset
          },
          timeout: 3e4
        });
        const records = response.data.result.records;
        const total = response.data.result.total;
        if (records.length === 0) {
          hasMore = false;
          break;
        }
        for (const record of records) {
          const expDiputados = record["Exp. Diputados"];
          const expSenado = record["Exp. Senado"];
          const camara = record["C\xE1mara Origen"];
          const expedienteNum = camara === "Diputados" ? expDiputados : expSenado;
          if (!expedienteNum || expedienteNum === "NA") continue;
          if (!expedienteNum.match(/\d+-[DPS]-202[0-9]/)) continue;
          const titulo = record["T\xEDtulo"] || "";
          let tipoProyecto = record["Tipo"] || "LEY";
          const fechaPublicacion = record["Publicaci\xF3n Fecha"] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const publicacionId = record["Publicaci\xF3n ID"] || "";
          if (titulo.includes("PEDIDO DE INFORMES") || titulo.includes("PEDIDO DE INFORME")) {
            tipoProyecto = "PEDIDO DE INFORMES";
          } else if (titulo.includes("RESOLUCION") || titulo.includes("RESOLUCI\xD3N")) {
            tipoProyecto = "Proyecto de RESOLUCI\xD3N";
          } else if (titulo.includes("COMUNICACION") || titulo.includes("COMUNICACI\xD3N")) {
            tipoProyecto = "Proyecto de COMUNICACI\xD3N";
          } else if (titulo.includes("DECLARACION") || titulo.includes("DECLARACI\xD3N")) {
            tipoProyecto = "Proyecto de DECLARACI\xD3N";
          } else {
            tipoProyecto = `Proyecto de ${tipoProyecto}`;
          }
          const autoresMatch = titulo.match(/^([^:]+):/);
          const autores = autoresMatch ? autoresMatch[1].split(/[;,]/).map((a) => a.trim()).filter((a) => a.length > 0).slice(0, 5) : ["Legislador Nacional"];
          let sumario = titulo;
          if (autoresMatch) {
            sumario = titulo.substring(titulo.indexOf(":") + 1).trim();
          }
          const linkExpte = expedienteNum.includes("-D-") ? `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expedienteNum}` : `https://www.senado.gob.ar/parlamentario/comisiones/verExp/${expedienteNum.replace(/-S-/g, "/").replace("-", "/")}`;
          allExpedientes.push({
            id: expedienteNum,
            expediente: expedienteNum,
            tipo_expediente: tipoProyecto,
            c\u00E1mara: camara || (expedienteNum.includes("-D-") ? "Diputados" : "Senado"),
            fecha_ingreso: fechaPublicacion.split("T")[0],
            sumario,
            extracto: sumario,
            autores,
            estado: "Presentado",
            bloque: ["BLOQUE PARLAMENTARIO"],
            provincias: ["CABA"],
            derivaciones: [],
            TP: publicacionId || "",
            tramite_parlamentario: publicacionId ? `TP-${publicacionId}` : "",
            Link_EXPTE: linkExpte,
            OD_DIPUTADOS: "",
            OD_SENADO: "",
            Link_OD: ""
          });
        }
        offset += limit;
        if (offset >= total || records.length < limit) {
          hasMore = false;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[Complete Scraper] \u274C Error API en offset ${offset}:`, error.message);
        hasMore = false;
      }
    }
    console.log(`[Complete Scraper] \u2705 API: ${allExpedientes.length} expedientes obtenidos`);
    return allExpedientes;
  }
  async enrichWithCompleteDetails(expedientes, maxToEnrich = 500) {
    console.log(`
[Complete Scraper] \u{1F50D} ENRIQUECIENDO ${Math.min(expedientes.length, maxToEnrich)} EXPEDIENTES CON DETALLES COMPLETOS
`);
    const enriched = [];
    const toEnrich = expedientes.slice(0, maxToEnrich);
    const concurrency = 3;
    for (let i = 0; i < toEnrich.length; i += concurrency) {
      const batch = toEnrich.slice(i, i + concurrency);
      const promises = batch.map((exp) => this.scrapeExpedienteCompleto(exp.expediente));
      const results = await Promise.all(promises);
      for (let j = 0; j < batch.length; j++) {
        const original = batch[j];
        const detailed = results[j];
        if (detailed) {
          enriched.push({
            ...original,
            ...detailed,
            sumario: detailed.sumario || original.sumario,
            extracto: detailed.extracto || detailed.sumario || original.sumario
          });
        } else {
          enriched.push(original);
        }
      }
      if (i % 50 === 0) {
        console.log(`[Complete Scraper] \u{1F4CA} Progreso: ${i + batch.length}/${toEnrich.length}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    const remaining = expedientes.slice(maxToEnrich);
    return [...enriched, ...remaining];
  }
  async createBackup() {
    try {
      await fs4.mkdir(BACKUP_DIR, { recursive: true });
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const backupFile = path4.join(BACKUP_DIR, `db_expedientes_${timestamp}.json`);
      const existingData = await this.loadFromFile();
      await fs4.writeFile(backupFile, JSON.stringify(existingData, null, 2), "utf-8");
      console.log(`[Complete Scraper] \u{1F4BE} Backup creado: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error("[Complete Scraper] \u274C Error creando backup:", error);
      throw error;
    }
  }
  async saveToFile(expedientes) {
    try {
      const unique = this.removeDuplicates(expedientes);
      unique.sort((a, b) => {
        const numA = parseInt(a.expediente.match(/(\d+)-/)?.[1] || "0");
        const numB = parseInt(b.expediente.match(/(\d+)-/)?.[1] || "0");
        return numB - numA;
      });
      await fs4.writeFile(DATA_FILE3, JSON.stringify(unique, null, 2), "utf-8");
      console.log(`[Complete Scraper] \u{1F4BE} ${unique.length} expedientes guardados en ${DATA_FILE3}`);
    } catch (error) {
      console.error("[Complete Scraper] \u274C Error al guardar archivo:", error);
      throw error;
    }
  }
  async loadFromFile() {
    try {
      const data = await fs4.readFile(DATA_FILE3, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
  removeDuplicates(expedientes) {
    const seen = /* @__PURE__ */ new Map();
    for (const exp of expedientes) {
      const existing = seen.get(exp.expediente);
      if (!existing || exp.firmantes && exp.firmantes.length > 0 && (!existing.firmantes || existing.firmantes.length === 0) || exp.sumario !== "Sin sumario disponible" && existing.sumario === "Sin sumario disponible") {
        seen.set(exp.expediente, exp);
      }
    }
    return Array.from(seen.values());
  }
  async runFullExtraction() {
    console.log("\n========================================");
    console.log("\u{1F680} EXTRACCI\xD3N COMPLETA DE EXPEDIENTES HCDN");
    console.log("========================================\n");
    await this.createBackup();
    console.log("\n\u{1F4E5} PASO 1: Obteniendo expedientes desde API HCDN...\n");
    const apiExpedientes = await this.enrichExpedientesFromAPI();
    console.log("\n\u{1F4E5} PASO 2: Obteniendo expedientes recientes via scraping directo...\n");
    const recentExpedientes = await this.scrapeRangeWithDetails(6300, 6600, "2025");
    console.log("\n\u{1F504} PASO 3: Combinando y eliminando duplicados...\n");
    const combined = [...recentExpedientes, ...apiExpedientes];
    const unique = this.removeDuplicates(combined);
    console.log("\n\u{1F50D} PASO 4: Enriqueciendo los primeros 300 expedientes con detalles completos...\n");
    const enriched = await this.enrichWithCompleteDetails(unique, 300);
    await this.saveToFile(enriched);
    const stats = {
      total: enriched.length,
      diputados: enriched.filter((e) => e.c\u00E1mara === "Diputados").length,
      senado: enriched.filter((e) => e.c\u00E1mara === "Senado").length,
      pedidosInformes: enriched.filter((e) => e.tipo_expediente.includes("PEDIDO DE INFORMES")).length,
      conFirmantes: enriched.filter((e) => e.firmantes && e.firmantes.length > 0).length,
      conComisiones: enriched.filter((e) => e.derivaciones && e.derivaciones.length > 0).length
    };
    console.log("\n========================================");
    console.log("\u2705 EXTRACCI\xD3N COMPLETADA");
    console.log("========================================");
    console.log(`\u{1F4CB} Total Expedientes: ${stats.total}`);
    console.log(`\u{1F3DB}\uFE0F Diputados: ${stats.diputados}`);
    console.log(`\u{1F3DB}\uFE0F Senado: ${stats.senado}`);
    console.log(`\u{1F4DD} Pedidos de Informes: ${stats.pedidosInformes}`);
    console.log(`\u{1F465} Con firmantes: ${stats.conFirmantes}`);
    console.log(`\u{1F4C2} Con comisiones: ${stats.conComisiones}`);
    console.log("========================================\n");
    return enriched;
  }
};
var hcdnCompleteScraper = new HCDNCompleteScraper();

// server/routes.ts
import * as XLSX from "xlsx";
import fs5 from "fs/promises";
import path5 from "path";
var router = Router();
var DATA_FILE4 = path5.join(process.cwd(), "client", "src", "data", "db_expedientes.json");
var BACKUP_DIR2 = path5.join(process.cwd(), "backups");
router.get("/api/expedientes", async (req, res) => {
  try {
    let expedientes = await storage.getAllExpedientes();
    if (!expedientes || expedientes.length < 100) {
      console.log("[API] No hay datos suficientes, descargando autom\xE1ticamente desde API HCDN...");
      expedientes = await hcdnApiScraper.scrapeAll2025();
    }
    res.json(expedientes);
  } catch (error) {
    console.error("[API] Error al obtener expedientes:", error);
    res.status(500).json({ error: "Error al obtener expedientes" });
  }
});
router.get("/api/expedientes/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Par\xE1metro 'q' requerido" });
    }
    const expedientes = await storage.searchExpedientes(q);
    res.json(expedientes);
  } catch (error) {
    console.error("[API] Error en b\xFAsqueda:", error);
    res.status(500).json({ error: "Error en la b\xFAsqueda" });
  }
});
router.post("/api/expedientes/filter", async (req, res) => {
  try {
    const filters = req.body;
    const expedientes = await storage.filterExpedientes(filters);
    res.json(expedientes);
  } catch (error) {
    console.error("[API] Error al filtrar:", error);
    res.status(500).json({ error: "Error al filtrar expedientes" });
  }
});
router.get("/api/expedientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const expediente = await storage.getExpedienteById(id);
    if (!expediente) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }
    res.json(expediente);
  } catch (error) {
    console.error("[API] Error al obtener expediente:", error);
    res.status(500).json({ error: "Error al obtener expediente" });
  }
});
router.post("/api/scrape", async (req, res) => {
  try {
    console.log("[API] Iniciando descarga autom\xE1tica desde API HCDN...");
    const expedientes = await hcdnApiScraper.scrapeAll2025();
    console.log("[API] Extrayendo \xD3rdenes del D\xEDa...");
    await ordenesScraper.scrapeAll();
    res.json({
      success: true,
      count: expedientes.length,
      message: `${expedientes.length} expedientes descargados desde API HCDN`
    });
  } catch (error) {
    console.error("[API] Error en extracci\xF3n:", error);
    res.status(500).json({ error: "Error al actualizar datos" });
  }
});
router.get("/api/export/excel", async (req, res) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    if (expedientes.length === 0) {
      return res.status(404).json({ error: "No hay expedientes para exportar" });
    }
    const excelData = expedientes.map((exp) => ({
      "ID": exp.id,
      "Expediente": exp.expediente,
      "C\xE1mara": exp.c\u00E1mara,
      "Tipo": exp.tipo_expediente,
      "Estado": exp.estado,
      "Fecha Ingreso": exp.fecha_ingreso,
      "Sumario": exp.sumario,
      "Autores": exp.autores.join(", "),
      "Bloque": exp.bloque.join(", "),
      "Provincias": exp.provincias.join(", "),
      "Comisiones": exp.derivaciones.map((d) => d.comision).join(", "),
      "Orden del D\xEDa (Diputados)": exp.OD_DIPUTADOS || "",
      "Orden del D\xEDa (Senado)": exp.OD_SENADO || "",
      "Link Expediente": exp.Link_EXPTE || "",
      "Link OD": exp.Link_OD || ""
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    const colWidths = [
      { wch: 15 },
      // ID
      { wch: 20 },
      // Expediente
      { wch: 12 },
      // Cámara
      { wch: 30 },
      // Tipo
      { wch: 20 },
      // Estado
      { wch: 15 },
      // Fecha
      { wch: 80 },
      // Sumario
      { wch: 40 },
      // Autores
      { wch: 30 },
      // Bloque
      { wch: 25 },
      // Provincias
      { wch: 40 },
      // Comisiones
      { wch: 15 },
      // OD Diputados
      { wch: 15 },
      // OD Senado
      { wch: 60 },
      // Link Expediente
      { wch: 60 }
      // Link OD
    ];
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `expedientes_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);
    console.log(`[API] Excel generado: ${filename} (${expedientes.length} expedientes)`);
  } catch (error) {
    console.error("[API] Error al exportar Excel:", error);
    res.status(500).json({ error: "Error al generar archivo Excel" });
  }
});
router.get("/api/stats", async (req, res) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    const stats = {
      total: expedientes.length,
      porCamara: {
        Diputados: expedientes.filter((e) => e.c\u00E1mara === "Diputados").length,
        Senado: expedientes.filter((e) => e.c\u00E1mara === "Senado").length
      },
      porTipo: {},
      porEstado: {},
      conOD: expedientes.filter((e) => e.OD_DIPUTADOS || e.OD_SENADO).length,
      enComision: expedientes.filter(
        (e) => e.estado.toLowerCase().includes("comisi\xF3n") || e.derivaciones.length > 0
      ).length
    };
    expedientes.forEach((e) => {
      stats.porTipo[e.tipo_expediente] = (stats.porTipo[e.tipo_expediente] || 0) + 1;
      stats.porEstado[e.estado] = (stats.porEstado[e.estado] || 0) + 1;
    });
    res.json(stats);
  } catch (error) {
    console.error("[API] Error al obtener estad\xEDsticas:", error);
    res.status(500).json({ error: "Error al obtener estad\xEDsticas" });
  }
});
router.get("/api/ordenes-dia", async (req, res) => {
  try {
    let ordenes = await ordenesScraper.loadFromFile();
    if (!ordenes || ordenes.length === 0) {
      console.log("[API] No hay datos de OD, extrayendo autom\xE1ticamente...");
      ordenes = await ordenesScraper.scrapeAll();
    }
    res.json(ordenes);
  } catch (error) {
    console.error("[API] Error al obtener \xF3rdenes del d\xEDa:", error);
    res.status(500).json({ error: "Error al obtener \xF3rdenes del d\xEDa" });
  }
});
router.post("/api/ordenes-dia/scrape", async (req, res) => {
  try {
    console.log("[API] Iniciando scraping de \xD3rdenes del D\xEDa...");
    const ordenes = await ordenesScraper.scrapeAll();
    res.json({
      success: true,
      count: ordenes.length,
      message: "\xD3rdenes del D\xEDa actualizadas correctamente"
    });
  } catch (error) {
    console.error("[API] Error en scraping de OD:", error);
    res.status(500).json({ error: "Error al actualizar \xF3rdenes del d\xEDa" });
  }
});
router.post("/api/expedientes", async (req, res) => {
  try {
    const expediente = req.body;
    if (!expediente.expediente || !expediente.sumario) {
      return res.status(400).json({ error: "Expediente y sumario son requeridos" });
    }
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const expedientes = JSON.parse(data);
    const exists = expedientes.find((e) => e.expediente === expediente.expediente);
    if (exists) {
      return res.status(409).json({ error: "El expediente ya existe" });
    }
    const newExpediente = {
      id: expediente.expediente,
      expediente: expediente.expediente,
      tipo_expediente: expediente.tipo_expediente || "Proyecto de LEY",
      c\u00E1mara: expediente.c\u00E1mara || "Diputados",
      estado: expediente.estado || "Presentado",
      fecha_ingreso: expediente.fecha_ingreso || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      autores: expediente.autores || [],
      bloque: expediente.bloque || [],
      provincias: expediente.provincias || [],
      derivaciones: expediente.derivaciones || [],
      sumario: expediente.sumario,
      extracto: expediente.extracto || expediente.sumario,
      firmantes: expediente.firmantes || [],
      tramites: expediente.tramites || [],
      tramite_parlamentario: expediente.tramite_parlamentario || "",
      movimientos_internos: expediente.movimientos_internos || [],
      OD_DIPUTADOS: expediente.OD_DIPUTADOS || "",
      OD_SENADO: expediente.OD_SENADO || "",
      Link_EXPTE: expediente.Link_EXPTE || "",
      Link_OD: expediente.Link_OD || "",
      TP: expediente.TP || ""
    };
    expedientes.unshift(newExpediente);
    await fs5.writeFile(DATA_FILE4, JSON.stringify(expedientes, null, 2), "utf-8");
    console.log(`[API] Expediente creado: ${newExpediente.expediente}`);
    res.status(201).json(newExpediente);
  } catch (error) {
    console.error("[API] Error al crear expediente:", error);
    res.status(500).json({ error: "Error al crear expediente" });
  }
});
router.put("/api/expedientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const expedientes = JSON.parse(data);
    const index = expedientes.findIndex((e) => e.id === id || e.expediente === id);
    if (index === -1) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }
    expedientes[index] = {
      ...expedientes[index],
      ...updates,
      id: expedientes[index].id
    };
    await fs5.writeFile(DATA_FILE4, JSON.stringify(expedientes, null, 2), "utf-8");
    console.log(`[API] Expediente actualizado: ${id}`);
    res.json(expedientes[index]);
  } catch (error) {
    console.error("[API] Error al actualizar expediente:", error);
    res.status(500).json({ error: "Error al actualizar expediente" });
  }
});
router.delete("/api/expedientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const expedientes = JSON.parse(data);
    const index = expedientes.findIndex((e) => e.id === id || e.expediente === id);
    if (index === -1) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }
    const deleted = expedientes.splice(index, 1)[0];
    await fs5.writeFile(DATA_FILE4, JSON.stringify(expedientes, null, 2), "utf-8");
    console.log(`[API] Expediente eliminado: ${id}`);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("[API] Error al eliminar expediente:", error);
    res.status(500).json({ error: "Error al eliminar expediente" });
  }
});
router.post("/api/expedientes/:id/movimientos", async (req, res) => {
  try {
    const { id } = req.params;
    const movimiento = req.body;
    if (!movimiento.fecha || !movimiento.emisor || !movimiento.destino || !movimiento.novedad) {
      return res.status(400).json({ error: "Fecha, emisor, destino y novedad son requeridos" });
    }
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const expedientes = JSON.parse(data);
    const index = expedientes.findIndex((e) => e.id === id || e.expediente === id);
    if (index === -1) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }
    const nuevoMovimiento = {
      id: `mov-${Date.now()}`,
      fecha: movimiento.fecha,
      emisor: movimiento.emisor,
      destino: movimiento.destino,
      novedad: movimiento.novedad,
      comprobantes: movimiento.comprobantes || [],
      realizadoPor: movimiento.realizadoPor || "Sistema"
    };
    if (!expedientes[index].movimientos_internos) {
      expedientes[index].movimientos_internos = [];
    }
    expedientes[index].movimientos_internos.push(nuevoMovimiento);
    await fs5.writeFile(DATA_FILE4, JSON.stringify(expedientes, null, 2), "utf-8");
    console.log(`[API] Movimiento agregado a ${id}`);
    res.status(201).json(nuevoMovimiento);
  } catch (error) {
    console.error("[API] Error al agregar movimiento:", error);
    res.status(500).json({ error: "Error al agregar movimiento" });
  }
});
router.post("/api/backup", async (req, res) => {
  try {
    await fs5.mkdir(BACKUP_DIR2, { recursive: true });
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const backupFile = path5.join(BACKUP_DIR2, `db_expedientes_${timestamp}.json`);
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    await fs5.writeFile(backupFile, data, "utf-8");
    console.log(`[API] Backup creado: ${backupFile}`);
    res.json({
      success: true,
      file: `db_expedientes_${timestamp}.json`,
      message: "Backup creado correctamente"
    });
  } catch (error) {
    console.error("[API] Error al crear backup:", error);
    res.status(500).json({ error: "Error al crear backup" });
  }
});
router.get("/api/backups", async (req, res) => {
  try {
    await fs5.mkdir(BACKUP_DIR2, { recursive: true });
    const files = await fs5.readdir(BACKUP_DIR2);
    const backups = files.filter((f) => f.startsWith("db_expedientes_") && f.endsWith(".json")).sort().reverse().slice(0, 20);
    res.json(backups);
  } catch (error) {
    console.error("[API] Error al listar backups:", error);
    res.status(500).json({ error: "Error al listar backups" });
  }
});
router.get("/api/export/json", async (req, res) => {
  try {
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const filename = `expedientes_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(data);
    console.log(`[API] JSON exportado: ${filename}`);
  } catch (error) {
    console.error("[API] Error al exportar JSON:", error);
    res.status(500).json({ error: "Error al exportar JSON" });
  }
});
router.post("/api/restore/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const backupFile = path5.join(BACKUP_DIR2, filename);
    const stats = await fs5.stat(backupFile);
    if (!stats.isFile()) {
      return res.status(404).json({ error: "Backup no encontrado" });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const currentBackup = path5.join(BACKUP_DIR2, `db_expedientes_pre-restore_${timestamp}.json`);
    const currentData = await fs5.readFile(DATA_FILE4, "utf-8");
    await fs5.writeFile(currentBackup, currentData, "utf-8");
    const backupData = await fs5.readFile(backupFile, "utf-8");
    await fs5.writeFile(DATA_FILE4, backupData, "utf-8");
    console.log(`[API] Restaurado desde: ${filename}`);
    res.json({
      success: true,
      message: `Datos restaurados desde ${filename}`,
      previousBackup: `db_expedientes_pre-restore_${timestamp}.json`
    });
  } catch (error) {
    console.error("[API] Error al restaurar:", error);
    res.status(500).json({ error: "Error al restaurar backup" });
  }
});
router.post("/api/scrape/complete", async (req, res) => {
  try {
    console.log("[API] Iniciando extracci\xF3n completa con detalles...");
    const expedientes = await hcdnCompleteScraper.runFullExtraction();
    res.json({
      success: true,
      count: expedientes.length,
      message: `${expedientes.length} expedientes extra\xEDdos con datos completos`
    });
  } catch (error) {
    console.error("[API] Error en extracci\xF3n completa:", error);
    res.status(500).json({ error: "Error al extraer datos completos" });
  }
});
router.post("/api/expedientes/:id/enrich", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Enriqueciendo expediente: ${id}`);
    const enriched = await hcdnCompleteScraper.scrapeExpedienteCompleto(id);
    if (!enriched) {
      return res.status(404).json({ error: "No se pudo obtener datos del expediente" });
    }
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const expedientes = JSON.parse(data);
    const index = expedientes.findIndex((e) => e.id === id || e.expediente === id);
    if (index !== -1) {
      expedientes[index] = {
        ...expedientes[index],
        ...enriched
      };
      await fs5.writeFile(DATA_FILE4, JSON.stringify(expedientes, null, 2), "utf-8");
    }
    res.json(enriched);
  } catch (error) {
    console.error("[API] Error al enriquecer expediente:", error);
    res.status(500).json({ error: "Error al enriquecer expediente" });
  }
});
router.get("/api/stats", async (req, res) => {
  try {
    const data = await fs5.readFile(DATA_FILE4, "utf-8");
    const expedientes = JSON.parse(data);
    const stats = {
      total: expedientes.length,
      diputados: expedientes.filter((e) => e.c\u00E1mara === "Diputados").length,
      senado: expedientes.filter((e) => e.c\u00E1mara === "Senado").length,
      pedidosInformes: expedientes.filter(
        (e) => e.tipo_expediente?.toLowerCase().includes("informe")
      ).length,
      conFirmantes: expedientes.filter((e) => e.firmantes?.length > 0).length,
      conMovimientos: expedientes.filter((e) => e.movimientos_internos?.length > 0).length,
      ultimaActualizacion: (/* @__PURE__ */ new Date()).toISOString()
    };
    res.json(stats);
  } catch (error) {
    console.error("[API] Error al obtener estad\xEDsticas:", error);
    res.status(500).json({ error: "Error al obtener estad\xEDsticas" });
  }
});
var BLOQUES_ARGENTINA = [
  "LA LIBERTAD AVANZA",
  "PRO",
  "UNI\xD3N POR LA PATRIA",
  "UCR - EVOLUCI\xD3N RADICAL",
  "HACEMOS COALICI\xD3N FEDERAL",
  "INNOVACI\xD3N FEDERAL",
  "MOVIMIENTO POPULAR NEUQUINO",
  "POR SANTA CRUZ",
  "COALICI\xD3N C\xCDVICA - ARI",
  "FRENTE DE IZQUIERDA Y DE TRABAJADORES - UNIDAD",
  "PRODUCCI\xD3N Y TRABAJO",
  "UNIDAD FEDERAL",
  "BLOQUE JUSTICIALISTA",
  "FRENTE RENOVADOR",
  "SOCIALISTA",
  "DEMOCRATA CRISTIANO"
];
router.get("/api/bloques", async (req, res) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    const bloquesSet = new Set(BLOQUES_ARGENTINA);
    expedientes.forEach((exp) => {
      if (exp.bloque) {
        exp.bloque.forEach((b) => {
          if (b && b !== "BLOQUE PARLAMENTARIO") {
            bloquesSet.add(b);
          }
        });
      }
      if (exp.firmantes) {
        exp.firmantes.forEach((f) => {
          if (f.bloque) bloquesSet.add(f.bloque);
        });
      }
    });
    const bloques = Array.from(bloquesSet).sort();
    res.json(bloques);
  } catch (error) {
    console.error("[API] Error al obtener bloques:", error);
    res.status(500).json({ error: "Error al obtener bloques" });
  }
});
var PROVINCIAS_ARGENTINA = [
  "BUENOS AIRES",
  "CABA",
  "CATAMARCA",
  "CHACO",
  "CHUBUT",
  "C\xD3RDOBA",
  "CORRIENTES",
  "ENTRE R\xCDOS",
  "FORMOSA",
  "JUJUY",
  "LA PAMPA",
  "LA RIOJA",
  "MENDOZA",
  "MISIONES",
  "NEUQU\xC9N",
  "R\xCDO NEGRO",
  "SALTA",
  "SAN JUAN",
  "SAN LUIS",
  "SANTA CRUZ",
  "SANTA FE",
  "SANTIAGO DEL ESTERO",
  "TIERRA DEL FUEGO",
  "TUCUM\xC1N"
];
router.get("/api/provincias", async (req, res) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    const provinciasSet = new Set(PROVINCIAS_ARGENTINA);
    expedientes.forEach((exp) => {
      if (exp.provincias) {
        exp.provincias.forEach((p) => {
          if (p) provinciasSet.add(p);
        });
      }
      if (exp.firmantes) {
        exp.firmantes.forEach((f) => {
          if (f.distrito) provinciasSet.add(f.distrito);
        });
      }
    });
    const provincias = Array.from(provinciasSet).sort();
    res.json(provincias);
  } catch (error) {
    console.error("[API] Error al obtener provincias:", error);
    res.status(500).json({ error: "Error al obtener provincias" });
  }
});
var routes_default = router;

// server/app.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
var app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path7 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path7.startsWith("/api")) {
      let logLine = `${req.method} ${path7} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
async function runApp(setup) {
  const http = await import("node:http");
  const server = http.createServer(app);
  app.use(routes_default);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  await setup(app, server);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
}

// server/index-prod.ts
async function setupProductionServer(app2, server) {
  const distPath = path6.resolve(import.meta.dirname, "..", "dist", "public");
  app2.use((req, res, next) => {
    const filePath = path6.join(distPath, req.path);
    if (fs6.existsSync(filePath) && fs6.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    if (!req.path.startsWith("/api")) {
      return res.sendFile(path6.join(distPath, "index.html"));
    }
    next();
  });
}
(async () => {
  await runApp(setupProductionServer);
})();
export {
  setupProductionServer
};
