import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_PATH = path.resolve(__dirname, '../../../attached_assets/PI2024-2025_1764094408090.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, '../data/db_expedientes.json');

function parseExcel() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('Excel file not found at:', EXCEL_PATH);
    return;
  }

  console.log('Reading Excel file from:', EXCEL_PATH);
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON array of arrays to find header row
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  console.log(`Found ${rawRows.length} raw rows.`);

  // Find header row index
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
    if (rowStr.includes('expediente') || rowStr.includes('sumario') || rowStr.includes('orden del día') || rowStr.includes('dictamen')) {
      headerRowIndex = i;
      console.log(`Found likely header row at index ${i}:`, rawRows[i]);
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error('Could not find header row. Aborting.');
    return;
  }

  // Re-parse with found header row
  const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
  console.log(`Parsed ${data.length} records from header row.`);

  const cleanData = data.map((row: any, index: number) => {
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        // Exact match
        if (row[k] !== undefined) return row[k];
        // Case insensitive match
        const rowKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
        if (rowKey) return row[rowKey];
        // Partial match for messy headers
        const partialKey = Object.keys(row).find(rk => rk.toLowerCase().includes(k.toLowerCase()));
        if (partialKey) return row[partialKey];
      }
      return undefined;
    };

    const expediente = getVal(['Expediente', 'N° Exp.', 'Expte']) || `EXP-${index}`;
    const tipo = getVal(['Tipo', 'Tipo Proyecto']) || 'Pedido de Informes';
    
    // Determine Chamber
    let camara = getVal(['Camara', 'Cámara', 'Origen']);
    if (!camara) {
      const expStr = String(expediente).toUpperCase();
      if (expStr.includes('-S-')) camara = 'Senado';
      else if (expStr.includes('-D-')) camara = 'Diputados';
      else camara = 'Diputados'; // Default fallback
    }

    // Normalize authors
    let autores: string[] = [];
    const rawAutores = getVal(['Autor', 'Autores', 'Firmantes', 'Firmante', 'Iniciador']);
    if (rawAutores) {
      autores = String(rawAutores).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    // Normalize blocks
    let bloque: string[] = [];
    const rawBloque = getVal(['Bloque', 'Bloques']);
    if (rawBloque) {
      bloque = String(rawBloque).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    // Normalize provinces - Might not be in this specific file based on user description, but we keep logic
    let provincias: string[] = [];
    const rawProvincia = getVal(['Provincia', 'Distrito']);
    if (rawProvincia) {
      provincias = String(rawProvincia).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    // Status logic: The user mentioned "ORDENES DEL DIA PENDIENTES", so maybe they are all "Con Orden del Día"?
    // We look for a status column anyway.
    let estado = getVal(['Estado', 'Estado Parlamentario', 'Situación']) || 'pendiente';
    
    // Check for OD info
    const od = getVal(['Orden del Día', 'OD', 'N° OD']);
    let odDiputados = undefined;
    let odSenado = undefined;
    
    if (od) {
        if (camara === 'Diputados') odDiputados = String(od);
        else odSenado = String(od);
        // If it has an OD number, implied status might be advanced
        if (estado === 'pendiente') estado = 'Con Orden del Día';
    }

    // Map COMISION to derivaciones
    const comision = getVal(['COMISION', 'Comisión', 'Giro']);
    let derivaciones = [];
    if (comision) {
      derivaciones.push({
        comision: String(comision),
        fecha: parseDate(getVal(['Fecha OD', 'FECHA OD'])), // Using OD date as proxy if available, or just empty
        estado: 'Giro a comisión'
      });
    }

    return {
      id: getVal(['ID']) || `REC-${index}`,
      expediente: String(expediente),
      tipo_expediente: String(tipo),
      cámara: String(camara),
      estado: String(estado),
      fecha_ingreso: parseDate(getVal(['Fecha', 'Fecha Ingreso', 'Fecha Presentacion', 'F. Dictamen', 'FECHA OD'])), 
      sumario: getVal(['Sumario', 'Tema', 'Asunto', 'Titulo', 'Carátula', 'EXTRACTO']) || 'Sin sumario',
      autores: autores.length ? autores : ['Desconocido'],
      bloque: bloque.length ? bloque : ['Sin bloque'],
      provincias: provincias.length ? provincias : ['Nacional'],
      OD_DIPUTADOS: odDiputados,
      OD_SENADO: odSenado,
      Link_OD: getVal(['Link OD', 'Url OD', 'Enlace OD']),
      Link_EXPTE: getVal(['Link Expte', 'Url Expte', 'Enlace Expte']),
      derivaciones: derivaciones
    };
  });

  const validData = cleanData.filter((d: any) => d.expediente && !d.expediente.startsWith('EXP-'));
  
  if (validData.length > 0) {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(validData, null, 2));
    console.log(`Success! Saved ${validData.length} real records to ${OUTPUT_PATH}`);
  } else {
    console.error('No valid records found even after header detection.');
  }
}

function parseDate(excelDate: any) {
  if (!excelDate) return new Date().toISOString().split('T')[0];
  if (typeof excelDate === 'number') {
    const date = new Date(Math.round((excelDate - 25569)*86400*1000));
    return date.toISOString().split('T')[0];
  }
  if (typeof excelDate === 'string' && excelDate.includes('/')) {
    const parts = excelDate.split('/');
    if (parts.length === 3) {
      // Check if it is DD/MM/YYYY or MM/DD/YYYY
      // Usually DD/MM/YYYY in LatAm
      return `${parts[2]}-${parts[1]}-${parts[0]}`; 
    }
  }
  return String(excelDate);
}

parseExcel();
