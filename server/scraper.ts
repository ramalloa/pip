import axios from 'axios';
import { parse } from 'node-html-parser';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');

interface HCDNProyectoAPI {
  '_id'?: number;
  'Proyecto ID'?: string;
  'Título'?: string;
  'Publicación Fecha'?: string;
  'Publicación ID'?: string;
  'Cámara Origen'?: string;
  'Exp. Diputados'?: string;
  'Exp. Senado'?: string;
  'Tipo'?: string;
}

interface HCDNExpedienteVotacion {
  '_id'?: number;
  'acta_id'?: number;
  'numero'?: number;
  'origen'?: string;
  'anio'?: number;
  'expediente'?: string;
  'titulo'?: string;
  'od'?: number | null;
}

export class CongresoScraper {
  private baseUrlDiputados = 'https://www.hcdn.gob.ar';
  private baseUrlSenado = 'https://www.senado.gob.ar';
  private apiDiputados = 'https://datos.hcdn.gob.ar/api/3/action';
  private ordenesDelDiaUrl = 'https://www2.hcdn.gob.ar/secparl/dcomisiones/s_od/buscador.html';

  /**
   * FUENTE 1: API Proyectos Parlamentarios (Históricos 2016-2019)
   */
  async scrapeProyectosHistoricos(): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    try {
      console.log('[Scraper] 📚 Extrayendo proyectos históricos (2016-2019)...');
      
      const resourceId = '22b2d52c-7a0e-426b-ac0a-a3326c388ba6';
      let offset = 0;
      const limit = 1000;
      
      while (offset < 5000) {
        const url = `${this.apiDiputados}/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
        
        try {
          const response = await axios.get(url, { timeout: 30000 });
          
          if (response.data?.result?.records) {
            const records = response.data.result.records as HCDNProyectoAPI[];
            
            for (const record of records) {
              const exp = this.parseProyectoAPI(record);
              if (exp) expedientes.push(exp);
            }
            
            offset += limit;
            console.log(`[Scraper] 📊 Históricos: ${expedientes.length} procesados`);
            
            if (records.length < limit) break;
            await new Promise(resolve => setTimeout(resolve, 300));
          } else {
            break;
          }
        } catch (error: any) {
          console.error(`[Scraper] ⚠️  Error en históricos offset ${offset}:`, error.message);
          break;
        }
      }
      
      console.log(`[Scraper] ✅ Proyectos históricos: ${expedientes.length}`);
    } catch (error: any) {
      console.error('[Scraper] ❌ Error en proyectos históricos:', error.message);
    }
    
    return expedientes;
  }

  /**
   * FUENTE 2: Scraping de Órdenes del Día 2024-2025 (WEB)
   */
  async scrapeOrdenesDia2024_2025(): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    try {
      console.log('[Scraper] 📋 Extrayendo Órdenes del Día 2024-2025...');
      
      // Scrapear desde el buscador web de OD
      const response = await axios.get(this.ordenesDelDiaUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SIL/1.0)' },
        timeout: 30000
      });
      
      const html = parse(response.data);
      const rows = html.querySelectorAll('table tr');
      
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) continue;
        
        try {
          const periodo = cells[0]?.text.trim();
          const odNumero = cells[1]?.text.trim();
          const sumario = cells[2]?.text.trim();
          const expedienteText = cells[3]?.text.trim();
          const tipo = cells[4]?.text.trim();
          
          if (!periodo || !odNumero || periodo !== '142') continue; // Período 142 = 2024-2025
          
          // Extraer números de expedientes
          const expedientesMatch = expedienteText?.match(/(\d+-[DS]-\d{4})/g);
          
          if (expedientesMatch) {
            for (const expNum of expedientesMatch) {
              const camara = expNum.includes('-D-') ? 'Diputados' : 'Senado';
              
              expedientes.push({
                id: expNum,
                expediente: expNum,
                tipo_expediente: this.normalizarTipo(tipo),
                cámara: camara,
                estado: 'Orden del Día',
                fecha_ingreso: '2024-01-01',
                sumario: sumario || 'Sin sumario',
                autores: ['Legislador'],
                bloque: ['BLOQUE PARLAMENTARIO'],
                provincias: ['Buenos Aires'],
                derivaciones: [],
                OD_DIPUTADOS: `OD-${odNumero}`,
                Fecha_OD: '2024-11-20',
                Link_OD: `https://www4.hcdn.gob.ar/dependencias/dcomisiones/periodo-142/142-${odNumero}.pdf`,
                Link_EXPTE: `${this.baseUrlDiputados}/proyectos/proyecto.jsp?exp=${expNum}`
              });
            }
          }
        } catch (err) {
          continue;
        }
      }
      
      console.log(`[Scraper] ✅ Órdenes del Día 2024-2025: ${expedientes.length}`);
    } catch (error: any) {
      console.error('[Scraper] ⚠️  Error scraping OD 2024-2025:', error.message);
    }
    
    return expedientes;
  }

  /**
   * FUENTE 3: Extraer expedientes 2024-2025 actuales desde API HCDN REAL
   * Usa la API de votaciones que contiene expedientes reales
   */
  async scrapeExpedientes2024_2025_REAL(): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    try {
      console.log('[Scraper] 📡 Extrayendo expedientes 2024-2025 desde API HCDN REAL...');
      
      // Usar API de expedientes votados (resource_id: a05cf69f-c605-4a60-92fa-9d34c58a1e99)
      const resourceId = 'a05cf69f-c605-4a60-92fa-9d34c58a1e99';
      let offset = 0;
      const limit = 500;
      
      while (offset < 2000) {
        const url = `${this.apiDiputados}/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
        
        try {
          const response = await axios.get(url, { timeout: 30000 });
          
          if (response.data?.result?.records) {
            const records = response.data.result.records as HCDNExpedienteVotacion[];
            
            for (const record of records) {
              const year = record.anio;
              
              // Solo expedientes 2024-2025
              if (!year || (year !== 2024 && year !== 2025)) continue;
              
              const expNum = record.expediente || `${record.numero}-${record.origen}-${year}`;
              const titulo = record.titulo || 'Sin título';
              
              expedientes.push({
                id: expNum,
                expediente: expNum,
                tipo_expediente: 'Proyecto de Ley', // Todos son proyectos votados
                cámara: record.origen === 'S' ? 'Senado' : 'Diputados',
                estado: 'En tratamiento',
                fecha_ingreso: `${year}-01-01`,
                sumario: titulo.substring(0, 500),
                autores: ['Legislador'],
                bloque: ['BLOQUE PARLAMENTARIO'],
                provincias: ['Buenos Aires'],
                derivaciones: [],
                OD_DIPUTADOS: record.od ? `OD-${record.od}` : undefined,
                Link_EXPTE: `${this.baseUrlDiputados}/proyectos/proyecto.jsp?exp=${expNum}`
              });
            }
            
            console.log(`[Scraper] 📊 Procesados: ${expedientes.length} expedientes 2024-2025`);
            
            if (records.length < limit) break;
            offset += limit;
            await new Promise(resolve => setTimeout(resolve, 300));
          } else {
            break;
          }
        } catch (error: any) {
          console.error(`[Scraper] ⚠️  Error en offset ${offset}:`, error.message);
          break;
        }
      }
      
      console.log(`[Scraper] ✅ Expedientes 2024-2025 REALES: ${expedientes.length}`);
    } catch (error: any) {
      console.error('[Scraper] ❌ Error extrayendo expedientes 2024-2025:', error.message);
    }
    
    return expedientes;
  }

  /**
   * Parsea un proyecto de la API al formato estándar
   */
  private parseProyectoAPI(record: HCDNProyectoAPI): Expediente | null {
    try {
      const expDiputados = record['Exp. Diputados'];
      const expSenado = record['Exp. Senado'];
      
      let expedienteNum = expDiputados && expDiputados !== 'NA' ? expDiputados : expSenado;
      if (!expedienteNum || expedienteNum === 'NA') return null;
      
      const camara = record['Cámara Origen'] === 'Senado' ? 'Senado' : 'Diputados';
      const tipo = record['Tipo'] || 'Proyecto';
      const titulo = record['Título'] || 'Sin título';
      const fecha = record['Publicación Fecha'] ? record['Publicación Fecha'].split('T')[0] : '2016-01-01';
      
      return {
        id: expedienteNum,
        expediente: expedienteNum,
        tipo_expediente: this.normalizarTipo(tipo),
        cámara: camara,
        estado: 'Presentado',
        fecha_ingreso: fecha,
        sumario: titulo.substring(0, 500),
        autores: ['Legislador'],
        bloque: ['BLOQUE PARLAMENTARIO'],
        provincias: ['Buenos Aires'],
        derivaciones: [],
        Link_EXPTE: `${this.baseUrlDiputados}/proyectos/proyecto.jsp?exp=${expedienteNum}`
      };
    } catch (error) {
      return null;
    }
  }

  private normalizarTipo(tipo: string): string {
    const tipoUpper = tipo.toUpperCase();
    if (tipoUpper.includes('INFORM')) return 'Pedido de Informes';
    if (tipoUpper.includes('LEY')) return 'Proyecto de Ley';
    if (tipoUpper.includes('RESOL')) return 'Proyecto de Resolución';
    if (tipoUpper.includes('DECLAR')) return 'Proyecto de Declaración';
    if (tipoUpper.includes('COMUN')) return 'Proyecto de Comunicación';
    return 'Proyecto';
  }

  private removeDuplicates(expedientes: Expediente[]): Expediente[] {
    const seen = new Set<string>();
    return expedientes.filter(exp => {
      if (seen.has(exp.id)) return false;
      seen.add(exp.id);
      return true;
    });
  }

  /**
   * SCRAPING COMPLETO: Combina todas las fuentes
   */
  async scrapeAll(): Promise<Expediente[]> {
    console.log('\n[Scraper] 🚀 INICIANDO EXTRACCIÓN MULTI-FUENTE\n');
    console.log('[Scraper] 📡 Fuentes:');
    console.log('[Scraper]    1️⃣  API Proyectos Históricos (2016-2019)');
    console.log('[Scraper]    2️⃣  Web Scraping Órdenes del Día (2024-2025)');
    console.log('[Scraper]    3️⃣  Generación Expedientes Actuales (2024-2025)\n');
    
    const [historicos, ordenesDia, actuales] = await Promise.all([
      this.scrapeProyectosHistoricos(),
      this.scrapeOrdenesDia2024_2025(),
      this.scrapeExpedientes2024_2025_REAL()
    ]);
    
    const allExpedientes = this.removeDuplicates([...historicos, ...ordenesDia, ...actuales]);
    
    await this.saveToFile(allExpedientes);
    
    console.log(`\n[Scraper] ✅ EXTRACCIÓN COMPLETADA`);
    console.log(`   📋 Total expedientes: ${allExpedientes.length.toLocaleString()}`);
    console.log(`   📚 Históricos (2016-2019): ${historicos.length.toLocaleString()}`);
    console.log(`   📑 Órdenes del Día (2024-2025): ${ordenesDia.length.toLocaleString()}`);
    console.log(`   🆕 Expedientes Actuales (2024-2025): ${actuales.length.toLocaleString()}`);
    console.log(`   📄 Pedidos de Informes: ${allExpedientes.filter(e => e.tipo_expediente === 'Pedido de Informes').length}`);
    console.log(`   📑 Órdenes del Día: ${allExpedientes.filter(e => e.OD_DIPUTADOS || e.OD_SENADO).length}\n`);
    
    return allExpedientes;
  }

  async saveToFile(expedientes: Expediente[]): Promise<void> {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');
      console.log(`[Scraper] 💾 Datos guardados en ${DATA_FILE}`);
    } catch (error) {
      console.error('[Scraper] ❌ Error al guardar archivo:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<Expediente[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[Scraper] Error al leer archivo:', error);
      return [];
    }
  }
}

export const scraper = new CongresoScraper();
