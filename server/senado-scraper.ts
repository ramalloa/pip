import axios from 'axios';
import { parse } from 'node-html-parser';
import type { Expediente } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

const SENADO_DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_senado_temp.json');

export class SenadoScraper {
  private baseUrl = 'https://www.senado.gob.ar';
  private searchUrl = `${this.baseUrl}/parlamentario/parlamentaria/votaciones/`;

  /**
   * Extraer expedientes del Senado 2024-2025
   */
  async scrapeSenadoProyectos(): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    try {
      console.log('[Senado Scraper] 🏛️ Extrayendo expedientes del Senado...');
      
      // Tipos de proyectos que nos interesan
      const tipos = ['PL', 'PR', 'PC', 'PD']; // Ley, Resolución, Comunicación, Declaración
      const años = ['2025', '2024'];
      
      for (const año of años) {
        for (const tipo of tipos) {
          console.log(`[Senado] Buscando ${tipo} ${año}...`);
          
          // Generar números de expediente del 1 al 2000
          for (let num = 1; num <= 2000; num += 50) {
            const batch = await this.scrapeExpedientesBatch(tipo, año, num, num + 49);
            expedientes.push(...batch);
            
            // Delay para no saturar el servidor
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      console.log(`[Senado Scraper] ✅ Total extraídos: ${expedientes.length}`);
      
    } catch (error: any) {
      console.error('[Senado Scraper] ❌ Error:', error.message);
    }
    
    return expedientes;
  }

  /**
   * Scrape por lote de expedientes
   */
  private async scrapeExpedientesBatch(tipo: string, año: string, numFrom: number, numTo: number): Promise<Expediente[]> {
    const expedientes: Expediente[] = [];
    
    for (let num = numFrom; num <= numTo; num++) {
      const expedienteNum = `${num.toString().padStart(4, '0')}-${tipo}-${año.slice(-2)}`;
      
      try {
        const url = `${this.baseUrl}/parlamentario/parlamentaria/${expedienteNum}/`;
        const response = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SIL/1.0)' },
          timeout: 10000,
          validateStatus: (status) => status < 500 // Aceptar 404
        });
        
        if (response.status === 200 && response.data) {
          const exp = this.parseExpedienteHTML(response.data, expedienteNum, tipo, año);
          if (exp) {
            expedientes.push(exp);
            console.log(`[Senado] ✓ ${expedienteNum}`);
          }
        }
        
      } catch (error: any) {
        // Ignorar errores 404 (expediente no existe)
        if (!error.message?.includes('404')) {
          console.error(`[Senado] Error en ${expedienteNum}:`, error.message);
        }
      }
      
      // Pequeño delay entre requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return expedientes;
  }

  /**
   * Parsear HTML del expediente del Senado
   */
  private parseExpedienteHTML(html: string, expedienteNum: string, tipo: string, año: string): Expediente | null {
    try {
      const root = parse(html);
      
      // Extraer título/sumario
      const sumarioEl = root.querySelector('.proyecto-sumario, .sumario, h3, .titulo');
      const sumario = sumarioEl?.text.trim() || 'Sin sumario disponible';
      
      // Extraer autores
      const autoresEl = root.querySelector('.proyecto-autores, .autores');
      let autores: string[] = [];
      if (autoresEl) {
        const autoresText = autoresEl.text.trim();
        autores = autoresText.split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0).slice(0, 5);
      }
      if (autores.length === 0) autores = ['Senador Nacional'];
      
      // Extraer fecha
      const fechaEl = root.querySelector('.fecha-presentacion, .fecha');
      let fecha = `${año}-01-01`;
      if (fechaEl) {
        const fechaText = fechaEl.text.trim();
        const match = fechaText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          fecha = `${match[3]}-${match[2]}-${match[1]}`;
        }
      }
      
      // Tipo de expediente
      let tipoExpediente = 'Proyecto de RESOLUCIÓN';
      if (tipo === 'PL') tipoExpediente = 'Proyecto de LEY';
      else if (tipo === 'PC') tipoExpediente = 'Proyecto de COMUNICACIÓN';
      else if (tipo === 'PD') tipoExpediente = 'Proyecto de DECLARACIÓN';
      
      // Link al PDF
      const pdfLink = `${this.baseUrl}/parlamentario/parlamentaria/${expedienteNum}/downloadPdf`;
      
      return {
        id: expedienteNum,
        expediente: expedienteNum,
        tipo_expediente: tipoExpediente,
        cámara: 'Senado',
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
      return null;
    }
  }

  async saveToFile(expedientes: Expediente[]): Promise<void> {
    try {
      await fs.writeFile(SENADO_DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');
      console.log(`[Senado Scraper] 💾 Datos guardados: ${expedientes.length} expedientes`);
    } catch (error) {
      console.error('[Senado Scraper] ❌ Error al guardar:', error);
    }
  }
}

export const senadoScraper = new SenadoScraper();
