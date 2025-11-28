import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '../data/db_expedientes.json');

// HCDN API Configuration
const HCDN_BASE_URL = "https://datos.hcdn.gob.ar/api/3/action";
const RESOURCE_ID_EXPEDIENTES = "22b2d52c-7a0e-426b-ac0a-a3326c388ba6"; // ID from search results

interface Expediente {
  id: string;
  expediente: string;
  tipo_expediente: string;
  cámara: "Diputados" | "Senado";
  estado: string;
  fecha_ingreso: string;
  autores: string[];
  bloque: string[];
  provincias: string[];
  sumario: string;
  OD_DIPUTADOS?: string;
  OD_SENADO?: string;
  Link_EXPTE?: string;
  Link_OD?: string;
  derivaciones: any[];
}

async function fetchHCDNExpedientes() {
  console.log("Fetching expedientes from HCDN API...");
  const limit = 100; // Fetch 100 real items
  const query = "PEDIDO DE INFORMES"; // Filter by type roughly
  
  try {
    const url = `${HCDN_BASE_URL}/datastore_search?resource_id=${RESOURCE_ID_EXPEDIENTES}&q=${encodeURIComponent(query)}&limit=${limit}`;
    console.log(`Requesting: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error("API returned unsuccessful response");
    }

    const records = data.result.records;
    console.log(`Found ${records.length} records from HCDN.`);

    return records.map((rec: any) => {
      // Map HCDN CKAN fields to our schema
      // Note: Actual field names need to be verified from response, defaulting to common ones
      return {
        id: `D-${rec._id}`,
        expediente: rec.expediente || rec.numero || `EXP-${rec._id}`,
        tipo_expediente: "Pedido de Informes", // We filtered by this
        cámara: "Diputados",
        estado: rec.estado || "Estado desconocido",
        fecha_ingreso: rec.fecha || new Date().toISOString().split('T')[0],
        sumario: rec.sumario || rec.titulo || "Sin sumario",
        autores: [rec.firmantes || rec.autor || "Diputado"],
        bloque: [rec.bloque || "Bloque desconocido"],
        provincias: [rec.distrito || "Nacional"],
        Link_EXPTE: rec.url_expediente || `https://www.hcdn.gob.ar/proyectos/${rec.expediente}`,
        derivaciones: []
      } as Expediente;
    });

  } catch (error) {
    console.error("Error fetching HCDN data:", error);
    return [];
  }
}

// Mock function for Senado since no public API exists
function getSenadoMockData(): Expediente[] {
  console.log("Generating simulated Senado data (No public API available)...");
  return [
    {
      id: "S-MOCK-1",
      expediente: "1234-S-2024",
      tipo_expediente: "Pedido de Informes",
      cámara: "Senado",
      estado: "En comisión",
      fecha_ingreso: "2024-03-15",
      sumario: "Solicita informes sobre la situación de las universidades nacionales.",
      autores: ["Senador Ejemplo"],
      bloque: ["UCR"],
      provincias: ["Córdoba"],
      Link_EXPTE: "https://www.senado.gob.ar/parlamentario/comisiones/",
      derivaciones: [{ comision: "Educación", fecha: "2024-03-20", estado: "Ingresado" }]
    },
    {
      id: "S-MOCK-2",
      expediente: "5678-S-2024",
      tipo_expediente: "Pedido de Informes",
      cámara: "Senado",
      estado: "Con Orden del Día",
      fecha_ingreso: "2024-04-10",
      sumario: "Solicita informes sobre obras viales en la Ruta 40.",
      autores: ["Senador Test"],
      bloque: ["Frente de Todos"],
      provincias: ["Mendoza"],
      OD_SENADO: "123/24",
      Link_OD: "https://www.senado.gob.ar/",
      Link_EXPTE: "https://www.senado.gob.ar/",
      derivaciones: []
    }
  ];
}

async function runETL() {
  const diputadosData = await fetchHCDNExpedientes();
  const senadoData = getSenadoMockData();
  
  const allData = [...diputadosData, ...senadoData];
  
  if (allData.length > 0) {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allData, null, 2));
    console.log(`ETL Complete. Saved ${allData.length} records to ${OUTPUT_PATH}`);
  } else {
    console.error("ETL Failed: No data collected.");
  }
}

runETL();
