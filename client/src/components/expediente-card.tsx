import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { type Expediente } from "@/lib/data-service";
import { CalendarDays, FileText, Users, Building2, MapPin, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExpedienteCardProps {
  expediente: Expediente;
  onViewDetail?: (expediente: Expediente) => void;
  onEdit?: (expediente: Expediente) => void;
  onDelete?: (expediente: Expediente) => void;
}

export function ExpedienteCard({ expediente, onViewDetail, onEdit, onDelete }: ExpedienteCardProps) {
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("aprobado")) return "bg-green-100 text-green-800 hover:bg-green-200 border-green-200";
    if (s.includes("rechazado")) return "bg-red-100 text-red-800 hover:bg-red-200 border-red-200";
    if (s.includes("archivado")) return "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200";
    if (s.includes("comisión")) return "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200";
    if (s.includes("parcial")) return "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200";
    if (s.includes("total")) return "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200";
    return "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200";
  };

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("informe")) return "text-blue-600 bg-blue-50 border-blue-100";
    if (t.includes("solicitud")) return "text-purple-600 bg-purple-50 border-purple-100";
    if (t.includes("comunicación")) return "text-teal-600 bg-teal-50 border-teal-100";
    if (t.includes("resolución")) return "text-orange-600 bg-orange-50 border-orange-100";
    if (t.includes("declaración")) return "text-pink-600 bg-pink-50 border-pink-100";
    return "text-gray-600 bg-gray-50 border-gray-100";
  };

  const firmantes = expediente.firmantes || [];
  const hasDetailedInfo = firmantes.length > 0 || (expediente.tramites && expediente.tramites.length > 0);

  const autoresDisplay = firmantes.length > 0 
    ? firmantes[0].nombre 
    : (expediente.autores.length > 0 && expediente.autores[0] !== "Legislador Nacional" 
        ? expediente.autores[0] 
        : null);

  const bloqueDisplay = firmantes.length > 0 && firmantes[0].bloque
    ? firmantes[0].bloque
    : (expediente.bloque && expediente.bloque[0] !== 'BLOQUE PARLAMENTARIO' 
        ? expediente.bloque[0] 
        : null);

  const provinciaDisplay = firmantes.length > 0 && firmantes[0].distrito
    ? firmantes[0].distrito
    : (expediente.provincias && expediente.provincias[0] !== 'CABA' 
        ? expediente.provincias[0] 
        : null);

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className="font-mono text-xs bg-background hover:bg-primary/5 cursor-pointer transition-colors"
                onClick={() => onViewDetail?.(expediente)}
                data-testid={`badge-exp-${expediente.expediente}`}
              >
                {expediente.expediente}
              </Badge>
              <Badge variant="secondary" className={`text-[10px] border ${getTypeColor(expediente.tipo_expediente)}`}>
                {expediente.tipo_expediente}
              </Badge>
              {hasDetailedInfo && (
                <Badge variant="outline" className="text-[9px] bg-green-50 text-green-600 border-green-200">
                  Datos completos
                </Badge>
              )}
            </div>
          </div>
          <Badge className={`capitalize whitespace-nowrap border shadow-none ${getStatusColor(expediente.estado)}`}>
            {expediente.estado}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 pb-3">
        <h3 className="font-serif font-medium text-base leading-snug text-foreground/90 line-clamp-3 mb-3 group-hover:text-primary transition-colors">
          {expediente.extracto || expediente.sumario}
        </h3>
        
        <div className="space-y-2 text-xs text-muted-foreground mt-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 opacity-70" />
              <span className="truncate max-w-[140px]" title={autoresDisplay || 'Sin autor registrado'}>
                {autoresDisplay 
                  ? `${autoresDisplay}${(firmantes.length > 1 || expediente.autores.length > 1) ? ` +${Math.max(firmantes.length, expediente.autores.length) - 1}` : ''}` 
                  : 'Sin autor registrado'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 opacity-70" />
              <span>{new Date(expediente.fecha_ingreso).toLocaleDateString('es-AR')}</span>
            </div>
            
            {(expediente.TP || expediente.tramite_parlamentario) && (
              <div className="flex items-center gap-1.5 col-span-2">
                <FileText className="h-3.5 w-3.5 opacity-70" />
                <span className="font-medium text-primary">
                  {expediente.tramite_parlamentario || expediente.TP}
                </span>
              </div>
            )}
            
            {bloqueDisplay && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 opacity-70" />
                <span className="truncate max-w-[140px]" title={bloqueDisplay}>
                  {bloqueDisplay}
                </span>
              </div>
            )}
            
            {provinciaDisplay && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 opacity-70" />
                <span className="truncate max-w-[140px]" title={provinciaDisplay}>
                  {provinciaDisplay}
                </span>
              </div>
            )}
          </div>
          
          {(expediente.OD_DIPUTADOS || expediente.OD_SENADO) && (
            <div className="pt-2 border-t border-border/50">
              <span className="font-medium text-primary">
                OD: {expediente.OD_DIPUTADOS || expediente.OD_SENADO}
              </span>
            </div>
          )}
          
          {expediente.derivaciones && expediente.derivaciones.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="font-medium mb-1">Comisiones:</div>
              {expediente.derivaciones.slice(0, 2).map((der, idx) => (
                <div key={idx} className="pl-2 text-[11px]">
                  • {der.comision} 
                  {der.fecha && ` (${new Date(der.fecha).toLocaleDateString('es-AR')})`}
                </div>
              ))}
              {expediente.derivaciones.length > 2 && (
                <div className="pl-2 text-[11px] text-muted-foreground/70">
                  +{expediente.derivaciones.length - 2} más
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-4 py-3 bg-muted/20 border-t flex justify-between items-center">
        <div className="flex gap-1">
          {onEdit && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs text-muted-foreground hover:text-primary" 
              onClick={() => onEdit(expediente)}
              data-testid={`button-edit-${expediente.expediente}`}
            >
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
          )}
          {onDelete && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive" 
              onClick={() => onDelete(expediente)}
              data-testid={`button-delete-${expediente.expediente}`}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs border-primary/20 hover:bg-primary/5 text-primary" 
          onClick={() => onViewDetail?.(expediente)}
          data-testid={`button-detail-${expediente.expediente}`}
        >
          <Eye className="h-3 w-3 mr-1.5" />
          Ver Detalle
        </Button>
      </CardFooter>
    </Card>
  );
}
