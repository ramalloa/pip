import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type Expediente, addMovimiento } from "@/lib/data-service";
import { useState } from "react";
import { toast } from "sonner";

interface MovimientoFormModalProps {
  expediente: Expediente | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MovimientoFormModal({ 
  expediente, 
  open, 
  onClose,
  onSuccess 
}: MovimientoFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    emisor: '',
    destino: '',
    novedad: '',
    realizadoPor: ''
  });

  if (!expediente) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fecha || !formData.emisor || !formData.destino || !formData.novedad) {
      toast.error('Todos los campos son requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addMovimiento(expediente.expediente, formData);
      if (result) {
        toast.success('Movimiento agregado correctamente');
        setFormData({
          fecha: new Date().toISOString().split('T')[0],
          emisor: '',
          destino: '',
          novedad: '',
          realizadoPor: ''
        });
        onSuccess?.();
        onClose();
      } else {
        toast.error('Error al agregar movimiento');
      }
    } catch (error) {
      toast.error('Error al agregar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Movimiento Interno</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Expediente: {expediente.expediente}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input
              id="fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              required
              data-testid="input-fecha"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emisor">Emisor *</Label>
            <Input
              id="emisor"
              placeholder="Ej: Secretaría de Relaciones Parlamentarias"
              value={formData.emisor}
              onChange={(e) => setFormData({ ...formData, emisor: e.target.value })}
              required
              data-testid="input-emisor"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destino">Destino *</Label>
            <Input
              id="destino"
              placeholder="Ej: Comisión de Asuntos Constitucionales"
              value={formData.destino}
              onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
              required
              data-testid="input-destino"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="novedad">Novedad *</Label>
            <Textarea
              id="novedad"
              placeholder="Descripción del movimiento o novedad"
              value={formData.novedad}
              onChange={(e) => setFormData({ ...formData, novedad: e.target.value })}
              required
              rows={3}
              data-testid="input-novedad"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="realizadoPor">Realizado Por</Label>
            <Input
              id="realizadoPor"
              placeholder="Nombre del responsable"
              value={formData.realizadoPor}
              onChange={(e) => setFormData({ ...formData, realizadoPor: e.target.value })}
              data-testid="input-realizadoPor"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
              {isSubmitting ? 'Guardando...' : 'Guardar Movimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
