import { z } from "zod";

export const firmante = z.object({
  nombre: z.string(),
  distrito: z.string().optional(),
  bloque: z.string().optional(),
  tipo: z.enum(["autor", "coautor"]).optional(),
});

export const tramite = z.object({
  fecha: z.string(),
  camara: z.string().optional(),
  movimiento: z.string(),
  resultado: z.string().optional(),
});

export const movimientoInterno = z.object({
  id: z.string(),
  fecha: z.string(),
  emisor: z.string(),
  destino: z.string(),
  novedad: z.string(),
  comprobantes: z.array(z.string()).optional(),
  realizadoPor: z.string().optional(),
});

export const expedienteSchema = z.object({
  id: z.string(),
  expediente: z.string(),
  tipo_expediente: z.string(),
  cámara: z.enum(["Diputados", "Senado"]),
  estado: z.string(),
  fecha_ingreso: z.string(),
  autores: z.array(z.string()),
  bloque: z.array(z.string()),
  provincias: z.array(z.string()),
  OD_DIPUTADOS: z.string().optional(),
  OD_SENADO: z.string().optional(),
  Fecha_OD: z.string().optional(),
  Link_OD: z.string().optional(),
  Link_EXPTE: z.string().optional(),
  TP: z.string().optional(),
  derivaciones: z.array(z.object({
    comision: z.string(),
    fecha: z.string(),
    estado: z.string(),
  })),
  sumario: z.string(),
  extracto: z.string().optional(),
  firmantes: z.array(firmante).optional(),
  tramites: z.array(tramite).optional(),
  dictamenes: z.array(z.object({
    tipo: z.string(),
    fecha: z.string(),
    descripcion: z.string().optional(),
  })).optional(),
  tramite_parlamentario: z.string().optional(),
  movimientos_internos: z.array(movimientoInterno).optional(),
});

export const ordenDelDiaSchema = z.object({
  id: z.string(),
  numero_od: z.string(), // "OD-826-25", "671/2025"
  camara: z.enum(["Diputados", "Senado"]),
  fecha_od: z.string(),
  comision: z.string(),
  estado: z.string(), // "PENDIENTE en la HCDN", "PENDIENTE en el MSN", "APROBADO", etc.
  expedientes: z.array(z.string()), // Lista de números de expedientes relacionados
  autores: z.array(z.string()),
  bloque: z.array(z.string()),
  extracto: z.string(),
  ministerio: z.string().optional(), // Solo para Senado
  link_pdf: z.string().optional(),
  observaciones: z.string().optional(),
});

export type Expediente = z.infer<typeof expedienteSchema>;
export type InsertExpediente = Expediente;
export type OrdenDelDia = z.infer<typeof ordenDelDiaSchema>;
