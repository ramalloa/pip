import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Expediente, enrichExpediente } from "@/lib/data-service";
import { 
  FileText, Users, Building2, CalendarDays, MapPin, 
  ExternalLink, Printer, RefreshCw, ClipboardList, 
  MessageSquare, History, Download
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExpedienteDetailModalProps {
  expediente: Expediente | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (expediente: Expediente) => void;
  onAddMovimiento?: (expediente: Expediente) => void;
}

export function ExpedienteDetailModal({ 
  expediente, 
  open, 
  onClose, 
  onEdit,
  onAddMovimiento 
}: ExpedienteDetailModalProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState<Expediente | null>(null);

  const data = enrichedData || expediente;

  if (!data) return null;

  const handleEnrich = async () => {
    if (!expediente) return;
    setIsEnriching(true);
    try {
      const enriched = await enrichExpediente(expediente.expediente);
      if (enriched) {
        setEnrichedData(enriched);
        toast.success('Datos actualizados desde fuente oficial');
      } else {
        toast.error('No se pudieron obtener datos adicionales');
      }
    } catch (error) {
      toast.error('Error al actualizar datos');
    } finally {
      setIsEnriching(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("aprobado")) return "bg-green-100 text-green-800 border-green-200";
    if (s.includes("rechazado")) return "bg-red-100 text-red-800 border-red-200";
    if (s.includes("archivado")) return "bg-gray-100 text-gray-800 border-gray-200";
    if (s.includes("comisión")) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const firmantes = data.firmantes || [];
  const tramites = data.tramites || [];
  const movimientos = data.movimientos_internos || [];
  const comisiones = data.derivaciones || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="font-mono text-sm">
                  {data.expediente}
                </Badge>
                <Badge className={getStatusColor(data.estado)}>
                  {data.estado}
                </Badge>
              </div>
              <DialogTitle className="text-lg font-medium leading-snug">
                {data.tipo_expediente}
              </DialogTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnrich}
                disabled={isEnriching}
                data-testid="button-enrich"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isEnriching ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                data-testid="button-print"
              >
                <Printer className="h-4 w-4 mr-1" />
                Imprimir
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Sumario / Extracto
              </h4>
              <p className="text-sm leading-relaxed">
                {data.extracto || data.sumario}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground text-xs">Fecha Ingreso</div>
                  <div className="font-medium">
                    {new Date(data.fecha_ingreso).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground text-xs">Cámara</div>
                  <div className="font-medium">{data.cámara}</div>
                </div>
              </div>
              {data.tramite_parlamentario && (
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Trámite Parlamentario</div>
                    <div className="font-medium">{data.tramite_parlamentario}</div>
                  </div>
                </div>
              )}
              {(data.OD_DIPUTADOS || data.OD_SENADO) && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Orden del Día</div>
                    <div className="font-medium">{data.OD_DIPUTADOS || data.OD_SENADO}</div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <Tabs defaultValue="firmantes" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="firmantes" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Firmantes ({firmantes.length || data.autores.length})
                </TabsTrigger>
                <TabsTrigger value="comisiones" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  Comisiones ({comisiones.length})
                </TabsTrigger>
                <TabsTrigger value="tramites" className="text-xs">
                  <History className="h-3 w-3 mr-1" />
                  Trámites ({tramites.length})
                </TabsTrigger>
                <TabsTrigger value="movimientos" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Movimientos ({movimientos.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="firmantes" className="mt-4">
                {firmantes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Distrito</TableHead>
                        <TableHead>Bloque</TableHead>
                        <TableHead>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {firmantes.map((f, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{f.nombre}</TableCell>
                          <TableCell>{f.distrito || '-'}</TableCell>
                          <TableCell>{f.bloque || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={f.tipo === 'autor' ? 'default' : 'secondary'} className="text-xs">
                              {f.tipo || 'cofirmante'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">Autores registrados:</p>
                    {data.autores.map((autor, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{autor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comisiones" className="mt-4">
                {comisiones.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Comisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comisiones.map((c, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{c.comision}</TableCell>
                          <TableCell>
                            {c.fecha ? new Date(c.fecha).toLocaleDateString('es-AR') : '-'}
                          </TableCell>
                          <TableCell>{c.estado || 'Giro'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay información de comisiones registrada
                  </p>
                )}
              </TabsContent>

              <TabsContent value="tramites" className="mt-4">
                {tramites.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cámara</TableHead>
                        <TableHead>Movimiento</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tramites.map((t, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{t.camara || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={t.movimiento}>
                            {t.movimiento}
                          </TableCell>
                          <TableCell>{t.fecha || '-'}</TableCell>
                          <TableCell>{t.resultado || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay trámites registrados. Haga clic en "Actualizar" para obtener datos de la fuente oficial.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="movimientos" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-medium">Movimientos Internos (Sec. Rel. Parlamentarias)</h4>
                  {onAddMovimiento && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onAddMovimiento(data)}
                      data-testid="button-add-movimiento"
                    >
                      + Agregar Movimiento
                    </Button>
                  )}
                </div>
                {movimientos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Emisor</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Novedad</TableHead>
                        <TableHead>Realizado Por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos.map((m, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{new Date(m.fecha).toLocaleDateString('es-AR')}</TableCell>
                          <TableCell>{m.emisor}</TableCell>
                          <TableCell>{m.destino}</TableCell>
                          <TableCell className="max-w-xs truncate" title={m.novedad}>
                            {m.novedad}
                          </TableCell>
                          <TableCell>{m.realizadoPor || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay movimientos internos registrados
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 flex justify-between">
          <div className="flex gap-2">
            {data.Link_EXPTE && (
              <Button variant="outline" size="sm" asChild data-testid="button-view-original">
                <a href={data.Link_EXPTE} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver en HCDN
                </a>
              </Button>
            )}
            {data.Link_OD && (
              <Button variant="outline" size="sm" asChild data-testid="button-view-od">
                <a href={data.Link_OD} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1" />
                  Descargar OD
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="secondary" size="sm" onClick={() => onEdit(data)} data-testid="button-edit">
                Editar
              </Button>
            )}
            <Button variant="default" size="sm" onClick={onClose} data-testid="button-close">
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
