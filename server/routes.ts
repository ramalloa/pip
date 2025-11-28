import { Router, type Request, type Response } from "express";
import { storage } from "./storage";
import { scraper } from "./scraper";
import { ordenesScraper } from "./ordenes-scraper";
import { realScraper } from "./real-scraper";
import { hcdnApiScraper } from "./hcdn-api-scraper";
import { hcdnCompleteScraper } from "./hcdn-complete-scraper";
import { excelDownloader } from "./excel-downloader";
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Obtener todos los expedientes (con auto-actualización desde API HCDN)
router.get("/api/expedientes", async (req: Request, res: Response) => {
  try {
    let expedientes = await storage.getAllExpedientes();
    
    // Si no hay datos, descargar automáticamente desde API HCDN
    if (!expedientes || expedientes.length < 100) {
      console.log('[API] No hay datos suficientes, descargando automáticamente desde API HCDN...');
      expedientes = await hcdnApiScraper.scrapeAll2025();
    }
    
    res.json(expedientes);
  } catch (error) {
    console.error('[API] Error al obtener expedientes:', error);
    res.status(500).json({ error: "Error al obtener expedientes" });
  }
});

// Buscar expedientes (mejorado)
router.get("/api/expedientes/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Parámetro 'q' requerido" });
    }
    
    const expedientes = await storage.searchExpedientes(q);
    res.json(expedientes);
  } catch (error) {
    console.error('[API] Error en búsqueda:', error);
    res.status(500).json({ error: "Error en la búsqueda" });
  }
});

// Filtrar expedientes (mejorado)
router.post("/api/expedientes/filter", async (req: Request, res: Response) => {
  try {
    const filters = req.body;
    const expedientes = await storage.filterExpedientes(filters);
    res.json(expedientes);
  } catch (error) {
    console.error('[API] Error al filtrar:', error);
    res.status(500).json({ error: "Error al filtrar expedientes" });
  }
});

// Obtener un expediente por ID
router.get("/api/expedientes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const expediente = await storage.getExpedienteById(id);
    
    if (!expediente) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }
    
    res.json(expediente);
  } catch (error) {
    console.error('[API] Error al obtener expediente:', error);
    res.status(500).json({ error: "Error al obtener expediente" });
  }
});

// Actualizar datos (descarga automática desde API HCDN)
router.post("/api/scrape", async (req: Request, res: Response) => {
  try {
    console.log('[API] Iniciando descarga automática desde API HCDN...');
    const expedientes = await hcdnApiScraper.scrapeAll2025();
    
    // Extraer también Órdenes del Día
    console.log('[API] Extrayendo Órdenes del Día...');
    await ordenesScraper.scrapeAll();
    
    res.json({ 
      success: true, 
      count: expedientes.length,
      message: `${expedientes.length} expedientes descargados desde API HCDN`
    });
  } catch (error) {
    console.error('[API] Error en extracción:', error);
    res.status(500).json({ error: "Error al actualizar datos" });
  }
});

// Exportar a Excel real (.xlsx) - MEJORADO
router.get("/api/export/excel", async (req: Request, res: Response) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    
    if (expedientes.length === 0) {
      return res.status(404).json({ error: "No hay expedientes para exportar" });
    }
    
    // Preparar datos para Excel
    const excelData = expedientes.map(exp => ({
      'ID': exp.id,
      'Expediente': exp.expediente,
      'Cámara': exp.cámara,
      'Tipo': exp.tipo_expediente,
      'Estado': exp.estado,
      'Fecha Ingreso': exp.fecha_ingreso,
      'Sumario': exp.sumario,
      'Autores': exp.autores.join(', '),
      'Bloque': exp.bloque.join(', '),
      'Provincias': exp.provincias.join(', '),
      'Comisiones': exp.derivaciones.map(d => d.comision).join(', '),
      'Orden del Día (Diputados)': exp.OD_DIPUTADOS || '',
      'Orden del Día (Senado)': exp.OD_SENADO || '',
      'Link Expediente': exp.Link_EXPTE || '',
      'Link OD': exp.Link_OD || ''
    }));
    
    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Configurar ancho de columnas
    const colWidths = [
      { wch: 15 },  // ID
      { wch: 20 },  // Expediente
      { wch: 12 },  // Cámara
      { wch: 30 },  // Tipo
      { wch: 20 },  // Estado
      { wch: 15 },  // Fecha
      { wch: 80 },  // Sumario
      { wch: 40 },  // Autores
      { wch: 30 },  // Bloque
      { wch: 25 },  // Provincias
      { wch: 40 },  // Comisiones
      { wch: 15 },  // OD Diputados
      { wch: 15 },  // OD Senado
      { wch: 60 },  // Link Expediente
      { wch: 60 }   // Link OD
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
    
    // Generar buffer del archivo Excel
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Enviar archivo
    const filename = `expedientes_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
    
    console.log(`[API] Excel generado: ${filename} (${expedientes.length} expedientes)`);
  } catch (error) {
    console.error('[API] Error al exportar Excel:', error);
    res.status(500).json({ error: "Error al generar archivo Excel" });
  }
});

// Estadísticas
router.get("/api/stats", async (req: Request, res: Response) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    
    const stats = {
      total: expedientes.length,
      porCamara: {
        Diputados: expedientes.filter(e => e.cámara === 'Diputados').length,
        Senado: expedientes.filter(e => e.cámara === 'Senado').length
      },
      porTipo: {} as Record<string, number>,
      porEstado: {} as Record<string, number>,
      conOD: expedientes.filter(e => e.OD_DIPUTADOS || e.OD_SENADO).length,
      enComision: expedientes.filter(e => 
        e.estado.toLowerCase().includes('comisión') ||
        e.derivaciones.length > 0
      ).length
    };
    
    // Contar por tipo
    expedientes.forEach(e => {
      stats.porTipo[e.tipo_expediente] = (stats.porTipo[e.tipo_expediente] || 0) + 1;
      stats.porEstado[e.estado] = (stats.porEstado[e.estado] || 0) + 1;
    });
    
    res.json(stats);
  } catch (error) {
    console.error('[API] Error al obtener estadísticas:', error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// ========== ÓRDENES DEL DÍA ==========

// Obtener todas las órdenes del día (con actualización automática)
router.get("/api/ordenes-dia", async (req: Request, res: Response) => {
  try {
    let ordenes = await ordenesScraper.loadFromFile();
    
    // Si no hay datos o están vacíos, extraer automáticamente
    if (!ordenes || ordenes.length === 0) {
      console.log('[API] No hay datos de OD, extrayendo automáticamente...');
      ordenes = await ordenesScraper.scrapeAll();
    }
    
    res.json(ordenes);
  } catch (error) {
    console.error('[API] Error al obtener órdenes del día:', error);
    res.status(500).json({ error: "Error al obtener órdenes del día" });
  }
});

// Actualizar órdenes del día (scraping)
router.post("/api/ordenes-dia/scrape", async (req: Request, res: Response) => {
  try {
    console.log('[API] Iniciando scraping de Órdenes del Día...');
    const ordenes = await ordenesScraper.scrapeAll();
    res.json({ 
      success: true, 
      count: ordenes.length,
      message: 'Órdenes del Día actualizadas correctamente'
    });
  } catch (error) {
    console.error('[API] Error en scraping de OD:', error);
    res.status(500).json({ error: "Error al actualizar órdenes del día" });
  }
});

// ========== CRUD EXPEDIENTES ==========

// Crear nuevo expediente
router.post("/api/expedientes", async (req: Request, res: Response) => {
  try {
    const expediente = req.body;
    
    if (!expediente.expediente || !expediente.sumario) {
      return res.status(400).json({ error: "Expediente y sumario son requeridos" });
    }

    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const expedientes = JSON.parse(data);
    
    const exists = expedientes.find((e: any) => e.expediente === expediente.expediente);
    if (exists) {
      return res.status(409).json({ error: "El expediente ya existe" });
    }

    const newExpediente = {
      id: expediente.expediente,
      expediente: expediente.expediente,
      tipo_expediente: expediente.tipo_expediente || 'Proyecto de LEY',
      cámara: expediente.cámara || 'Diputados',
      estado: expediente.estado || 'Presentado',
      fecha_ingreso: expediente.fecha_ingreso || new Date().toISOString().split('T')[0],
      autores: expediente.autores || [],
      bloque: expediente.bloque || [],
      provincias: expediente.provincias || [],
      derivaciones: expediente.derivaciones || [],
      sumario: expediente.sumario,
      extracto: expediente.extracto || expediente.sumario,
      firmantes: expediente.firmantes || [],
      tramites: expediente.tramites || [],
      tramite_parlamentario: expediente.tramite_parlamentario || '',
      movimientos_internos: expediente.movimientos_internos || [],
      OD_DIPUTADOS: expediente.OD_DIPUTADOS || '',
      OD_SENADO: expediente.OD_SENADO || '',
      Link_EXPTE: expediente.Link_EXPTE || '',
      Link_OD: expediente.Link_OD || '',
      TP: expediente.TP || ''
    };

    expedientes.unshift(newExpediente);
    await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');

    console.log(`[API] Expediente creado: ${newExpediente.expediente}`);
    res.status(201).json(newExpediente);
  } catch (error) {
    console.error('[API] Error al crear expediente:', error);
    res.status(500).json({ error: "Error al crear expediente" });
  }
});

// Actualizar expediente
router.put("/api/expedientes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const expedientes = JSON.parse(data);
    
    const index = expedientes.findIndex((e: any) => e.id === id || e.expediente === id);
    if (index === -1) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }

    expedientes[index] = {
      ...expedientes[index],
      ...updates,
      id: expedientes[index].id
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');

    console.log(`[API] Expediente actualizado: ${id}`);
    res.json(expedientes[index]);
  } catch (error) {
    console.error('[API] Error al actualizar expediente:', error);
    res.status(500).json({ error: "Error al actualizar expediente" });
  }
});

// Eliminar expediente
router.delete("/api/expedientes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const expedientes = JSON.parse(data);
    
    const index = expedientes.findIndex((e: any) => e.id === id || e.expediente === id);
    if (index === -1) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }

    const deleted = expedientes.splice(index, 1)[0];
    await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');

    console.log(`[API] Expediente eliminado: ${id}`);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('[API] Error al eliminar expediente:', error);
    res.status(500).json({ error: "Error al eliminar expediente" });
  }
});

// ========== MOVIMIENTOS INTERNOS ==========

// Agregar movimiento interno a un expediente
router.post("/api/expedientes/:id/movimientos", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const movimiento = req.body;

    if (!movimiento.fecha || !movimiento.emisor || !movimiento.destino || !movimiento.novedad) {
      return res.status(400).json({ error: "Fecha, emisor, destino y novedad son requeridos" });
    }

    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const expedientes = JSON.parse(data);
    
    const index = expedientes.findIndex((e: any) => e.id === id || e.expediente === id);
    if (index === -1) {
      return res.status(404).json({ error: "Expediente no encontrado" });
    }

    const nuevoMovimiento = {
      id: `mov-${Date.now()}`,
      fecha: movimiento.fecha,
      emisor: movimiento.emisor,
      destino: movimiento.destino,
      novedad: movimiento.novedad,
      comprobantes: movimiento.comprobantes || [],
      realizadoPor: movimiento.realizadoPor || 'Sistema'
    };

    if (!expedientes[index].movimientos_internos) {
      expedientes[index].movimientos_internos = [];
    }
    expedientes[index].movimientos_internos.push(nuevoMovimiento);

    await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');

    console.log(`[API] Movimiento agregado a ${id}`);
    res.status(201).json(nuevoMovimiento);
  } catch (error) {
    console.error('[API] Error al agregar movimiento:', error);
    res.status(500).json({ error: "Error al agregar movimiento" });
  }
});

// ========== BACKUP Y DESCARGA ==========

// Crear backup
router.post("/api/backup", async (req: Request, res: Response) => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `db_expedientes_${timestamp}.json`);
    
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    await fs.writeFile(backupFile, data, 'utf-8');
    
    console.log(`[API] Backup creado: ${backupFile}`);
    res.json({ 
      success: true, 
      file: `db_expedientes_${timestamp}.json`,
      message: 'Backup creado correctamente' 
    });
  } catch (error) {
    console.error('[API] Error al crear backup:', error);
    res.status(500).json({ error: "Error al crear backup" });
  }
});

// Listar backups
router.get("/api/backups", async (req: Request, res: Response) => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith('db_expedientes_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 20);
    
    res.json(backups);
  } catch (error) {
    console.error('[API] Error al listar backups:', error);
    res.status(500).json({ error: "Error al listar backups" });
  }
});

// Descargar JSON
router.get("/api/export/json", async (req: Request, res: Response) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const filename = `expedientes_${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
    
    console.log(`[API] JSON exportado: ${filename}`);
  } catch (error) {
    console.error('[API] Error al exportar JSON:', error);
    res.status(500).json({ error: "Error al exportar JSON" });
  }
});

// Restaurar desde backup
router.post("/api/restore/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const backupFile = path.join(BACKUP_DIR, filename);
    
    const stats = await fs.stat(backupFile);
    if (!stats.isFile()) {
      return res.status(404).json({ error: "Backup no encontrado" });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentBackup = path.join(BACKUP_DIR, `db_expedientes_pre-restore_${timestamp}.json`);
    const currentData = await fs.readFile(DATA_FILE, 'utf-8');
    await fs.writeFile(currentBackup, currentData, 'utf-8');
    
    const backupData = await fs.readFile(backupFile, 'utf-8');
    await fs.writeFile(DATA_FILE, backupData, 'utf-8');
    
    console.log(`[API] Restaurado desde: ${filename}`);
    res.json({ 
      success: true, 
      message: `Datos restaurados desde ${filename}`,
      previousBackup: `db_expedientes_pre-restore_${timestamp}.json`
    });
  } catch (error) {
    console.error('[API] Error al restaurar:', error);
    res.status(500).json({ error: "Error al restaurar backup" });
  }
});

// ========== SCRAPING COMPLETO ==========

// Extracción completa con datos detallados
router.post("/api/scrape/complete", async (req: Request, res: Response) => {
  try {
    console.log('[API] Iniciando extracción completa con detalles...');
    const expedientes = await hcdnCompleteScraper.runFullExtraction();
    
    res.json({ 
      success: true, 
      count: expedientes.length,
      message: `${expedientes.length} expedientes extraídos con datos completos`
    });
  } catch (error) {
    console.error('[API] Error en extracción completa:', error);
    res.status(500).json({ error: "Error al extraer datos completos" });
  }
});

// Enriquecer expediente específico con datos completos
router.post("/api/expedientes/:id/enrich", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log(`[API] Enriqueciendo expediente: ${id}`);
    const enriched = await hcdnCompleteScraper.scrapeExpedienteCompleto(id);
    
    if (!enriched) {
      return res.status(404).json({ error: "No se pudo obtener datos del expediente" });
    }
    
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const expedientes = JSON.parse(data);
    
    const index = expedientes.findIndex((e: any) => e.id === id || e.expediente === id);
    if (index !== -1) {
      expedientes[index] = {
        ...expedientes[index],
        ...enriched
      };
      await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');
    }
    
    res.json(enriched);
  } catch (error) {
    console.error('[API] Error al enriquecer expediente:', error);
    res.status(500).json({ error: "Error al enriquecer expediente" });
  }
});

// ========== ESTADÍSTICAS ==========

// Obtener estadísticas de la base de datos
router.get("/api/stats", async (req: Request, res: Response) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const expedientes = JSON.parse(data);
    
    const stats = {
      total: expedientes.length,
      diputados: expedientes.filter((e: any) => e.cámara === 'Diputados').length,
      senado: expedientes.filter((e: any) => e.cámara === 'Senado').length,
      pedidosInformes: expedientes.filter((e: any) => 
        e.tipo_expediente?.toLowerCase().includes('informe')
      ).length,
      conFirmantes: expedientes.filter((e: any) => e.firmantes?.length > 0).length,
      conMovimientos: expedientes.filter((e: any) => e.movimientos_internos?.length > 0).length,
      ultimaActualizacion: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('[API] Error al obtener estadísticas:', error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// ========== FILTROS AVANZADOS ==========

// Lista de bloques políticos argentinos conocidos
const BLOQUES_ARGENTINA = [
  "LA LIBERTAD AVANZA",
  "PRO",
  "UNIÓN POR LA PATRIA",
  "UCR - EVOLUCIÓN RADICAL",
  "HACEMOS COALICIÓN FEDERAL",
  "INNOVACIÓN FEDERAL",
  "MOVIMIENTO POPULAR NEUQUINO",
  "POR SANTA CRUZ",
  "COALICIÓN CÍVICA - ARI",
  "FRENTE DE IZQUIERDA Y DE TRABAJADORES - UNIDAD",
  "PRODUCCIÓN Y TRABAJO",
  "UNIDAD FEDERAL",
  "BLOQUE JUSTICIALISTA",
  "FRENTE RENOVADOR",
  "SOCIALISTA",
  "DEMOCRATA CRISTIANO"
];

// Obtener lista de bloques únicos
router.get("/api/bloques", async (req: Request, res: Response) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    
    const bloquesSet = new Set<string>(BLOQUES_ARGENTINA);
    expedientes.forEach(exp => {
      if (exp.bloque) {
        exp.bloque.forEach((b: string) => {
          if (b && b !== 'BLOQUE PARLAMENTARIO') {
            bloquesSet.add(b);
          }
        });
      }
      if ((exp as any).firmantes) {
        (exp as any).firmantes.forEach((f: any) => {
          if (f.bloque) bloquesSet.add(f.bloque);
        });
      }
    });
    
    const bloques = Array.from(bloquesSet).sort();
    res.json(bloques);
  } catch (error) {
    console.error('[API] Error al obtener bloques:', error);
    res.status(500).json({ error: "Error al obtener bloques" });
  }
});

// Lista de provincias argentinas
const PROVINCIAS_ARGENTINA = [
  "BUENOS AIRES",
  "CABA",
  "CATAMARCA",
  "CHACO",
  "CHUBUT",
  "CÓRDOBA",
  "CORRIENTES",
  "ENTRE RÍOS",
  "FORMOSA",
  "JUJUY",
  "LA PAMPA",
  "LA RIOJA",
  "MENDOZA",
  "MISIONES",
  "NEUQUÉN",
  "RÍO NEGRO",
  "SALTA",
  "SAN JUAN",
  "SAN LUIS",
  "SANTA CRUZ",
  "SANTA FE",
  "SANTIAGO DEL ESTERO",
  "TIERRA DEL FUEGO",
  "TUCUMÁN"
];

// Obtener lista de provincias únicas
router.get("/api/provincias", async (req: Request, res: Response) => {
  try {
    const expedientes = await storage.getAllExpedientes();
    
    const provinciasSet = new Set<string>(PROVINCIAS_ARGENTINA);
    expedientes.forEach(exp => {
      if (exp.provincias) {
        exp.provincias.forEach((p: string) => {
          if (p) provinciasSet.add(p);
        });
      }
      if ((exp as any).firmantes) {
        (exp as any).firmantes.forEach((f: any) => {
          if (f.distrito) provinciasSet.add(f.distrito);
        });
      }
    });
    
    const provincias = Array.from(provinciasSet).sort();
    res.json(provincias);
  } catch (error) {
    console.error('[API] Error al obtener provincias:', error);
    res.status(500).json({ error: "Error al obtener provincias" });
  }
});

export default router;
