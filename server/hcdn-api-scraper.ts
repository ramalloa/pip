import axios from 'axios';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');

/**
 * Scraper usando API oficial de HCDN Datos Abiertos
 * https://datos.hcdn.gob.ar
 */
export class HCDNApiScraper {
  private apiUrl = 'https://datos.hcdn.gob.ar/api/3/action/datastore_search';
  private resourceId = '22b2d52c-7a0e-426b-ac0a-a3326c388ba6';

  /**
   * Extraer expedientes desde API HCDN
   */
  async scrapeExpedientes(tipo: string, year: string, limit: number = 1000): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    try {
      console.log(`[HCDN API] 🔍 Buscando ${tipo} de ${year}...`);
      
      // Hacer consulta a la API
      const searchQuery = tipo === 'ALL' ? year : `${tipo} ${year}`;
      const response = await axios.get(this.apiUrl, {
        params: {
          resource_id: this.resourceId,
          q: searchQuery,
          limit: limit
        },
        timeout: 30000
      });

      const records = response.data.result.records;
      console.log(`[HCDN API] ✅ Encontrados ${records.length} registros`);

      for (const record of records) {
        const expDiputados = record['Exp. Diputados'];
        const expSenado = record['Exp. Senado'];
        const camara = record['Cámara Origen'];
        
        // Priorizar expediente según cámara
        const expedienteNum = camara === 'Diputados' ? expDiputados : expSenado;
        
        if (!expedienteNum || expedienteNum === 'NA') continue;
        if (!expedienteNum.match(/\d+-[DPS]-202[0-9]/)) continue;

        const titulo = record['Título'] || '';
        const tipoProyecto = record['Tipo'] || tipo;
        const fechaPublicacion = record['Publicación Fecha'] || new Date().toISOString().split('T')[0];
        const publicacionId = record['Publicación ID'] || '';

        // Extraer autores del título (formato: "AUTOR: texto")
        const autoresMatch = titulo.match(/^([^:]+):/);
        const autores = autoresMatch 
          ? autoresMatch[1].split(/[;,]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0).slice(0, 5)
          : ['Legislador Nacional'];

        // Extraer sumario (después de ":")
        let sumario = titulo;
        if (autoresMatch) {
          sumario = titulo.substring(titulo.indexOf(':') + 1).trim();
        }

        // Construir link al PDF oficial
        const pdfLink = `https://rest.hcdn.gob.ar/tp/${publicacionId}/${expedienteNum.replace('/', '-')}.pdf`;

        expedientes.push({
          id: expedienteNum,
          expediente: expedienteNum,
          tipo_expediente: `Proyecto de ${tipoProyecto}`,
          cámara: camara || (expedienteNum.includes('-D-') ? 'Diputados' : 'Senado'),
          fecha_ingreso: fechaPublicacion.split('T')[0],
          sumario: sumario,
          autores: autores,
          estado: 'Presentado',
          bloque: ['BLOQUE PARLAMENTARIO'],
          provincias: ['CABA'],
          derivaciones: [],
          TP: publicacionId || '',
          Link_EXPTE: pdfLink,
          OD_DIPUTADOS: '',
          OD_SENADO: '',
          Link_OD: ''
        });
      }
      
    } catch (error: any) {
      console.error(`[HCDN API] ❌ Error extrayendo ${tipo}:`, error.message);
    }
    
    return expedientes;
  }

  /**
   * Extrae TODOS los tipos de proyectos de 2025 con paginación
   */
  async scrapeAll2025(): Promise<Expediente[]> {
    console.log('\n[HCDN API] 🚀 INICIANDO EXTRACCIÓN MASIVA 2025 CON PAGINACIÓN\n');
    
    const allExpedientes: Expediente[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        console.log(`[HCDN API] 📥 Buscando desde offset ${offset}...`);
        
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
        
        console.log(`[HCDN API] ✅ Encontrados ${records.length} registros (${offset + records.length}/${total})`);

        if (records.length === 0) {
          hasMore = false;
          break;
        }

        // Procesar cada registro
        for (const record of records) {
          const expDiputados = record['Exp. Diputados'];
          const expSenado = record['Exp. Senado'];
          const camara = record['Cámara Origen'];
          
          const expedienteNum = camara === 'Diputados' ? expDiputados : expSenado;
          
          if (!expedienteNum || expedienteNum === 'NA') continue;
          if (!expedienteNum.match(/\d+-[DPS]-202[0-9]/)) continue;

          const titulo = record['Título'] || '';
          const tipoProyecto = record['Tipo'] || 'LEY';
          const fechaPublicacion = record['Publicación Fecha'] || new Date().toISOString().split('T')[0];
          const publicacionId = record['Publicación ID'] || '';

          const autoresMatch = titulo.match(/^([^:]+):/);
          const autores = autoresMatch 
            ? autoresMatch[1].split(/[;,]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0).slice(0, 5)
            : ['Legislador Nacional'];

          let sumario = titulo;
          if (autoresMatch) {
            sumario = titulo.substring(titulo.indexOf(':') + 1).trim();
          }

          const pdfLink = `https://rest.hcdn.gob.ar/tp/${publicacionId}/${expedienteNum.replace('/', '-')}.pdf`;

          allExpedientes.push({
            id: expedienteNum,
            expediente: expedienteNum,
            tipo_expediente: `Proyecto de ${tipoProyecto}`,
            cámara: camara || (expedienteNum.includes('-D-') ? 'Diputados' : 'Senado'),
            fecha_ingreso: fechaPublicacion.split('T')[0],
            sumario: sumario,
            autores: autores,
            estado: 'Presentado',
            bloque: ['BLOQUE PARLAMENTARIO'],
            provincias: ['CABA'],
            derivaciones: [],
            TP: publicacionId || '',
            Link_EXPTE: pdfLink,
            OD_DIPUTADOS: '',
            OD_SENADO: '',
            Link_OD: ''
          });
        }

        offset += limit;
        
        // Si llegamos al total o recibimos menos registros que el límite, terminamos
        if (offset >= total || records.length < limit) {
          hasMore = false;
        }

        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`[HCDN API] ❌ Error en offset ${offset}:`, error.message);
        hasMore = false;
      }
    }
    
    // Eliminar duplicados por expediente
    const unique = this.removeDuplicates(allExpedientes);
    
    // Ordenar por fecha más reciente
    unique.sort((a, b) => {
      return new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime();
    });
    
    await this.saveToFile(unique);
    
    console.log(`\n[HCDN API] ✅ EXTRACCIÓN COMPLETADA`);
    console.log(`   📋 Total Expedientes: ${unique.length}`);
    console.log(`   🏛️ Diputados: ${unique.filter(e => e.cámara === 'Diputados').length}`);
    console.log(`   🏛️ Senado: ${unique.filter(e => e.cámara === 'Senado').length}`);
    console.log(`   📜 Resoluciones: ${unique.filter(e => e.tipo_expediente.includes('RESOLUCION')).length}`);
    console.log(`   📢 Comunicaciones: ${unique.filter(e => e.tipo_expediente.includes('COMUNICACION')).length}`);
    console.log(`   📝 Declaraciones: ${unique.filter(e => e.tipo_expediente.includes('DECLARACION')).length}\n`);
    
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
      console.log(`[HCDN API] 💾 Datos guardados en ${DATA_FILE}`);
    } catch (error) {
      console.error('[HCDN API] ❌ Error al guardar archivo:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<Expediente[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[HCDN API] Error al leer archivo:', error);
      return [];
    }
  }
}

export const hcdnApiScraper = new HCDNApiScraper();
