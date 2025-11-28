import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');

/**
 * Scraper directo de expedientes desde URLs individuales de HCDN
 */
export class HCDNDirectScraper {
  /**
   * Verificar y extraer datos de un expediente específico
   */
  async scrapeExpediente(expedienteNum: string): Promise<Expediente | null> {
    try {
      // Intentar varias URLs posibles
      const urls = [
        `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expedienteNum}`,
        `https://hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expedienteNum}`,
      ];

      for (const url of urls) {
        try {
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const $ = cheerio.load(response.data);

          // Intentar extraer información de la página
          const titulo = $('h1, h2, .titulo').first().text().trim();
          const contenido = $('body').text();

          // Verificar si la página contiene información del expediente
          if (!contenido.includes(expedienteNum)) {
            continue; // Probar siguiente URL
          }

          // Extraer información básica
          let tipo = 'Proyecto de LEY';
          let sumario = titulo || 'Sin sumario disponible';
          let fecha = new Date().toISOString().split('T')[0];
          let autores = ['Legislador Nacional'];

          // Intentar extraer tipo de proyecto
          if (contenido.includes('RESOLUCIÓN') || contenido.includes('RESOLUCION')) {
            tipo = 'Proyecto de RESOLUCIÓN';
          } else if (contenido.includes('COMUNICACIÓN') || contenido.includes('COMUNICACION')) {
            tipo = 'Proyecto de COMUNICACIÓN';
          } else if (contenido.includes('DECLARACIÓN') || contenido.includes('DECLARACION')) {
            tipo = 'Proyecto de DECLARACIÓN';
          }

          // Buscar fecha
          const fechaMatch = contenido.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (fechaMatch) {
            fecha = `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
          }

          // Buscar autores
          const autoresMatch = titulo.match(/^([^:]+):/);
          if (autoresMatch) {
            autores = autoresMatch[1].split(/[;,]/).map(a => a.trim()).filter(a => a.length > 0).slice(0, 5);
            sumario = titulo.substring(titulo.indexOf(':') + 1).trim();
          }

          const pdfLink = `https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/${expedienteNum}.pdf`;

          console.log(`[Direct Scraper] ✅ Expediente ${expedienteNum} encontrado`);

          return {
            id: expedienteNum,
            expediente: expedienteNum,
            tipo_expediente: tipo,
            cámara: 'Diputados',
            fecha_ingreso: fecha,
            sumario: sumario,
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
          };

        } catch (error) {
          // Continuar con siguiente URL
          continue;
        }
      }

      return null;

    } catch (error: any) {
      return null;
    }
  }

  /**
   * Escanear un rango de expedientes
   */
  async scrapeRange(startNum: number, endNum: number, year: string = '2025'): Promise<Expediente[]> {
    console.log(`\n[Direct Scraper] 🚀 ESCANEANDO EXPEDIENTES ${startNum}-${endNum} DE ${year}\n`);

    const expedientes: Expediente[] = [];
    const batchSize = 100;
    const concurrency = 5;

    for (let i = startNum; i <= endNum; i += batchSize) {
      const end = Math.min(i + batchSize - 1, endNum);
      console.log(`[Direct Scraper] 📥 Verificando expedientes ${i} a ${end}...`);

      const promises: Promise<Expediente | null>[] = [];

      for (let num = i; num <= end; num++) {
        const expedienteNum = `${num}-D-${year}`;
        promises.push(this.scrapeExpediente(expedienteNum));

        // Procesar en lotes de concurrency
        if (promises.length >= concurrency) {
          const results = await Promise.all(promises);
          const found = results.filter(exp => exp !== null) as Expediente[];
          expedientes.push(...found);
          promises.length = 0; // Limpiar array
          
          // Pausa para no saturar el servidor
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Procesar los restantes
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const found = results.filter(exp => exp !== null) as Expediente[];
        expedientes.push(...found);
      }

      console.log(`[Direct Scraper] ✅ Encontrados ${expedientes.length} expedientes hasta ahora`);
    }

    return expedientes;
  }

  /**
   * Verificar expedientes específicos de una lista
   */
  async scrapeSpecificExpedientes(expedientesList: string[]): Promise<Expediente[]> {
    console.log(`\n[Direct Scraper] 🔍 VERIFICANDO ${expedientesList.length} EXPEDIENTES ESPECÍFICOS\n`);

    const expedientes: Expediente[] = [];

    for (const expedienteNum of expedientesList) {
      console.log(`[Direct Scraper] 🔎 Verificando ${expedienteNum}...`);
      const expediente = await this.scrapeExpediente(expedienteNum);
      
      if (expediente) {
        expedientes.push(expediente);
        console.log(`[Direct Scraper] ✅ ${expedienteNum} encontrado`);
      } else {
        console.log(`[Direct Scraper] ❌ ${expedienteNum} no encontrado`);
      }

      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n[Direct Scraper] ✅ VERIFICACIÓN COMPLETADA`);
    console.log(`   📋 Expedientes encontrados: ${expedientes.length}/${expedientesList.length}`);

    return expedientes;
  }

  async saveToFile(expedientes: Expediente[]): Promise<void> {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');
      console.log(`[Direct Scraper] 💾 Datos guardados en ${DATA_FILE}`);
    } catch (error) {
      console.error('[Direct Scraper] ❌ Error al guardar archivo:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<Expediente[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  /**
   * Combinar con expedientes existentes
   */
  async mergeWithExisting(newExpedientes: Expediente[]): Promise<Expediente[]> {
    const existing = await this.loadFromFile();
    const combined = [...existing, ...newExpedientes];

    // Eliminar duplicados
    const seen = new Set<string>();
    const unique = combined.filter(exp => {
      if (seen.has(exp.expediente)) return false;
      seen.add(exp.expediente);
      return true;
    });

    // Ordenar por expediente (número descendente)
    unique.sort((a, b) => {
      const numA = parseInt(a.expediente.match(/(\d+)-/)?.[1] || '0');
      const numB = parseInt(b.expediente.match(/(\d+)-/)?.[1] || '0');
      return numB - numA;
    });

    return unique;
  }
}

export const hcdnDirectScraper = new HCDNDirectScraper();
