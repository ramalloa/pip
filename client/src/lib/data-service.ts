const API_BASE = import.meta.env.PROD ? '/pip' : '';

export interface Firmante {
  nombre: string;
  distrito?: string;
  bloque?: string;
  tipo?: 'autor' | 'coautor';
}

export interface Tramite {
  fecha: string;
  camara?: string;
  movimiento: string;
  resultado?: string;
}

export interface MovimientoInterno {
  id: string;
  fecha: string;
  emisor: string;
  destino: string;
  novedad: string;
  comprobantes?: string[];
  realizadoPor?: string;
}

export interface Expediente {
  id: string;
  expediente: string;
  tipo_expediente: string;
  cámara: "Diputados" | "Senado";
  estado: string;
  fecha_ingreso: string;
  autores: string[];
  bloque: string[];
  provincias: string[];
  OD_DIPUTADOS?: string;
  OD_SENADO?: string;
  Fecha_OD?: string;
  Link_OD?: string;
  Link_EXPTE?: string;
  TP?: string;
  derivaciones: {
    comision: string;
    fecha: string;
    estado: string;
  }[];
  sumario: string;
  extracto?: string;
  firmantes?: Firmante[];
  tramites?: Tramite[];
  dictamenes?: {
    tipo: string;
    fecha: string;
    descripcion?: string;
  }[];
  tramite_parlamentario?: string;
  movimientos_internos?: MovimientoInterno[];
}

export const getExpedientes = async (): Promise<Expediente[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes`);
    if (!response.ok) {
      throw new Error('Error al obtener expedientes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching expedientes:', error);
    return [];
  }
};

export const getExpedienteById = async (id: string): Promise<Expediente | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/${encodeURIComponent(id)}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching expediente:', error);
    return null;
  }
};

export const searchExpedientes = async (query: string): Promise<Expediente[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Error en búsqueda');
    }
    return await response.json();
  } catch (error) {
    console.error('Error searching expedientes:', error);
    return [];
  }
};

export const filterExpedientes = async (filters: any): Promise<Expediente[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/filter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });
    if (!response.ok) {
      throw new Error('Error al filtrar');
    }
    return await response.json();
  } catch (error) {
    console.error('Error filtering expedientes:', error);
    return [];
  }
};

export const updateExpedientes = async (): Promise<{ success: boolean; count: number; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/scrape`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Error al actualizar datos');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating expedientes:', error);
    return { success: false, count: 0, message: 'Error al actualizar' };
  }
};

export const createExpediente = async (expediente: Partial<Expediente>): Promise<Expediente | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expediente),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al crear expediente');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating expediente:', error);
    return null;
  }
};

export const updateExpediente = async (id: string, updates: Partial<Expediente>): Promise<Expediente | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Error al actualizar expediente');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating expediente:', error);
    return null;
  }
};

export const deleteExpediente = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Error al eliminar expediente');
    }
    return true;
  } catch (error) {
    console.error('Error deleting expediente:', error);
    return false;
  }
};

export const addMovimiento = async (
  expedienteId: string, 
  movimiento: Omit<MovimientoInterno, 'id'>
): Promise<MovimientoInterno | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/${encodeURIComponent(expedienteId)}/movimientos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(movimiento),
    });
    if (!response.ok) {
      throw new Error('Error al agregar movimiento');
    }
    return await response.json();
  } catch (error) {
    console.error('Error adding movimiento:', error);
    return null;
  }
};

export const enrichExpediente = async (id: string): Promise<Expediente | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/expedientes/${encodeURIComponent(id)}/enrich`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Error al enriquecer expediente');
    }
    return await response.json();
  } catch (error) {
    console.error('Error enriching expediente:', error);
    return null;
  }
};

export const runCompleteExtraction = async (): Promise<{ success: boolean; count: number; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/scrape/complete`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Error en extracción completa');
    }
    return await response.json();
  } catch (error) {
    console.error('Error in complete extraction:', error);
    return { success: false, count: 0, message: 'Error en extracción' };
  }
};

export const createBackup = async (): Promise<{ success: boolean; file?: string; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/backup`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Error al crear backup');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating backup:', error);
    return { success: false, message: 'Error al crear backup' };
  }
};

export const getBackups = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/backups`);
    if (!response.ok) {
      throw new Error('Error al obtener backups');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching backups:', error);
    return [];
  }
};

export const restoreBackup = async (filename: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/restore/${encodeURIComponent(filename)}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Error al restaurar backup');
    }
    return await response.json();
  } catch (error) {
    console.error('Error restoring backup:', error);
    return { success: false, message: 'Error al restaurar' };
  }
};

export const exportJson = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/api/export/json`);
    if (!response.ok) {
      throw new Error('Error al exportar JSON');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expedientes_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting JSON:', error);
    throw error;
  }
};

export const getBloques = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/bloques`);
    if (!response.ok) {
      throw new Error('Error al obtener bloques');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching bloques:', error);
    return [];
  }
};

export const getProvincias = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/provincias`);
    if (!response.ok) {
      throw new Error('Error al obtener provincias');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching provincias:', error);
    return [];
  }
};

export const DATA: Expediente[] = [];
