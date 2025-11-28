import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Expediente, getBloques, getProvincias } from "@/lib/data-service";
import { FilterX, CalendarIcon, Building2, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FiltersProps {
  data: Expediente[];
  onFilterChange: (filtered: Expediente[]) => void;
}

export function Filters({ data, onFilterChange }: FiltersProps) {
  const [bloquesList, setBloquesList] = useState<string[]>([]);
  const [provinciasList, setProvinciasList] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({
    tipo: new Set<string>(),
    bloque: new Set<string>(),
    provincia: new Set<string>(),
    pedidosInformes: false,
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
  });

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [bloques, provincias] = await Promise.all([
          getBloques(),
          getProvincias()
        ]);
        setBloquesList(bloques);
        setProvinciasList(provincias);
      } catch (error) {
        console.error('Error loading filter options:', error);
        const extractedBloques = new Set<string>();
        const extractedProvincias = new Set<string>();
        
        data.forEach(item => {
          if (item.bloque) {
            item.bloque.forEach(b => {
              if (b && b !== 'BLOQUE PARLAMENTARIO') extractedBloques.add(b);
            });
          }
          if (item.firmantes) {
            item.firmantes.forEach(f => {
              if (f.bloque) extractedBloques.add(f.bloque);
              if (f.distrito) extractedProvincias.add(f.distrito);
            });
          }
          if (item.provincias) {
            item.provincias.forEach(p => {
              if (p && p !== 'CABA') extractedProvincias.add(p);
            });
          }
        });
        
        setBloquesList(Array.from(extractedBloques).sort());
        setProvinciasList(Array.from(extractedProvincias).sort());
      }
    };
    
    loadFilterOptions();
  }, [data]);

  const getUnique = (key: keyof Expediente | 'bloque' | 'provincias') => {
    const values = new Set<string>();
    data.forEach(item => {
      if (Array.isArray(item[key])) {
        (item[key] as string[]).forEach(v => values.add(v));
      } else {
        values.add(String(item[key as keyof Expediente]));
      }
    });
    return Array.from(values).sort();
  };

  const types = getUnique('tipo_expediente');

  const toggleFilter = (category: 'tipo' | 'bloque' | 'provincia', value: string) => {
    setFilters(prev => {
      const newSet = new Set(prev[category]);
      if (newSet.has(value)) newSet.delete(value);
      else newSet.add(value);
      return { ...prev, [category]: newSet };
    });
  };

  const setDateFrom = (date: Date | undefined) => {
    setFilters(prev => ({ ...prev, dateFrom: date }));
  };

  const setDateTo = (date: Date | undefined) => {
    setFilters(prev => ({ ...prev, dateTo: date }));
  };

  const togglePedidosInformes = () => {
    setFilters(prev => ({ ...prev, pedidosInformes: !prev.pedidosInformes }));
  };

  const clearFilters = () => {
    setFilters({
      tipo: new Set(),
      bloque: new Set(),
      provincia: new Set(),
      pedidosInformes: false,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  useEffect(() => {
    const filtered = data.filter(item => {
      if (filters.tipo.size > 0 && !filters.tipo.has(item.tipo_expediente)) return false;
      
      if (filters.pedidosInformes) {
        const sumarioLower = (item.sumario || '').toLowerCase();
        const tipoLower = (item.tipo_expediente || '').toLowerCase();
        if (!sumarioLower.includes('pedido de informe') && !tipoLower.includes('pedido de informe')) {
          return false;
        }
      }
      
      if (filters.bloque.size > 0) {
        const itemBloques = new Set<string>();
        if (item.bloque) {
          item.bloque.forEach(b => itemBloques.add(b));
        }
        if (item.firmantes) {
          item.firmantes.forEach(f => {
            if (f.bloque) itemBloques.add(f.bloque);
          });
        }
        
        let hasMatchingBloque = false;
        filters.bloque.forEach(fb => {
          if (itemBloques.has(fb)) hasMatchingBloque = true;
        });
        if (!hasMatchingBloque) return false;
      }
      
      if (filters.provincia.size > 0) {
        const itemProvincias = new Set<string>();
        if (item.provincias) {
          item.provincias.forEach(p => itemProvincias.add(p));
        }
        if (item.firmantes) {
          item.firmantes.forEach(f => {
            if (f.distrito) itemProvincias.add(f.distrito);
          });
        }
        
        let hasMatchingProvincia = false;
        filters.provincia.forEach(fp => {
          if (itemProvincias.has(fp)) hasMatchingProvincia = true;
        });
        if (!hasMatchingProvincia) return false;
      }
      
      if (filters.dateFrom) {
        const itemDateStr = item.fecha_ingreso;
        const fromDateStr = filters.dateFrom.toISOString().split('T')[0];
        if (itemDateStr < fromDateStr) return false;
      }
      
      if (filters.dateTo) {
        const itemDateStr = item.fecha_ingreso;
        const toDateStr = filters.dateTo.toISOString().split('T')[0];
        if (itemDateStr > toDateStr) return false;
      }
      
      return true;
    });
    onFilterChange(filtered);
  }, [filters, data]);

  const FilterSection = ({ title, items, category, icon }: { 
    title: string, 
    items: string[], 
    category: 'tipo' | 'bloque' | 'provincia',
    icon?: React.ReactNode 
  }) => (
    <div className="space-y-3">
      <h4 className="text-sm font-medium leading-none text-foreground/80 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <ScrollArea className="h-[120px] pr-3">
        <div className="space-y-2">
          {items.length > 0 ? items.map(item => (
            <div key={item} className="flex items-center space-x-2">
              <Checkbox 
                id={`${category}-${item}`} 
                checked={filters[category].has(item)}
                onCheckedChange={() => toggleFilter(category, item)}
                data-testid={`checkbox-${category}-${item}`}
              />
              <Label 
                htmlFor={`${category}-${item}`}
                className="text-xs font-normal text-muted-foreground cursor-pointer leading-tight"
              >
                {item}
              </Label>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground">Sin opciones disponibles</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const activeFilterCount = filters.tipo.size + filters.bloque.size + filters.provincia.size + 
    (filters.pedidosInformes ? 1 : 0) + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filtros</h3>
        {activeFilterCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
            data-testid="button-clear-filters"
          >
            <FilterX className="h-3.5 w-3.5 mr-1" />
            Limpiar ({activeFilterCount})
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium leading-none text-foreground/80">Especial</h4>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="filter-pedidos" 
            checked={filters.pedidosInformes}
            onCheckedChange={togglePedidosInformes}
            data-testid="checkbox-filter-pedidos"
          />
          <Label htmlFor="filter-pedidos" className="text-sm font-normal">Solo Pedidos de Informes</Label>
        </div>
      </div>

      <Separator />
      
      <div className="space-y-3">
        <h4 className="text-sm font-medium leading-none text-foreground/80">Fecha de Ingreso</h4>
        <div className="grid gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-8 text-xs",
                  !filters.dateFrom && "text-muted-foreground"
                )}
                data-testid="button-date-from"
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {filters.dateFrom ? format(filters.dateFrom, "PPP", { locale: es }) : <span>Desde</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-8 text-xs",
                  !filters.dateTo && "text-muted-foreground"
                )}
                data-testid="button-date-to"
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {filters.dateTo ? format(filters.dateTo, "PPP", { locale: es }) : <span>Hasta</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Separator />
      <FilterSection title="Tipo de Expediente" items={types} category="tipo" />

      <Separator />
      <FilterSection 
        title="Bloque Político" 
        items={bloquesList} 
        category="bloque" 
        icon={<Building2 className="h-3.5 w-3.5" />}
      />

      <Separator />
      <FilterSection 
        title="Provincia / Distrito" 
        items={provinciasList} 
        category="provincia" 
        icon={<MapPin className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
