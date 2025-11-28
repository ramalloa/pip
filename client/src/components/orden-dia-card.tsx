import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrdenDelDia } from "@shared/schema";
import { CalendarDays, FileText, Link as LinkIcon, Users, Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrdenDiaCardProps {
  ordenDia: OrdenDelDia;
}

export function OrdenDiaCard({ ordenDia }: OrdenDiaCardProps) {
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("pendiente")) return "bg-red-50 text-red-700 border-red-200 font-semibold";
    if (s.includes("aprobado")) return "bg-green-50 text-green-700 border-green-200";
    if (s.includes("rechazado")) return "bg-gray-50 text-gray-700 border-gray-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-border/60">
      <CardHeader className="pb-3 pt-4 px-4 bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            {/* Número de OD prominente */}
            <div className="flex items-center gap-2 flex-wrap">
              {ordenDia.link_pdf ? (
                <a 
                  href={ordenDia.link_pdf} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-testid={`link-od-${ordenDia.numero_od}`}
                  className="inline-block"
                >
                  <Badge variant="outline" className="font-mono text-base font-bold bg-primary/10 text-primary border-primary px-3 py-1 hover:bg-primary/20 cursor-pointer transition-colors">
                    {ordenDia.numero_od}
                  </Badge>
                </a>
              ) : (
                <Badge variant="outline" className="font-mono text-base font-bold bg-primary/10 text-primary border-primary px-3 py-1">
                  {ordenDia.numero_od}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {ordenDia.camara}
              </Badge>
            </div>

            {/* Fecha y Comisión */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{new Date(ordenDia.fecha_od).toLocaleDateString('es-AR')}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-medium">{ordenDia.comision}</span>
              </div>
            </div>

            {/* Estado */}
            <Badge className={`capitalize whitespace-nowrap border shadow-sm ${getStatusColor(ordenDia.estado)}`}>
              {ordenDia.estado}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 pb-4 pt-3 space-y-3">
        {/* Expedientes relacionados */}
        {ordenDia.expedientes.length > 0 && (
          <div className="bg-background/50 p-3 rounded-md border">
            <div className="flex items-start gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-medium text-foreground/70 mb-1.5">
                  Expedientes relacionados ({ordenDia.expedientes.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ordenDia.expedientes.map((exp, idx) => {
                    const isSenadoExp = exp.includes('-S-') || exp.includes('S-') || ordenDia.camara === 'Senado';
                    let href = '';
                    
                    if (isSenadoExp) {
                      const match = exp.match(/(\d+)-S-(\d{4})/i) || exp.match(/S-(\d+)\/(\d{4})/i);
                      if (match) {
                        const num = match[1];
                        const year = match[2].slice(-2);
                        href = `https://www.senado.gob.ar/parlamentario/comisiones/verExp/${num}.${year}/S/PE`;
                      } else {
                        href = `https://www.senado.gob.ar/parlamentario/parlamentaria/`;
                      }
                    } else {
                      href = `https://www.hcdn.gob.ar/proyectos/proyectoTP.jsp?exp=${exp}`;
                    }
                    
                    return (
                      <a 
                        key={idx}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-od-exp-${exp}`}
                        className="inline-block"
                      >
                        <Badge 
                          variant="outline" 
                          className="font-mono text-[10px] bg-background hover:bg-primary/5 cursor-pointer transition-colors"
                        >
                          {exp}
                        </Badge>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extracto */}
        <div>
          <h3 className="font-serif text-sm leading-snug text-foreground/90 line-clamp-4">
            {ordenDia.extracto}
          </h3>
        </div>

        {/* Autores y Bloque */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 opacity-70 flex-shrink-0" />
            <span className="truncate" title={ordenDia.autores.join(", ")}>
              {ordenDia.autores.length > 0 && ordenDia.autores[0] !== "Diputado Nacional" 
                ? `${ordenDia.autores[0]}${ordenDia.autores.length > 1 ? ` +${ordenDia.autores.length - 1}` : ''}` 
                : 'Sin autor registrado'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 opacity-70 flex-shrink-0" />
            <span className="truncate" title={ordenDia.bloque.join(", ")}>
              {ordenDia.bloque.join(", ")}
            </span>
          </div>
        </div>

        {/* Ministerio (solo Senado) */}
        {ordenDia.ministerio && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 opacity-70" />
            <span className="font-medium">Ministerio:</span>
            <span>{ordenDia.ministerio}</span>
          </div>
        )}

        {/* Observaciones */}
        {ordenDia.observaciones && (
          <div className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded">
            {ordenDia.observaciones}
          </div>
        )}

        {/* Link PDF */}
        {ordenDia.link_pdf && (
          <div className="pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs w-full border-primary/20 hover:bg-primary/5 text-primary" 
              asChild
            >
              <a href={ordenDia.link_pdf} target="_blank" rel="noopener noreferrer">
                <LinkIcon className="h-3 w-3 mr-1.5" />
                Ver Orden del Día (PDF)
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
