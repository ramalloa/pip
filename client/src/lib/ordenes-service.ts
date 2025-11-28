import type { OrdenDelDia } from "@shared/schema";

const API_BASE = '/pip';

export async function getOrdenesDia(): Promise<OrdenDelDia[]> {
  const response = await fetch(`${API_BASE}/api/ordenes-dia`);
  if (!response.ok) {
    throw new Error('Error al cargar órdenes del día');
  }
  return response.json();
}

export async function updateOrdenesDia(): Promise<{ success: boolean; count: number; message: string }> {
  const response = await fetch(`${API_BASE}/api/ordenes-dia/scrape`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Error al actualizar órdenes del día');
  }
  return response.json();
}
