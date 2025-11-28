import { Layout } from "@/components/layout";
import { ExpedienteCard } from "@/components/expediente-card";
import { Filters } from "@/components/filters";
import { ExpedienteDetailModal } from "@/components/expediente-detail-modal";
import { ExpedienteFormModal } from "@/components/expediente-form-modal";
import { MovimientoFormModal } from "@/components/movimiento-form-modal";
import { 
  getExpedientes, updateExpedientes, deleteExpediente, 
  createBackup, exportJson, runCompleteExtraction,
  type Expediente 
} from "@/lib/data-service";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, SlidersHorizontal, Landmark, Download, FileSpreadsheet, 
  RefreshCw, ArrowUpDown, Plus, FileJson, Save, Zap
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function Home() {
  const [allData, setAllData] = useState<Expediente[]>([]);
  const [selectedChamber, setSelectedChamber] = useState<"Diputados" | "Senado" | "all">("Diputados");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredData, setFilteredData] = useState<Expediente[]>([]);
  const [displayData, setDisplayData] = useState<Expediente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest" | "number-desc" | "number-asc">("recent");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [movimientoModalOpen, setMovimientoModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expedienteToDelete, setExpedienteToDelete] = useState<Expediente | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getExpedientes();
      
      if (!data || data.length < 10) {
        console.log('[Auto-Scraping] No hay datos suficientes, extrayendo automáticamente...');
        toast.info('Extrayendo datos actualizados desde fuentes oficiales...');
        
        try {
          const result = await updateExpedientes();
          if (result.success) {
            toast.success(`${result.count} expedientes extraídos automáticamente`);
            const freshData = await getExpedientes();
            setAllData(freshData);
            setFilteredData(freshData);
          }
        } catch (error) {
          console.error('[Auto-Scraping] Error:', error);
          setAllData(data);
          setFilteredData(data);
        }
      } else {
        setAllData(data);
        setFilteredData(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar expedientes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateData = async () => {
    setIsUpdating(true);
    toast.info('Extrayendo datos desde fuentes oficiales...');
    try {
      const result = await updateExpedientes();
      if (result.success) {
        toast.success(`${result.count} expedientes extraídos desde API HCDN y Senado`);
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

  const handleCompleteExtraction = async () => {
    setIsUpdating(true);
    toast.info('Iniciando extracción completa con datos detallados... Esto puede tardar varios minutos.');
    try {
      const result = await runCompleteExtraction();
      if (result.success) {
        toast.success(`${result.count} expedientes extraídos con datos completos`);
        await loadData();
      } else {
        toast.error('Error en extracción completa');
      }
    } catch (error) {
      console.error('Error in complete extraction:', error);
      toast.error('Error en extracción completa');
    } finally {
      setIsUpdating(false);
    }
  };

  useMemo(() => {
    let result = filteredData;

    if (selectedChamber !== "all") {
      result = result.filter(item => item.cámara === selectedChamber);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const searchableText = [
          item.expediente,
          item.sumario,
          item.extracto || '',
          item.tipo_expediente,
          item.estado,
          ...item.autores,
          ...item.bloque,
          ...item.provincias,
          ...item.derivaciones.map(d => d.comision),
          ...(item.firmantes?.map(f => `${f.nombre} ${f.bloque || ''} ${f.distrito || ''}`) || [])
        ].join(' ').toLowerCase();
        
        const terms = q.split(/\s+/);
        return terms.every(term => searchableText.includes(term));
      });
    }

    const sorted = [...result];
    if (sortOrder === "recent") {
      sorted.sort((a, b) => new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime());
    } else if (sortOrder === "oldest") {
      sorted.sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime());
    } else if (sortOrder === "number-desc") {
      sorted.sort((a, b) => {
        const numA = parseInt(a.expediente.match(/^(\d+)/)?.[1] || '0');
        const numB = parseInt(b.expediente.match(/^(\d+)/)?.[1] || '0');
        return numB - numA;
      });
    } else if (sortOrder === "number-asc") {
      sorted.sort((a, b) => {
        const numA = parseInt(a.expediente.match(/^(\d+)/)?.[1] || '0');
        const numB = parseInt(b.expediente.match(/^(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    }

    setDisplayData(sorted);
    setCurrentPage(1);
  }, [selectedChamber, searchQuery, filteredData, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displayData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayData.length / itemsPerPage);

  const handleExportExcel = async () => {
    try {
      toast.info('Generando archivo Excel...');
      const response = await fetch('/pip/api/export/excel');
      
      if (!response.ok) {
        throw new Error('Error al exportar');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expedientes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel descargado correctamente');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Error al exportar Excel');
    }
  };

  const handleExportJson = async () => {
    try {
      toast.info('Descargando archivo JSON...');
      await exportJson();
      toast.success('JSON descargado correctamente');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      toast.error('Error al exportar JSON');
    }
  };

  const handleBackup = async () => {
    try {
      toast.info('Creando backup...');
      const result = await createBackup();
      if (result.success) {
        toast.success(`Backup creado: ${result.file}`);
      } else {
        toast.error('Error al crear backup');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Error al crear backup');
    }
  };

  const handleViewDetail = (expediente: Expediente) => {
    setSelectedExpediente(expediente);
    setDetailModalOpen(true);
  };

  const handleEdit = (expediente: Expediente) => {
    setSelectedExpediente(expediente);
    setFormMode('edit');
    setFormModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleCreate = () => {
    setSelectedExpediente(null);
    setFormMode('create');
    setFormModalOpen(true);
  };

  const handleDeleteClick = (expediente: Expediente) => {
    setExpedienteToDelete(expediente);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expedienteToDelete) return;
    
    try {
      const success = await deleteExpediente(expedienteToDelete.id);
      if (success) {
        toast.success('Expediente eliminado correctamente');
        await loadData();
      } else {
        toast.error('Error al eliminar expediente');
      }
    } catch (error) {
      console.error('Error deleting expediente:', error);
      toast.error('Error al eliminar expediente');
    } finally {
      setDeleteDialogOpen(false);
      setExpedienteToDelete(null);
    }
  };

  const handleAddMovimiento = (expediente: Expediente) => {
    setSelectedExpediente(expediente);
    setMovimientoModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleFormSuccess = async () => {
    await loadData();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Cargando expedientes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="hidden md:block w-64 shrink-0 space-y-6">
          <div className="bg-card rounded-lg border shadow-sm p-5 sticky top-24">
            <Filters data={allData} onFilterChange={setFilteredData} />
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
            
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <Tabs 
                value={selectedChamber} 
                onValueChange={(v) => setSelectedChamber(v as any)} 
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-2 sm:w-[300px]">
                  <TabsTrigger value="Diputados" className="flex gap-2">
                    <Landmark className="h-4 w-4" />
                    Diputados
                  </TabsTrigger>
                  <TabsTrigger value="Senado" className="flex gap-2">
                    <Landmark className="h-4 w-4" />
                    Senado
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                  <SelectTrigger className="w-full sm:w-[200px] h-9" data-testid="select-sort">
                    <SelectValue placeholder="Ordenar por..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Más recientes</SelectItem>
                    <SelectItem value="oldest">Más antiguos</SelectItem>
                    <SelectItem value="number-desc">Nº descendente</SelectItem>
                    <SelectItem value="number-asc">Nº ascendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por expte, autor, tema, comisión, bloque..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              <Button 
                variant="default"
                size="icon"
                onClick={handleCreate}
                title="Nuevo expediente"
                data-testid="button-create"
              >
                <Plus className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={isUpdating}
                    title="Actualizar datos"
                    data-testid="button-update"
                  >
                    <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleUpdateData}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualización rápida
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCompleteExtraction}>
                    <Zap className="mr-2 h-4 w-4" />
                    Extracción completa (detallada)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-export">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJson}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Exportar JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleBackup}>
                    <Save className="mr-2 h-4 w-4" />
                    Crear Backup
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden shrink-0" data-testid="button-filters">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
                  <div className="py-6">
                    <Filters data={allData} onFilterChange={setFilteredData} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              Expedientes Encontrados
              <Badge variant="secondary" className="ml-2 rounded-full px-2.5 text-xs" data-testid="badge-count">
                {displayData.length}
              </Badge>
            </h2>
          </div>

          {currentItems.length > 0 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {currentItems.map((item) => (
                  <ExpedienteCard 
                    key={item.id} 
                    expediente={item} 
                    onViewDetail={handleViewDetail}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>

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
              <p className="text-muted-foreground">No se encontraron expedientes con los filtros seleccionados.</p>
              <Button 
                variant="link" 
                onClick={() => {
                  setSelectedChamber("Diputados");
                  setSearchQuery("");
                  setFilteredData(allData);
                }}
                data-testid="button-clear"
              >
                Limpiar búsqueda
              </Button>
            </div>
          )}
        </div>
      </div>

      <ExpedienteDetailModal
        expediente={selectedExpediente}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onEdit={handleEdit}
        onAddMovimiento={handleAddMovimiento}
      />

      <ExpedienteFormModal
        expediente={selectedExpediente}
        mode={formMode}
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={handleFormSuccess}
      />

      <MovimientoFormModal
        expediente={selectedExpediente}
        open={movimientoModalOpen}
        onClose={() => setMovimientoModalOpen(false)}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Expediente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el expediente {expedienteToDelete?.expediente}? 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
