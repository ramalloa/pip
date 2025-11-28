#!/usr/bin/env node
/**
 * Script para importar extractos/sumarios desde Excel
 * Uso: node scripts/importar-excel.js archivo.xlsx
 * 
 * El Excel debe tener columnas:
 * - expediente (obligatorio): número de expediente (ej: 1234-D-2025)
 * - sumario o extracto: texto del sumario
 * - autores (opcional): nombres separados por coma
 * - bloque (opcional): nombre del bloque
 * - provincia (opcional): nombre de la provincia
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'client', 'src', 'data', 'db_expedientes.json');

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('');
    console.log('USO: node scripts/importar-excel.js <archivo.xlsx>');
    console.log('');
    console.log('El Excel debe tener las siguientes columnas:');
    console.log('  - expediente (obligatorio): número de expediente');
    console.log('  - sumario o extracto: texto del sumario');
    console.log('  - autores (opcional): nombres separados por coma');
    console.log('  - bloque (opcional)');
    console.log('  - provincia (opcional)');
    console.log('');
    process.exit(1);
  }
  
  const excelFile = args[0];
  
  if (!fs.existsSync(excelFile)) {
    log(`ERROR: No se encontró el archivo: ${excelFile}`);
    process.exit(1);
  }
  
  log(`Leyendo Excel: ${excelFile}`);
  
  // Leer Excel
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  log(`Filas en Excel: ${rows.length}`);
  
  // Cargar datos existentes
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    log(`Expedientes existentes: ${data.length}`);
  } catch (e) {
    log('Creando nuevo archivo de datos...');
  }
  
  // Crear mapa para búsqueda rápida
  const dataMap = new Map();
  data.forEach((exp, idx) => {
    dataMap.set(exp.expediente, idx);
    dataMap.set(exp.id, idx);
  });
  
  let updated = 0;
  let added = 0;
  let errors = 0;
  
  rows.forEach((row, i) => {
    // Buscar columna de expediente (flexible en nombres)
    let expediente = row.expediente || row.Expediente || row.EXPEDIENTE || 
                     row.exp || row.Exp || row.numero || row.Numero;
    
    if (!expediente) {
      log(`Fila ${i + 2}: Sin número de expediente, omitiendo`);
      errors++;
      return;
    }
    
    // Normalizar expediente
    expediente = String(expediente).trim().toUpperCase();
    
    // Buscar sumario
    const sumario = row.sumario || row.Sumario || row.SUMARIO || 
                    row.extracto || row.Extracto || row.EXTRACTO ||
                    row.descripcion || row.Descripcion || '';
    
    // Buscar autores
    const autoresRaw = row.autores || row.Autores || row.AUTORES || 
                       row.autor || row.Autor || row.firmantes || '';
    const autores = autoresRaw ? String(autoresRaw).split(',').map(a => a.trim()).filter(a => a) : [];
    
    // Buscar bloque
    const bloque = row.bloque || row.Bloque || row.BLOQUE || '';
    
    // Buscar provincia
    const provincia = row.provincia || row.Provincia || row.PROVINCIA || 
                      row.distrito || row.Distrito || '';
    
    // Verificar si existe
    if (dataMap.has(expediente)) {
      // Actualizar existente
      const idx = dataMap.get(expediente);
      
      if (sumario) {
        data[idx].sumario = sumario;
        data[idx].extracto = sumario;
      }
      if (autores.length > 0) {
        data[idx].autores = autores;
      }
      if (bloque) {
        data[idx].bloque = [bloque];
      }
      if (provincia) {
        data[idx].provincias = [provincia];
      }
      
      updated++;
      log(`Actualizado: ${expediente}`);
    } else {
      // Agregar nuevo
      const camara = expediente.includes('-D-') ? 'Diputados' : 
                     expediente.includes('-S-') ? 'Senado' : 'Diputados';
      
      const newExp = {
        id: expediente,
        expediente: expediente,
        tipo_expediente: 'PEDIDO DE INFORMES',
        cámara: camara,
        fecha_ingreso: new Date().toISOString().split('T')[0],
        sumario: sumario || 'Sin sumario',
        extracto: sumario || 'Sin sumario',
        autores: autores.length > 0 ? autores : ['Legislador Nacional'],
        estado: 'En trámite',
        bloque: bloque ? [bloque] : [],
        provincias: provincia ? [provincia] : [],
        derivaciones: [],
        Link_EXPTE: camara === 'Diputados' 
          ? `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${expediente}`
          : `https://www.senado.gob.ar/parlamentario/comisiones/verExp/${expediente.replace('-S-20', '.').replace('-S-', '.')}/S/PI`,
        TP: ''
      };
      
      data.unshift(newExp);
      dataMap.set(expediente, 0);
      added++;
      log(`Agregado: ${expediente}`);
    }
  });
  
  // Ordenar por fecha
  data.sort((a, b) => new Date(b.fecha_ingreso) - new Date(a.fecha_ingreso));
  
  // Guardar
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  log('');
  log('========================================');
  log('  RESUMEN DE IMPORTACIÓN');
  log('========================================');
  log(`Actualizados: ${updated}`);
  log(`Agregados: ${added}`);
  log(`Errores: ${errors}`);
  log(`Total expedientes: ${data.length}`);
  log('========================================');
}

main();
