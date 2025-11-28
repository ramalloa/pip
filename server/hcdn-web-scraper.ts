import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');

/**
 * Scraper del buscador web oficial de HCDN
 * https://www.hcdn.gob.ar/sesiones/proyectos/actualizacion.html
 */
export class HCDNWebScraper {
  private searchUrl = 'https://www.hcdn.gob.ar/proyectos/resultado.html';

  /**
   * Buscar expedientes en el buscador web de HCDN
   */
  async searchExpedientes(params: {
    anio?: string;
    expediente?: string;
    tipo?: string;
  }): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];

    try {
      console.log(`[HCDN Web] 🔍 Buscando expedientes en buscador web...`);
      console.log(`[HCDN Web] Parámetros:`, params);

      // Hacer request al buscador web
      const response = await axios.post(
        this.searchUrl,
        new URLSearchParams(params as any).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (compatible; SIL/1.0)'
          },
          timeout: 30000
        }
      );

      const $ = cheerio.load(response.data);

      // Buscar tabla de resultados
      const rows = $('table tr').slice(1); // Skip header row
      console.log(`[HCDN Web] ✅ Encontradas ${rows.length} filas`);

      rows.each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length < 4) return;

        const expedienteNum = $(cells[0]).text().trim();
        const tipo = $(cells[1]).text().trim();
        const sumario = $(cells[2]).text().trim();
        const fecha = $(cells[3]).text().trim();
        const link = $(cells[0]).find('a').attr('href') || '';

        if (!expedienteNum || !expedienteNum.match(/\d+-D-202[0-9]/)) return;

        // Extraer autores del sumario si existe
        const autoresMatch = sumario.match(/^([^:]+):/);
        const autores = autoresMatch
          ? autoresMatch[1].split(/[;,]/).map(a => a.trim()).filter(a => a.length > 0).slice(0, 5)
          : ['Legislador Nacional'];

        let sumarioLimpio = sumario;
        if (autoresMatch) {
          sumarioLimpio = sumario.substring(sumario.indexOf(':') + 1).trim();
        }

        // Construir link al PDF
        const pdfLink = link
          ? `https://www.hcdn.gob.ar${link.replace('proyecto', 'pdf')}`
          : `https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/${expedienteNum}.pdf`;

        expedientes.push({
          id: expedienteNum,
          expediente: expedienteNum,
          tipo_expediente: tipo || 'Proyecto de LEY',
          cámara: 'Diputados',
          fecha_ingreso: fecha || new Date().toISOString().split('T')[0],
          sumario: sumarioLimpio,
          autores: autores,
          estado: 'Presentado',
          bloque: ['BLOQUE PARLAMENTARIO'],
          provincias: ['CABA'],
          derivaciones: [],
          TP: '',
          Link_EXPTE: pdfLink,
          OD_DIPUTADOS: '',
          OD_SENADO: '',
          Link_OD: ''
        });
      });

    } catch (error: any) {
      console.error(`[HCDN Web] ❌ Error en scraping:`, error.message);
    }

    return expedientes;
  }

  /**
   * Extraer todos los expedientes de 2025 por rango
   */
  async scrapeAll2025ByRange(startNum: number = 1, endNum: number = 7000): Promise<Expediente[]> {
    console.log(`\n[HCDN Web] 🚀 EXTRAYENDO EXPEDIENTES ${startNum}-${endNum} DE 2025\n`);

    const allExpedientes: Expediente[] = [];
    const batchSize = 500; // Buscar en lotes de 500

    for (let i = startNum; i <= endNum; i += batchSize) {
      const end = Math.min(i + batchSize - 1, endNum);
      console.log(`[HCDN Web] 📥 Buscando expedientes ${i} a ${end}...`);

      try {
        // Buscar todos los expedientes de 2025 en este rango
        const expedientes = await this.searchExpedientes({
          anio: '2025'
        });

        if (expedientes.length > 0) {
          allExpedientes.push(...expedientes);
          console.log(`[HCDN Web] ✅ Extraídos ${expedientes.length} expedientes`);
        }

        // Pequeña pausa para no saturar el servidor
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`[HCDN Web] ❌ Error en rango ${i}-${end}:`, error.message);
      }
    }

    // Eliminar duplicados
    const unique = this.removeDuplicates(allExpedientes);

    // Ordenar por fecha más reciente
    unique.sort((a, b) => {
      return new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime();
    });

    await this.saveToFile(unique);

    console.log(`\n[HCDN Web] ✅ EXTRACCIÓN COMPLETADA`);
    console.log(`   📋 Total Expedientes: ${unique.length}`);

    return unique;
  }

  private removeDuplicates(expedientes: Expediente[]): Expediente[] {
    const seen = new Set<string>();
    return expedientes.filter(exp => {
      if (seen.has(exp.expediente)) return false;
      seen.add(exp.expediente);
      return true;
    });
  }

  async saveToFile(expedientes: Expediente[]): Promise<void> {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');
      console.log(`[HCDN Web] 💾 Datos guardados en ${DATA_FILE}`);
    } catch (error) {
      console.error('[HCDN Web] ❌ Error al guardar archivo:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<Expediente[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[HCDN Web] Error al leer archivo:', error);
      return [];
    }
  }
}

export const hcdnWebScraper = new HCDNWebScraper();
