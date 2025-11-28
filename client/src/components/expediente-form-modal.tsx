import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Expediente, createExpediente, updateExpediente } from "@/lib/data-service";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ExpedienteFormModalProps {
  expediente: Expediente | null;
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TIPOS_EXPEDIENTE = [
  'PEDIDO DE INFORMES',
  'Proyecto de LEY',
  'Proyecto de RESOLUCIÓN',
  'Proyecto de COMUNICACIÓN',
  'Proyecto de DECLARACIÓN'
];

const ESTADOS = [
  'Presentado',
  'En Comisión',
  'Dictamen Parcial',
  'Dictamen Total',
  'Aprobado',
  'Rechazado',
  'Archivado'
];

export function ExpedienteFormModal({ 
  expediente, 
  mode,
  open, 
  onClose,
  onSuccess 
}: ExpedienteFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    expediente: '',
    tipo_expediente: 'PEDIDO DE INFORMES',
    cámara: 'Diputados' as 'Diputados' | 'Senado',
    estado: 'Presentado',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    sumario: '',
    autores: '',
    tramite_parlamentario: '',
    OD_DIPUTADOS: '',
    OD_SENADO: ''
  });

  useEffect(() => {
    if (expediente && mode === 'edit') {
      setFormData({
        expediente: expediente.expediente,
        tipo_expediente: expediente.tipo_expediente,
        cámara: expediente.cámara,
        estado: expediente.estado,
        fecha_ingreso: expediente.fecha_ingreso,
        sumario: expediente.sumario,
        autores: expediente.autores.join(', '),
        tramite_parlamentario: expediente.tramite_parlamentario || '',
        OD_DIPUTADOS: expediente.OD_DIPUTADOS || '',
        OD_SENADO: expediente.OD_SENADO || ''
      });
    } else {
      setFormData({
        expediente: '',
        tipo_expediente: 'PEDIDO DE INFORMES',
        cámara: 'Diputados',
        estado: 'Presentado',
        fecha_ingreso: new Date().toISOString().split('T')[0],
        sumario: '',
        autores: '',
        tramite_parlamentario: '',
        OD_DIPUTADOS: '',
        OD_SENADO: ''
      });
    }
  }, [expediente, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.expediente || !formData.sumario) {
      toast.error('Número de expediente y sumario son requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        autores: formData.autores.split(',').map(a => a.trim()).filter(a => a),
        bloque: [],
        provincias: [],
        derivaciones: expediente?.derivaciones || [],
        extracto: formData.sumario
      };

      let result;
      if (mode === 'create') {
        result = await createExpediente(dataToSave);
      } else {
        result = await updateExpediente(expediente!.id, dataToSave);
      }

      if (result) {
        toast.success(mode === 'create' ? 'Expediente creado correctamente' : 'Expediente actualizado correctamente');
        onSuccess?.();
        onClose();
      } else {
        toast.error(mode === 'create' ? 'Error al crear expediente' : 'Error al actualizar expediente');
      }
    } catch (error) {
      toast.error('Error al guardar expediente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuevo Expediente' : 'Editar Expediente'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expediente">Número de Expediente *</Label>
              <Input
                id="expediente"
                placeholder="Ej: 1234-D-2025"
                value={formData.expediente}
                onChange={(e) => setFormData({ ...formData, expediente: e.target.value })}
                required
                disabled={mode === 'edit'}
                data-testid="input-expediente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_ingreso">Fecha de Ingreso *</Label>
              <Input
                id="fecha_ingreso"
                type="date"
                value={formData.fecha_ingreso}
                onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                required
                data-testid="input-fecha"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="camara">Cámara *</Label>
              <Select 
                value={formData.cámara} 
                onValueChange={(v) => setFormData({ ...formData, cámara: v as 'Diputados' | 'Senado' })}
              >
                <SelectTrigger data-testid="select-camara">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diputados">Diputados</SelectItem>
                  <SelectItem value="Senado">Senado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Expediente *</Label>
              <Select 
                value={formData.tipo_expediente} 
                onValueChange={(v) => setFormData({ ...formData, tipo_expediente: v })}
              >
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EXPEDIENTE.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            <Select 
              value={formData.estado} 
              onValueChange={(v) => setFormData({ ...formData, estado: v })}
            >
              <SelectTrigger data-testid="select-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map(estado => (
                  <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sumario">Sumario / Extracto *</Label>
            <Textarea
              id="sumario"
              placeholder="Descripción del expediente"
              value={formData.sumario}
              onChange={(e) => setFormData({ ...formData, sumario: e.target.value })}
              required
              rows={4}
              data-testid="input-sumario"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="autores">Autores (separados por coma)</Label>
            <Input
              id="autores"
              placeholder="Ej: PÉREZ, JUAN; GARCÍA, MARÍA"
              value={formData.autores}
              onChange={(e) => setFormData({ ...formData, autores: e.target.value })}
              data-testid="input-autores"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tp">Trámite Parlamentario</Label>
              <Input
                id="tp"
                placeholder="Ej: TP-175"
                value={formData.tramite_parlamentario}
                onChange={(e) => setFormData({ ...formData, tramite_parlamentario: e.target.value })}
                data-testid="input-tp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="od">Orden del Día</Label>
              <Input
                id="od"
                placeholder="Ej: OD-826-25"
                value={formData.cámara === 'Diputados' ? formData.OD_DIPUTADOS : formData.OD_SENADO}
                onChange={(e) => {
                  if (formData.cámara === 'Diputados') {
                    setFormData({ ...formData, OD_DIPUTADOS: e.target.value });
                  } else {
                    setFormData({ ...formData, OD_SENADO: e.target.value });
                  }
                }}
                data-testid="input-od"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
              {isSubmitting ? 'Guardando...' : (mode === 'create' ? 'Crear Expediente' : 'Guardar Cambios')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
