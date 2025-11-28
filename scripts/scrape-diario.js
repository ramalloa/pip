#!/usr/bin/env node
/**
 * Script de Scraping Diario - Ejecutar manualmente en la VM
 * Uso: node scripts/scrape-diario.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'client', 'src', 'data', 'db_expedientes.json');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'scrape-diario.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {}
}

async function scrapeHCDN() {
  log('=== SCRAPING DIPUTADOS ===');
  const expedientes = [];
  
  try {
    // API de datos abiertos HCDN
    const url = 'https://datos.hcdn.gob.ar/api/3/action/datastore_search?resource_id=proyectos&limit=500&sort=fecha%20desc';
    const response = await axios.get(url, { timeout: 30000 });
    
    if (response.data?.result?.records) {
      const records = response.data.result.records;
      log(`HCDN API: ${records.length} registros obtenidos`);
      
      records.forEach(r => {
        if (r.tipo?.toLowerCase().includes('informe') || 
            r.sumario?.toLowerCase().includes('pedido de informe')) {
          expedientes.push({
            id: r.expediente,
            expediente: r.expediente,
            tipo_expediente: r.tipo || 'PEDIDO DE INFORMES',
            cámara: 'Diputados',
            fecha_ingreso: r.fecha || new Date().toISOString().split('T')[0],
            sumario: r.sumario || 'Sin sumario',
            autores: r.firmantes ? r.firmantes.split(',').map(f => f.trim()) : ['Legislador Nacional'],
            estado: r.estado || 'En trámite',
            bloque: [],
            provincias: [],
            derivaciones: [],
            Link_EXPTE: `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${r.expediente}`,
            TP: r.tp || ''
          });
        }
      });
      
      log(`HCDN: ${expedientes.length} pedidos de informes encontrados`);
    }
  } catch (e) {
    log(`Error HCDN: ${e.message}`);
  }
  
  return expedientes;
}

async function scrapeSenado() {
  log('=== SCRAPING SENADO ===');
  const expedientes = [];
  
  try {
    // Intentar scraping del Senado
    const url = 'https://www.senado.gob.ar/parlamentario/parlamentaria/';
    const response = await axios.get(url, { 
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const $ = cheerio.load(response.data);
    
    $('a[href*="verExp"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      
      const match = href.match(/(\d+)\.(\d+)\/S\/(PI|PL)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        const year = '20' + match[2];
        const expNum = `${num}-S-${year}`;
        
        expedientes.push({
          id: expNum,
          expediente: expNum,
          tipo_expediente: match[3] === 'PI' ? 'PEDIDO DE INFORMES' : 'Proyecto de LEY',
          cámara: 'Senado',
          fecha_ingreso: `${year}-01-15`,
          sumario: text || 'Expediente del Senado',
          autores: ['Senador Nacional'],
          estado: 'En trámite',
          bloque: [],
          provincias: [],
          derivaciones: [],
          Link_EXPTE: `https://www.senado.gob.ar${href}`,
          TP: ''
        });
      }
    });
    
    log(`Senado: ${expedientes.length} expedientes encontrados`);
  } catch (e) {
    log(`Error Senado: ${e.message}`);
  }
  
  return expedientes;
}

async function main() {
  log('');
  log('========================================');
  log('  SCRAPING DIARIO - INICIO');
  log('========================================');
  
  // Cargar datos existentes
  let existingData = [];
  try {
    existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    log(`Expedientes existentes: ${existingData.length}`);
  } catch (e) {
    log('No se encontró archivo de datos, creando nuevo...');
  }
  
  const existingIds = new Set(existingData.map(e => e.expediente));
  
  // Scraping
  const hcdnExp = await scrapeHCDN();
  const senadoExp = await scrapeSenado();
  
  // Agregar nuevos
  let added = 0;
  [...hcdnExp, ...senadoExp].forEach(exp => {
    if (!existingIds.has(exp.expediente)) {
      existingData.unshift(exp);
      existingIds.add(exp.expediente);
      added++;
      log(`NUEVO: ${exp.expediente}`);
    }
  });
  
  // Ordenar por fecha
  existingData.sort((a, b) => new Date(b.fecha_ingreso) - new Date(a.fecha_ingreso));
  
  // Guardar
  fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2));
  
  log('');
  log('========================================');
  log('  RESUMEN');
  log('========================================');
  log(`Nuevos agregados: ${added}`);
  log(`Total expedientes: ${existingData.length}`);
  log(`Diputados: ${existingData.filter(e => e.cámara === 'Diputados').length}`);
  log(`Senado: ${existingData.filter(e => e.cámara === 'Senado').length}`);
  log('========================================');
  log('');
}

main().catch(e => {
  log(`ERROR FATAL: ${e.message}`);
  process.exit(1);
});
