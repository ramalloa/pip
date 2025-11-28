import axios from 'axios';
import * as XLSX from 'xlsx';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');

/**
 * Descargador automático de archivos Excel/CSV desde fuentes oficiales
 */
export class ExcelDownloader {
  private hcdnCsvUrl = 'https://datos.hcdn.gob.ar/dataset/839441fc-1b5c-45b8-82c9-8b0f18ac7c9b/resource/22b2d52c-7a0e-426b-ac0a-a3326c388ba6/download/proyectos_parlamentarios1.6.csv';

  /**
   * Descargar y procesar CSV de HCDN (Proyectos Parlamentarios)
   */
  async downloadHCDNData(): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    try {
      console.log('[Excel Downloader] 📥 Descargando CSV de HCDN...');
      
      const response = await axios.get(this.hcdnCsvUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SIL/1.0)'
        }
      });

      console.log('[Excel Downloader] 📊 Procesando archivo CSV...');
      
      // Leer CSV con XLSX
      const workbook = XLSX.read(response.data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(`[Excel Downloader] ✅ ${data.length} registros encontrados en CSV`);

      // Filtrar solo proyectos de 2025 y tipos específicos
      const filteredData = data.filter((row: any) => {
        const tipo = (row['tipo'] || row['Tipo'] || '').toUpperCase();
        const expDiputados = row['exp_diputados'] || row['Exp. Diputados'] || '';
        const expSenado = row['exp_senado'] || row['Exp. Senado'] || '';
        const exp = expDiputados !== 'NA' ? expDiputados : expSenado;
        
        // Solo proyectos 2025 y tipos RESOLUCION, COMUNICACION, DECLARACION
        return (
          exp.includes('-2025') &&
          (tipo === 'RESOLUCION' || tipo === 'COMUNICACION' || tipo === 'DECLARACION' || tipo === 'LEY')
        );
      });

      console.log(`[Excel Downloader] 🎯 ${filteredData.length} proyectos de 2025`);

      for (const row of filteredData) {
        const expDiputados = row['exp_diputados'] || row['Exp. Diputados'] || '';
        const expSenado = row['exp_senado'] || row['Exp. Senado'] || '';
        const camara = row['camara_origen'] || row['Cámara Origen'] || 'Diputados';
        const expedienteNum = camara === 'Diputados' ? expDiputados : expSenado;

        if (!expedienteNum || expedienteNum === 'NA') continue;
        if (!expedienteNum.match(/\d+-[DPS]-2025/)) continue;

        const titulo = row['titulo'] || row['Título'] || '';
        const tipo = row['tipo'] || row['Tipo'] || 'RESOLUCION';
        const fechaPublicacion = row['publicacion_fecha'] || row['Publicación Fecha'] || new Date().toISOString().split('T')[0];
        const publicacionId = row['publicacion_id'] || row['Publicación ID'] || '';
        const autorRaw = row['autor'] || row['Autor'] || '';

        // Extraer autores del campo 'autor' del CSV
        let autores: string[] = [];
        let autoresMatch = null;
        
        if (autorRaw && autorRaw !== 'NA' && autorRaw.trim() !== '') {
          autores = autorRaw.split(/[;,]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0).slice(0, 5);
        }
        
        // Si no hay autores, intentar extraer del título
        if (autores.length === 0) {
          autoresMatch = titulo.match(/^([^:]+):/);
          if (autoresMatch) {
            autores = autoresMatch[1].split(/[;,]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0).slice(0, 5);
          }
        }
        
        // Si aún no hay autores, usar genérico
        if (autores.length === 0) {
          autores = ['Legislador Nacional'];
        }

        // Sumario
        let sumario = titulo;
        if (autoresMatch) {
          sumario = titulo.substring(titulo.indexOf(':') + 1).trim();
        }

        // Link al PDF (formato correcto 2025)
        const pdfLink = expedienteNum.match(/(\d+)-D-2025/)
          ? `https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2025/PDF2025/TP2025/${expedienteNum}.pdf`
          : expedienteNum.match(/(\d+)-S-2025/)
          ? `https://www.senado.gob.ar/parlamentario/parlamentaria/${expedienteNum.replace('/', '-')}/downloadPdf`
          : '';

        expedientes.push({
          id: expedienteNum,
          expediente: expedienteNum,
          tipo_expediente: `Proyecto de ${tipo}`,
          cámara: camara as 'Diputados' | 'Senado',
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
      console.error('[Excel Downloader] ❌ Error descargando CSV HCDN:', error.message);
    }

    return expedientes;
  }

  /**
   * Normalizar tipos de expediente
   */
  normalizeTypes(expedientes: Expediente[]): void {
    expedientes.forEach(exp => {
      if (exp.tipo_expediente.includes('RESOLUCION')) {
        exp.tipo_expediente = 'Proyecto de RESOLUCIÓN';
      } else if (exp.tipo_expediente.includes('COMUNICACION')) {
        exp.tipo_expediente = 'Proyecto de COMUNICACIÓN';
      } else if (exp.tipo_expediente.includes('DECLARACION')) {
        exp.tipo_expediente = 'Proyecto de DECLARACIÓN';
      }
    });
  }

  /**
   * Descargar todo y guardar
   */
  async downloadAll(): Promise<Expediente[]> {
    console.log('\n[Excel Downloader] 🚀 INICIANDO DESCARGA AUTOMÁTICA DE DATOS\n');
    
    const hcdnData = await this.downloadHCDNData();
    
    // Importar y ejecutar scraper del Senado
    const { senadoScraper } = await import('./senado-scraper');
    const senadoData = await senadoScraper.scrapeSenadoProyectos();
    
    // Combinar datos
    const allData = [...hcdnData, ...senadoData];
    
    // Normalizar tipos
    this.normalizeTypes(allData);
    
    // Eliminar duplicados
    const unique = this.removeDuplicates(allData);
    
    // Ordenar por fecha
    unique.sort((a, b) => {
      return new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime();
    });
    
    await this.saveToFile(unique);
    
    console.log(`\n[Excel Downloader] ✅ DESCARGA COMPLETADA`);
    console.log(`   📋 Total Expedientes: ${unique.length}`);
    console.log(`   🏛️ Diputados: ${unique.filter(e => e.cámara === 'Diputados').length}`);
    console.log(`   🏛️ Senado: ${unique.filter(e => e.cámara === 'Senado').length}`);
    console.log(`   📜 Resoluciones: ${unique.filter(e => e.tipo_expediente.includes('RESOLUCIÓN')).length}`);
    console.log(`   📢 Comunicaciones: ${unique.filter(e => e.tipo_expediente.includes('COMUNICACIÓN')).length}`);
    console.log(`   📝 Declaraciones: ${unique.filter(e => e.tipo_expediente.includes('DECLARACIÓN')).length}\n`);
    
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
      console.log(`[Excel Downloader] 💾 Datos guardados en ${DATA_FILE}`);
    } catch (error) {
      console.error('[Excel Downloader] ❌ Error al guardar archivo:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<Expediente[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[Excel Downloader] Error al leer archivo:', error);
      return [];
    }
  }
}

export const excelDownloader = new ExcelDownloader();
