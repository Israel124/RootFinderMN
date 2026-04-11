import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalculationResult } from '@/types';
import { Trash2, Download, ExternalLink, FileSpreadsheet, FileText, Edit2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface HistorySectionProps {
  history: CalculationResult[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onLoad: (result: CalculationResult) => void;
  onUpdate: (id: string, label: string) => void;
}

export function HistorySection({ history, onDelete, onClear, onLoad, onUpdate }: HistorySectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (item: CalculationResult) => {
    setEditingId(item.id);
    setEditValue(item.label || '');
  };

  const saveEdit = (id: string) => {
    onUpdate(id, editValue);
    setEditingId(null);
    toast.success('Etiqueta actualizada');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const exportToExcel = () => {
    if (history.length === 0) return toast.error('No hay historial para exportar');
    
    const data = history.map(item => ({
      Fecha: format(item.timestamp, 'dd/MM/yyyy HH:mm:ss'),
      Metodo: item.method,
      Funcion: item.functionF,
      Raiz: item.root,
      Error: item.error,
      Iteraciones: item.iterations.length,
      Convergencia: item.converged ? 'Sí' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, "historial_raices.xlsx");
    toast.success('Archivo Excel exportado');
  };

  const exportToCSV = () => {
    if (history.length === 0) return toast.error('No hay historial para exportar');

    const headers = ['Fecha', 'Metodo', 'Funcion', 'Raiz', 'Error', 'Iteraciones', 'Convergencia'];
    const rows = history.map(item => [
      format(item.timestamp, 'dd/MM/yyyy HH:mm:ss'),
      item.method,
      `"${item.functionF}"`,
      item.root,
      item.error,
      item.iterations.length,
      item.converged ? 'Sí' : 'No'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "historial_raices.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo CSV exportado');
  };

  return (
    <Card className="max-w-6xl mx-auto border-primary/10 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-primary">Historial de Cálculos</CardTitle>
            <CardDescription>
              Resultados guardados de forma persistente en NeonDB.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="border-primary/20 hover:bg-primary/10">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-primary" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="border-primary/20 hover:bg-primary/10">
              <FileText className="w-4 h-4 mr-2 text-primary" />
              CSV
            </Button>
            <Button variant="destructive" size="sm" onClick={onClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar Todo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed border-primary/20 bg-primary/5">
            No hay registros en el historial.
          </div>
        ) : (
          <div className="rounded-xl border border-primary/10 overflow-hidden bg-background/30">
            <Table>
              <TableHeader className="bg-primary/5">
                <TableRow>
                  <TableHead className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Fecha</TableHead>
                  <TableHead className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Etiqueta / Nota</TableHead>
                  <TableHead className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Método</TableHead>
                  <TableHead className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Función</TableHead>
                  <TableHead className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Raíz</TableHead>
                  <TableHead className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Estado</TableHead>
                  <TableHead className="text-right text-primary/70 font-bold uppercase text-[10px] tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-primary/5 transition-colors">
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {format(item.timestamp, 'dd/MM/yy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <Input 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 text-xs w-[150px] bg-background border-primary/30"
                            placeholder="Nota..."
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => saveEdit(item.id)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={cancelEdit}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate max-w-[150px] text-foreground">
                            {item.label || <span className="text-muted-foreground italic text-xs">Sin etiqueta</span>}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                            onClick={() => startEditing(item)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize font-bold text-primary">{item.method}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate text-muted-foreground">
                      {item.functionF}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-secondary font-bold">
                      {item.root?.toFixed(6) || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.converged ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
                      }`}>
                        {item.converged ? 'OK' : 'FAIL'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => onLoad(item)}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onDelete(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
