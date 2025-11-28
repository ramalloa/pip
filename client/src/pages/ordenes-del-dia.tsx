import { Layout } from "@/components/layout";
import { OrdenDiaCard } from "@/components/orden-dia-card";
import { getOrdenesDia, updateOrdenesDia } from "@/lib/ordenes-service";
import type { OrdenDelDia } from "@shared/schema";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileCheck, Download, FileSpreadsheet, RefreshCw, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function OrdenesDia() {
  const [allData, setAllData] = useState<OrdenDelDia[]>([]);
  const [selectedChamber, setSelectedChamber] = useState<"Diputados" | "Senado" | "all">("all");
  const [selectedEstado, setSelectedEstado] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [displayData, setDisplayData] = useState<OrdenDelDia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getOrdenesDia();
      // Los datos ya vienen ordenados del backend (más reciente primero)
      setAllData(data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar órdenes del día');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateData = async () => {
    setIsUpdating(true);
    toast.info('Actualizando órdenes del día desde APIs oficiales...');
    try {
      const result = await updateOrdenesDia();
      if (result.success) {
        toast.success(`✓ ${result.count} Órdenes del Día actualizadas correctamente`);
        await loadData();
      } else {
        toast.error('Error al actualizar datos');
      }
    } catch (error) {
      console.error('Error updating data:', error);
      toast.error('Error al actualizar datos');
    } finally {
      setIsUpdating(false);
    }
  };

  // Obtener estados únicos
  const estadosUnicos = useMemo(() => {
    const estados = new Set<string>();
    allData.forEach(od => {
      if (od.estado) estados.add(od.estado);
    });
    return Array.from(estados).sort();
  }, [allData]);

  // Aplicar filtros
  useMemo(() => {
    let result = allData;

    // Filtro por cámara
    if (selectedChamber !== "all") {
      result = result.filter(item => item.camara === selectedChamber);
    }

    // Filtro por estado
    if (selectedEstado !== "all") {
      if (selectedEstado === "Pendientes") {
        result = result.filter(item => 
          item.estado.toUpperCase().includes('PENDIENTE')
        );
      } else if (selectedEstado === "Aprobados") {
        result = result.filter(item => 
          item.estado.toUpperCase().includes('APROBADO')
        );
      } else if (selectedEstado === "Dictámenes") {
        result = result.filter(item => 
          item.estado.toLowerCase().includes('dictamen')
        );
      } else {
        result = result.filter(item => item.estado === selectedEstado);
      }
    }

    // Búsqueda
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const searchableText = [
          item.numero_od,
          item.extracto,
          item.comision,
          ...item.expedientes,
          ...item.autores,
          ...item.bloque
        ].join(' ').toLowerCase();
        
        const terms = q.split(/\s+/);
        return terms.every(term => searchableText.includes(term));
      });
    }

    setDisplayData(result);
    setCurrentPage(1);
  }, [selectedChamber, selectedEstado, searchQuery, allData]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displayData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayData.length / itemsPerPage);

  // Estadísticas
  const stats = useMemo(() => ({
    total: allData.length,
    diputados: allData.filter(e => e.camara === 'Diputados').length,
    senado: allData.filter(e => e.camara === 'Senado').length,
    pendientes: allData.filter(e => e.estado.toUpperCase().includes('PENDIENTE') || e.estado === 'Presentado').length,
    aprobados: allData.filter(e => e.estado.toUpperCase().includes('APROBADO') || e.estado.toUpperCase().includes('LEY')).length
  }), [allData]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Cargando órdenes del día...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <FileCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Órdenes del Día</h1>
              <p className="text-muted-foreground">
                Seguimiento de órdenes del día de ambas cámaras legislativas (2024-2025)
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold">{stats.diputados}</div>
              <div className="text-xs text-muted-foreground">Diputados</div>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold">{stats.senado}</div>
              <div className="text-xs text-muted-foreground">Senado</div>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{stats.aprobados}</div>
              <div className="text-xs text-muted-foreground">Aprobados</div>
            </div>
            <div className="bg-card border rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{stats.pendientes}</div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card p-4 rounded-lg border shadow-sm space-y-4">
          {/* Chamber Selector */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Tabs 
              value={selectedChamber} 
              onValueChange={(v) => setSelectedChamber(v as any)} 
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-3 sm:w-[400px]">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="Diputados">Diputados</TabsTrigger>
                <TabsTrigger value="Senado">Senado</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleUpdateData}
                disabled={isUpdating}
                title="Actualizar desde APIs oficiales"
                data-testid="button-update"
              >
                <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Estado Filter & Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedEstado} onValueChange={setSelectedEstado}>
              <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-estado">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="Pendientes">⏳ Pendientes</SelectItem>
                <SelectItem value="Aprobados">✅ Aprobados</SelectItem>
                <SelectItem value="Dictámenes">📋 Con Dictamen</SelectItem>
                {estadosUnicos.map(estado => (
                  <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número OD, expediente, autor, tema..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            Resultados
            <Badge variant="secondary" className="ml-2 rounded-full px-2.5 text-xs" data-testid="badge-count">
              {displayData.length}
            </Badge>
          </h2>
        </div>

        {/* Grid */}
        {currentItems.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {currentItems.map((item) => (
                <OrdenDiaCard key={item.id} ordenDia={item} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {currentPage > 2 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
                    </PaginationItem>
                  )}

                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p >= currentPage - 1 && p <= currentPage + 1)
                    .map(page => (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          isActive={page === currentPage}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                  {currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {currentPage < totalPages - 1 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => setCurrentPage(totalPages)}>{totalPages}</PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-muted-foreground">No se encontraron órdenes del día con los filtros seleccionados.</p>
            <Button 
              variant="link" 
              onClick={() => {
                setSelectedChamber("all");
                setSelectedEstado("all");
                setSearchQuery("");
              }}
              data-testid="button-clear"
            >
              Limpiar búsqueda
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
