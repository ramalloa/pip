export interface Expediente {
  id: string;
  expediente: string;
  tipo_expediente: "Pedido de Informes" | "Solicitud" | "Comunicación";
  cámara: "Diputados" | "Senado";
  estado: "respondido" | "sin responder" | "con dictamen parcial" | "con dictamen total" | "en comisión" | "archivado" | "aprobado" | "rechazado" | "pendiente";
  fecha_ingreso: string;
  autores: string[];
  bloque: string[];
  provincias: string[];
  OD_DIPUTADOS?: string;
  OD_SENADO?: string;
  Fecha_OD?: string;
  Link_OD?: string;
  Link_EXPTE?: string;
  derivaciones: {
    comision: string;
    fecha: string;
    estado: string;
  }[];
  sumario: string; // Added for UI context
}

// Helper to generate mock data
const generateExpedientes = (): Expediente[] => {
  const tipos: Expediente['tipo_expediente'][] = ["Pedido de Informes", "Solicitud", "Comunicación"];
  const estados: Expediente['estado'][] = ["respondido", "sin responder", "con dictamen parcial", "con dictamen total", "en comisión", "archivado", "aprobado", "rechazado", "pendiente"];
  const bloques = ["Frente de Todos", "Juntos por el Cambio", "UCR", "PRO", "La Libertad Avanza", "Frente de Izquierda", "Federal"];
  const provincias = ["Buenos Aires", "CABA", "Córdoba", "Santa Fe", "Mendoza", "Tucumán", "Salta", "Entre Ríos"];
  const comisiones = ["Presupuesto y Hacienda", "Asuntos Constitucionales", "Legislación General", "Relaciones Exteriores", "Salud Pública"];

  const expedientes: Expediente[] = [];

  for (let i = 1; i <= 50; i++) {
    const camara = i % 2 === 0 ? "Diputados" : "Senado";
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const estado = estados[Math.floor(Math.random() * estados.length)];
    const hasOD = Math.random() > 0.7;

    expedientes.push({
      id: i.toString(),
      expediente: `${Math.floor(Math.random() * 9000) + 1000}-${camara === "Diputados" ? "D" : "S"}-2024`,
      tipo_expediente: tipo,
      cámara: camara,
      estado: estado,
      fecha_ingreso: new Date(2024, Math.floor(Math.random() * 11), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      autores: [
        `Legislador ${Math.floor(Math.random() * 100)}`,
        Math.random() > 0.5 ? `Legislador ${Math.floor(Math.random() * 100)}` : ""
      ].filter(Boolean),
      bloque: [bloques[Math.floor(Math.random() * bloques.length)]],
      provincias: [provincias[Math.floor(Math.random() * provincias.length)]],
      OD_DIPUTADOS: hasOD && camara === "Diputados" ? `OD-${Math.floor(Math.random() * 100)}` : undefined,
      OD_SENADO: hasOD && camara === "Senado" ? `OD-${Math.floor(Math.random() * 100)}` : undefined,
      Fecha_OD: hasOD ? "2024-11-15" : undefined,
      Link_OD: hasOD ? "#" : undefined,
      Link_EXPTE: "#",
      derivaciones: [
        {
          comision: comisiones[Math.floor(Math.random() * comisiones.length)],
          fecha: "2024-03-15",
          estado: "En tratamiento"
        }
      ],
      sumario: `Proyecto de ${tipo} solicitando informes sobre la situación actual de ${Math.random() > 0.5 ? "la infraestructura vial" : "los programas de salud"} en la provincia.`
    });
  }
  return expedientes;
};

export const MOCK_DATA = generateExpedientes();
