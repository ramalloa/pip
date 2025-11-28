import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

interface Firmante {
  nombre: string;
  distrito?: string;
  bloque?: string;
  tipo?: 'autor' | 'coautor';
}

interface Tramite {
  fecha: string;
  camara?: string;
  movimiento: string;
  resultado?: string;
}

interface ExpedienteCompleto extends Expediente {
  extracto?: string;
  firmantes?: Firmante[];
  tramites?: Tramite[];
  tramite_parlamentario?: string;
  dictamenes?: Array<{
    tipo: string;
    fecha: string;
    descripcion?: string;
  }>;
}

export class HCDNCompleteScraper {
  private baseUrl = 'https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp';
  private apiUrl = 'https://datos.hcdn.gob.ar/api/3/action/datastore_search';
  private resourceId = '22b2d52c-7a0e-426b-ac0a-a3326c388ba6';

  async scrapeExpedienteCompleto(expedienteNum: string): Promise<ExpedienteCompleto | null> {
    try {
      const url = `${this.baseUrl}?exp=${expedienteNum}`;
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
        }
      });

      const $ = cheerio.load(response.data);
      
      const expedienteText = $('p:contains("Expediente")').text() || '';
      if (!expedienteText.includes(expedienteNum.split('-')[0])) {
        return null;
      }

      let tipoProyecto = 'Proyecto de LEY';
      const sumarioElement = $('p:contains("Sumario:")').next('p').text().trim() || 
                            $('p:contains("Sumario:")').text().replace('Sumario:', '').trim();
      
      const sumarioText = sumarioElement || $('p').filter((_, el) => {
        const text = $(el).text();
        return text.includes('PEDIDO DE INFORMES') || 
               text.includes('PROYECTO DE LEY') ||
               text.includes('PROYECTO DE RESOLUCION') ||
               text.includes('PROYECTO DE COMUNICACION') ||
               text.includes('PROYECTO DE DECLARACION');
      }).first().text().trim();

      if (sumarioText.includes('PEDIDO DE INFORMES') || sumarioText.includes('PEDIDO DE INFORME')) {
        tipoProyecto = 'PEDIDO DE INFORMES';
      } else if (sumarioText.includes('RESOLUCION') || sumarioText.includes('RESOLUCIÓN')) {
        tipoProyecto = 'Proyecto de RESOLUCIÓN';
      } else if (sumarioText.includes('COMUNICACION') || sumarioText.includes('COMUNICACIÓN')) {
        tipoProyecto = 'Proyecto de COMUNICACIÓN';
      } else if (sumarioText.includes('DECLARACION') || sumarioText.includes('DECLARACIÓN')) {
        tipoProyecto = 'Proyecto de DECLARACIÓN';
      }

      let fecha = '';
      const fechaMatch = $('p:contains("Fecha:")').text().match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (fechaMatch) {
        fecha = `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
      } else {
        const anyFecha = $('body').text().match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/);
        if (anyFecha) {
          fecha = `${anyFecha[3]}-${anyFecha[2]}-${anyFecha[1]}`;
        }
      }

      let tramiteParlamentario = '';
      const tpMatch = $('p:contains("Publicado en:")').text().match(/Trámite Parlamentario N°?\s*(\d+)/i) ||
                      $('body').text().match(/Trámite Parlamentario N°?\s*(\d+)/i);
      if (tpMatch) {
        tramiteParlamentario = `TP-${tpMatch[1]}`;
      }

      const firmantes: Firmante[] = [];
      $('table').each((_, table) => {
        const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
        
        if (headers.some(h => h.includes('firmante') || h.includes('diputado') || h.includes('senador'))) {
          $(table).find('tbody tr, tr').each((i, row) => {
            if (i === 0 && $(row).find('th').length > 0) return;
            
            const cells = $(row).find('td');
            if (cells.length >= 2) {
              const nombre = $(cells[0]).text().trim();
              const distrito = $(cells[1]).text().trim();
              const bloque = cells.length >= 3 ? $(cells[2]).text().trim() : '';
              
              if (nombre && nombre.length > 2 && !nombre.includes('Firmante')) {
                firmantes.push({
                  nombre,
                  distrito: distrito || undefined,
                  bloque: bloque || undefined,
                  tipo: firmantes.length === 0 ? 'autor' : 'coautor'
                });
              }
            }
          });
        }
      });

      const comisiones: string[] = [];
      $('table').each((_, table) => {
        const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
        
        if (headers.some(h => h.includes('comisi') || h.includes('giro'))) {
          $(table).find('tbody tr, tr').each((i, row) => {
            if (i === 0 && $(row).find('th').length > 0) return;
            
            const cell = $(row).find('td').first().text().trim();
            if (cell && cell.length > 2) {
              comisiones.push(cell.replace(/\s*\(Primera Competencia\)\s*/gi, '').trim());
            }
          });
        }
      });

      const bodyText = $('body').text();
      const giroMatch = bodyText.match(/Giro a comisiones[^:]*:?\s*([A-ZÁÉÍÓÚÑ\s,]+)(?:\.|$)/i);
      if (giroMatch && comisiones.length === 0) {
        const comisionesText = giroMatch[1].split(/[,;]/).map(c => c.trim()).filter(c => c.length > 3);
        comisiones.push(...comisionesText);
      }

      const tramites: Tramite[] = [];
      $('table').each((_, table) => {
        const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
        
        if (headers.some(h => h.includes('movimiento') || h.includes('trámite') || h.includes('tramite'))) {
          $(table).find('tbody tr, tr').each((i, row) => {
            if (i === 0 && $(row).find('th').length > 0) return;
            
            const cells = $(row).find('td');
            if (cells.length >= 2) {
              const camara = $(cells[0]).text().trim();
              const movimiento = $(cells[1]).text().trim();
              const fechaTramite = cells.length >= 3 ? $(cells[2]).text().trim() : '';
              const resultado = cells.length >= 4 ? $(cells[3]).text().trim() : '';
              
              if (movimiento && movimiento.length > 2) {
                tramites.push({
                  camara: camara || undefined,
                  movimiento,
                  fecha: fechaTramite || '',
                  resultado: resultado || undefined
                });
              }
            }
          });
        }
      });

      const autores = firmantes.length > 0 
        ? firmantes.slice(0, 5).map(f => f.nombre)
        : ['Legislador Nacional'];
      
      const bloquesSet = new Set<string>();
      firmantes.forEach(f => { if (f.bloque) bloquesSet.add(f.bloque); });
      const bloques = Array.from(bloquesSet);
      
      const provinciasSet = new Set<string>();
      firmantes.forEach(f => { if (f.distrito) provinciasSet.add(f.distrito); });
      const provincias = Array.from(provinciasSet);

      const derivaciones = comisiones.map(comision => ({
        comision,
        fecha: fecha || '',
        estado: 'Giro'
      }));

      const pdfLink = `https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/${expedienteNum}.pdf`;
      const linkExpte = `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expedienteNum}`;

      console.log(`[Complete Scraper] ✅ ${expedienteNum}: ${tipoProyecto} - ${firmantes.length} firmantes, ${comisiones.length} comisiones`);

      return {
        id: expedienteNum,
        expediente: expedienteNum,
        tipo_expediente: tipoProyecto,
        cámara: expedienteNum.includes('-D-') ? 'Diputados' : 'Senado',
        estado: 'Presentado',
        fecha_ingreso: fecha || new Date().toISOString().split('T')[0],
        autores,
        bloque: bloques.length > 0 ? bloques : ['BLOQUE PARLAMENTARIO'],
        provincias: provincias.length > 0 ? provincias : ['CABA'],
        OD_DIPUTADOS: '',
        OD_SENADO: '',
        Fecha_OD: '',
        Link_OD: '',
        Link_EXPTE: linkExpte,
        TP: tramiteParlamentario,
        derivaciones,
        sumario: sumarioText || 'Sin sumario disponible',
        extracto: sumarioText || '',
        firmantes,
        tramites,
        tramite_parlamentario: tramiteParlamentario
      };

    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error(`[Complete Scraper] ❌ Error en ${expedienteNum}:`, error.message);
      }
      return null;
    }
  }

  async scrapeRangeWithDetails(startNum: number, endNum: number, year: string = '2025'): Promise<ExpedienteCompleto[]> {
    console.log(`\n[Complete Scraper] 🚀 EXTRAYENDO EXPEDIENTES ${startNum}-${endNum} DE ${year} CON DATOS COMPLETOS\n`);

    const expedientes: ExpedienteCompleto[] = [];
    const concurrency = 3;
    const batchSize = 50;

    for (let batchStart = startNum; batchStart <= endNum; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, endNum);
      console.log(`[Complete Scraper] 📥 Procesando lote ${batchStart}-${batchEnd}...`);

      const promises: Promise<ExpedienteCompleto | null>[] = [];
      
      for (let num = batchStart; num <= batchEnd; num++) {
        const expedienteNum = `${num}-D-${year}`;
        promises.push(this.scrapeExpedienteCompleto(expedienteNum));

        if (promises.length >= concurrency) {
          const results = await Promise.all(promises);
          const found = results.filter(exp => exp !== null) as ExpedienteCompleto[];
          expedientes.push(...found);
          promises.length = 0;
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const found = results.filter(exp => exp !== null) as ExpedienteCompleto[];
        expedientes.push(...found);
      }

      console.log(`[Complete Scraper] ✅ ${expedientes.length} expedientes encontrados hasta ahora`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return expedientes;
  }

  async enrichExpedientesFromAPI(): Promise<ExpedienteCompleto[]> {
    console.log('\n[Complete Scraper] 🔄 ENRIQUECIENDO DATOS DESDE API HCDN\n');
    
    const allExpedientes: ExpedienteCompleto[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        console.log(`[Complete Scraper] 📥 API offset ${offset}...`);
        
        const response = await axios.get(this.apiUrl, {
          params: {
            resource_id: this.resourceId,
            q: '2025',
            limit: limit,
            offset: offset
          },
          timeout: 30000
        });

        const records = response.data.result.records;
        const total = response.data.result.total;
        
        if (records.length === 0) {
          hasMore = false;
          break;
        }

        for (const record of records) {
          const expDiputados = record['Exp. Diputados'];
          const expSenado = record['Exp. Senado'];
          const camara = record['Cámara Origen'];
          
          const expedienteNum = camara === 'Diputados' ? expDiputados : expSenado;
          
          if (!expedienteNum || expedienteNum === 'NA') continue;
          if (!expedienteNum.match(/\d+-[DPS]-202[0-9]/)) continue;

          const titulo = record['Título'] || '';
          let tipoProyecto = record['Tipo'] || 'LEY';
          const fechaPublicacion = record['Publicación Fecha'] || new Date().toISOString().split('T')[0];
          const publicacionId = record['Publicación ID'] || '';

          if (titulo.includes('PEDIDO DE INFORMES') || titulo.includes('PEDIDO DE INFORME')) {
            tipoProyecto = 'PEDIDO DE INFORMES';
          } else if (titulo.includes('RESOLUCION') || titulo.includes('RESOLUCIÓN')) {
            tipoProyecto = 'Proyecto de RESOLUCIÓN';
          } else if (titulo.includes('COMUNICACION') || titulo.includes('COMUNICACIÓN')) {
            tipoProyecto = 'Proyecto de COMUNICACIÓN';
          } else if (titulo.includes('DECLARACION') || titulo.includes('DECLARACIÓN')) {
            tipoProyecto = 'Proyecto de DECLARACIÓN';
          } else {
            tipoProyecto = `Proyecto de ${tipoProyecto}`;
          }

          const autoresMatch = titulo.match(/^([^:]+):/);
          const autores = autoresMatch 
            ? autoresMatch[1].split(/[;,]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0).slice(0, 5)
            : ['Legislador Nacional'];

          let sumario = titulo;
          if (autoresMatch) {
            sumario = titulo.substring(titulo.indexOf(':') + 1).trim();
          }

          const linkExpte = expedienteNum.includes('-D-') 
            ? `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expedienteNum}`
            : `https://www.senado.gob.ar/parlamentario/comisiones/verExp/${expedienteNum.replace(/-S-/g, '/').replace('-', '/')}`;

          allExpedientes.push({
            id: expedienteNum,
            expediente: expedienteNum,
            tipo_expediente: tipoProyecto,
            cámara: camara || (expedienteNum.includes('-D-') ? 'Diputados' : 'Senado'),
            fecha_ingreso: fechaPublicacion.split('T')[0],
            sumario: sumario,
            extracto: sumario,
            autores: autores,
            estado: 'Presentado',
            bloque: ['BLOQUE PARLAMENTARIO'],
            provincias: ['CABA'],
            derivaciones: [],
            TP: publicacionId || '',
            tramite_parlamentario: publicacionId ? `TP-${publicacionId}` : '',
            Link_EXPTE: linkExpte,
            OD_DIPUTADOS: '',
            OD_SENADO: '',
            Link_OD: ''
          });
        }

        offset += limit;
        
        if (offset >= total || records.length < limit) {
          hasMore = false;
        }

        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error: any) {
        console.error(`[Complete Scraper] ❌ Error API en offset ${offset}:`, error.message);
        hasMore = false;
      }
    }

    console.log(`[Complete Scraper] ✅ API: ${allExpedientes.length} expedientes obtenidos`);
    return allExpedientes;
  }

  async enrichWithCompleteDetails(expedientes: ExpedienteCompleto[], maxToEnrich: number = 500): Promise<ExpedienteCompleto[]> {
    console.log(`\n[Complete Scraper] 🔍 ENRIQUECIENDO ${Math.min(expedientes.length, maxToEnrich)} EXPEDIENTES CON DETALLES COMPLETOS\n`);
    
    const enriched: ExpedienteCompleto[] = [];
    const toEnrich = expedientes.slice(0, maxToEnrich);
    const concurrency = 3;
    
    for (let i = 0; i < toEnrich.length; i += concurrency) {
      const batch = toEnrich.slice(i, i + concurrency);
      
      const promises = batch.map(exp => this.scrapeExpedienteCompleto(exp.expediente));
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
        console.log(`[Complete Scraper] 📊 Progreso: ${i + batch.length}/${toEnrich.length}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const remaining = expedientes.slice(maxToEnrich);
    
    return [...enriched, ...remaining];
  }

  async createBackup(): Promise<string> {
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `db_expedientes_${timestamp}.json`);
      
      const existingData = await this.loadFromFile();
      await fs.writeFile(backupFile, JSON.stringify(existingData, null, 2), 'utf-8');
      
      console.log(`[Complete Scraper] 💾 Backup creado: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('[Complete Scraper] ❌ Error creando backup:', error);
      throw error;
    }
  }

  async saveToFile(expedientes: ExpedienteCompleto[]): Promise<void> {
    try {
      const unique = this.removeDuplicates(expedientes);
      
      unique.sort((a, b) => {
        const numA = parseInt(a.expediente.match(/(\d+)-/)?.[1] || '0');
        const numB = parseInt(b.expediente.match(/(\d+)-/)?.[1] || '0');
        return numB - numA;
      });

      await fs.writeFile(DATA_FILE, JSON.stringify(unique, null, 2), 'utf-8');
      console.log(`[Complete Scraper] 💾 ${unique.length} expedientes guardados en ${DATA_FILE}`);
    } catch (error) {
      console.error('[Complete Scraper] ❌ Error al guardar archivo:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<ExpedienteCompleto[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private removeDuplicates(expedientes: ExpedienteCompleto[]): ExpedienteCompleto[] {
    const seen = new Map<string, ExpedienteCompleto>();
    
    for (const exp of expedientes) {
      const existing = seen.get(exp.expediente);
      
      if (!existing || 
          (exp.firmantes && exp.firmantes.length > 0 && (!existing.firmantes || existing.firmantes.length === 0)) ||
          (exp.sumario !== 'Sin sumario disponible' && existing.sumario === 'Sin sumario disponible')) {
        seen.set(exp.expediente, exp);
      }
    }
    
    return Array.from(seen.values());
  }

  async runFullExtraction(): Promise<ExpedienteCompleto[]> {
    console.log('\n========================================');
    console.log('🚀 EXTRACCIÓN COMPLETA DE EXPEDIENTES HCDN');
    console.log('========================================\n');

    await this.createBackup();

    console.log('\n📥 PASO 1: Obteniendo expedientes desde API HCDN...\n');
    const apiExpedientes = await this.enrichExpedientesFromAPI();

    console.log('\n📥 PASO 2: Obteniendo expedientes recientes via scraping directo...\n');
    const recentExpedientes = await this.scrapeRangeWithDetails(6300, 6600, '2025');

    console.log('\n🔄 PASO 3: Combinando y eliminando duplicados...\n');
    const combined = [...recentExpedientes, ...apiExpedientes];
    const unique = this.removeDuplicates(combined);

    console.log('\n🔍 PASO 4: Enriqueciendo los primeros 300 expedientes con detalles completos...\n');
    const enriched = await this.enrichWithCompleteDetails(unique, 300);

    await this.saveToFile(enriched);

    const stats = {
      total: enriched.length,
      diputados: enriched.filter(e => e.cámara === 'Diputados').length,
      senado: enriched.filter(e => e.cámara === 'Senado').length,
      pedidosInformes: enriched.filter(e => e.tipo_expediente.includes('PEDIDO DE INFORMES')).length,
      conFirmantes: enriched.filter(e => e.firmantes && e.firmantes.length > 0).length,
      conComisiones: enriched.filter(e => e.derivaciones && e.derivaciones.length > 0).length
    };

    console.log('\n========================================');
    console.log('✅ EXTRACCIÓN COMPLETADA');
    console.log('========================================');
    console.log(`📋 Total Expedientes: ${stats.total}`);
    console.log(`🏛️ Diputados: ${stats.diputados}`);
    console.log(`🏛️ Senado: ${stats.senado}`);
    console.log(`📝 Pedidos de Informes: ${stats.pedidosInformes}`);
    console.log(`👥 Con firmantes: ${stats.conFirmantes}`);
    console.log(`📂 Con comisiones: ${stats.conComisiones}`);
    console.log('========================================\n');

    return enriched;
  }
}

export const hcdnCompleteScraper = new HCDNCompleteScraper();
