import type { Expediente } from "@shared/schema";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'client', 'src', 'data', 'db_expedientes.json');

export interface IStorage {
  getAllExpedientes(): Promise<Expediente[]>;
  getExpedienteById(id: string): Promise<Expediente | undefined>;
  searchExpedientes(query: string): Promise<Expediente[]>;
  filterExpedientes(filters: {
    camara?: string;
    tipo?: string[];
    estado?: string[];
    bloque?: string[];
    provincia?: string[];
    hasOD?: boolean;
    inCommission?: boolean;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Expediente[]>;
  saveExpedientes(expedientes: Expediente[]): Promise<void>;
}

export class JSONStorage implements IStorage {
  async getAllExpedientes(): Promise<Expediente[]> {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      const expedientes: Expediente[] = JSON.parse(data);
      
      // Ordenar por fecha de ingreso descendente (más reciente primero)
      return expedientes.sort((a, b) => {
        const dateA = new Date(a.fecha_ingreso);
        const dateB = new Date(b.fecha_ingreso);
        // Si las fechas son iguales, ordenar por número de expediente descendente
        if (dateB.getTime() === dateA.getTime()) {
          const numA = parseInt(a.expediente.match(/^(\d+)/)?.[1] || '0');
          const numB = parseInt(b.expediente.match(/^(\d+)/)?.[1] || '0');
          return numB - numA;
        }
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error('[Storage] Error al leer expedientes:', error);
      return [];
    }
  }

  async getExpedienteById(id: string): Promise<Expediente | undefined> {
    const expedientes = await this.getAllExpedientes();
    return expedientes.find(exp => exp.id === id);
  }

  async searchExpedientes(query: string): Promise<Expediente[]> {
    const expedientes = await this.getAllExpedientes();
    const q = query.toLowerCase();
    
    return expedientes.filter(exp =>
      exp.expediente.toLowerCase().includes(q) ||
      exp.sumario.toLowerCase().includes(q) ||
      exp.autores.some(a => a.toLowerCase().includes(q))
    );
  }

  async filterExpedientes(filters: {
    camara?: string;
    tipo?: string[];
    estado?: string[];
    bloque?: string[];
    provincia?: string[];
    hasOD?: boolean;
    inCommission?: boolean;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Expediente[]> {
    let expedientes = await this.getAllExpedientes();

    if (filters.camara && filters.camara !== 'all') {
      expedientes = expedientes.filter(exp => exp.cámara === filters.camara);
    }

    if (filters.tipo && filters.tipo.length > 0) {
      expedientes = expedientes.filter(exp => filters.tipo!.includes(exp.tipo_expediente));
    }

    if (filters.estado && filters.estado.length > 0) {
      expedientes = expedientes.filter(exp => filters.estado!.includes(exp.estado));
    }

    if (filters.bloque && filters.bloque.length > 0) {
      expedientes = expedientes.filter(exp => 
        exp.bloque.some(b => filters.bloque!.includes(b))
      );
    }

    if (filters.provincia && filters.provincia.length > 0) {
      expedientes = expedientes.filter(exp =>
        exp.provincias.some(p => filters.provincia!.includes(p))
      );
    }

    if (filters.hasOD) {
      expedientes = expedientes.filter(exp => exp.OD_DIPUTADOS || exp.OD_SENADO);
    }

    if (filters.inCommission) {
      expedientes = expedientes.filter(exp =>
        exp.estado.toLowerCase().includes('comisión') ||
        (exp.derivaciones && exp.derivaciones.length > 0)
      );
    }

    if (filters.dateFrom) {
      expedientes = expedientes.filter(exp => {
        const expDate = new Date(exp.fecha_ingreso);
        const fromDate = new Date(filters.dateFrom!);
        return expDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      expedientes = expedientes.filter(exp => {
        const expDate = new Date(exp.fecha_ingreso);
        const toDate = new Date(filters.dateTo!);
        return expDate <= toDate;
      });
    }

    return expedientes;
  }

  async saveExpedientes(expedientes: Expediente[]): Promise<void> {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(expedientes, null, 2), 'utf-8');
      console.log('[Storage] Expedientes guardados correctamente');
    } catch (error) {
      console.error('[Storage] Error al guardar expedientes:', error);
      throw error;
    }
  }
}

export const storage = new JSONStorage();
