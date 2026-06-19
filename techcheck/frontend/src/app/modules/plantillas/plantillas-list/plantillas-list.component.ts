import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Plantilla, PlantillaForm, ItemPlantilla, ArchivoAdjunto } from '../../../core/models/models';
import { PlantillasService } from '../../../core/services/plantillas.service';
import { ArchivosService } from '../../../core/services/archivos.service';

@Component({
  selector: 'app-plantillas-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plantillas-list.component.html'
})
export class PlantillasListComponent implements OnInit {
  plantillas = signal<Plantilla[]>([]);
  cargando = signal(true);
  error = signal('');
  exito = signal('');
  mostrarModal = signal(false);
  modoEdicion = signal(false);
  plantillaEditandoId = '';
  nuevoItem = '';
  importando = signal(false);
  form: PlantillaForm = { nombre: '', descripcion: '', items: [] };

  constructor(private svc: PlantillasService, private archivosSvc: ArchivosService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.svc.getAll().subscribe({
      next: d => {
        this.plantillas.set(d.map(p => ({
          ...p,
          items: p.items.map((i: any) => typeof i === 'string'
            ? { label: i, observacionGuia: '', archivosGuia: [] }
            : { ...i, archivosGuia: i.archivosGuia || [] })
        })));
        this.cargando.set(false);
      }
    });
  }

  abrirModalNueva() {
    this.form = { nombre: '', descripcion: '', items: [] };
    this.modoEdicion.set(false);
    this.plantillaEditandoId = '';
    this.nuevoItem = '';
    this.mostrarModal.set(true);
  }

  abrirModalEditar(p: Plantilla) {
    this.form = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      items: p.items.map((i: any) => typeof i === 'string'
        ? { label: i, observacionGuia: '', archivosGuia: [] }
        : { ...i, archivosGuia: i.archivosGuia || [] })
    };
    this.modoEdicion.set(true);
    this.plantillaEditandoId = p.id;
    this.nuevoItem = '';
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    if (confirm('¿Estás seguro de salir? Los cambios no guardados se perderán.')) {
      this.mostrarModal.set(false);
    }
  }

  agregarItem() {
    const t = this.nuevoItem.trim();
    if (!t) return;
    this.form.items = [...this.form.items, { label: t, observacionGuia: '', archivosGuia: [] }];
    this.nuevoItem = '';
  }

  quitarItem(i: number) { this.form.items = this.form.items.filter((_, idx) => idx !== i); }

  onArchivoPlantillaItemChange(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => this.leerArchivoGuiaPlantilla(idx, file));
  }

  eliminarArchivoPlantillaItem(idx: number, archivoIdx: number) {
    const updated = [...this.form.items];
    updated[idx] = { ...updated[idx], archivosGuia: updated[idx].archivosGuia.filter((_, i) => i !== archivoIdx) };
    this.form.items = [...updated];
  }

  draggingPlantillaItemIdx: number | null = null;

  onPastePlantillaItem(idx: number, event: ClipboardEvent) {
    const clipItems = event.clipboardData?.items;
    if (!clipItems) return;
    for (let i = 0; i < clipItems.length; i++) {
      if (clipItems[i].type.startsWith('image/')) {
        event.preventDefault();
        const file = clipItems[i].getAsFile();
        if (file) this.leerArchivoGuiaPlantilla(idx, file);
      }
    }
  }

  onDragOverPlantillaItem(idx: number, event: DragEvent) {
    event.preventDefault();
    this.draggingPlantillaItemIdx = idx;
  }

  onDragLeavePlantillaItem(event: DragEvent) {
    if (!event.relatedTarget || !(event.currentTarget as Element).contains(event.relatedTarget as Element)) {
      this.draggingPlantillaItemIdx = null;
    }
  }

  onDropPlantillaItem(idx: number, event: DragEvent) {
    event.preventDefault();
    this.draggingPlantillaItemIdx = null;
    const files = event.dataTransfer?.files;
    if (!files) return;
    Array.from(files).forEach(f => this.leerArchivoGuiaPlantilla(idx, f));
  }

  private leerArchivoGuiaPlantilla(idx: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target!.result as string;
      this.archivosSvc.subir(file.name, file.type, data).subscribe({
        next: (ref) => {
          const updated = [...this.form.items];
          updated[idx] = { ...updated[idx], archivosGuia: [...(updated[idx].archivosGuia || []), ref] };
          this.form.items = [...updated];
        }
      });
    };
    reader.readAsDataURL(file);
  }

  archivoData(a: ArchivoAdjunto | string): string {
    if (typeof a === 'string') return a;
    return a.url || a.data || '';
  }

  esImagenArchivo(a: ArchivoAdjunto | string): boolean {
    if (typeof a === 'string') return a.startsWith('data:image');
    return a.tipo.startsWith('image/');
  }

  puedeVerEnNavegador(a: ArchivoAdjunto | string): boolean {
    if (typeof a === 'string') {
      return a.startsWith('data:image') || a.startsWith('data:application/pdf') || a.startsWith('data:text/');
    }
    return a.tipo.startsWith('image/') || a.tipo === 'application/pdf' || a.tipo.startsWith('text/');
  }

  descargarArchivo(a: ArchivoAdjunto | string) {
    const href = typeof a === 'string' ? a : (a.url || a.data || '');
    const nombre = typeof a === 'string' ? 'archivo_adjunto' : a.nombre;
    const link = document.createElement('a');
    link.href = href;
    link.download = nombre;
    link.click();
  }

  abrirArchivoAdjunto(a: ArchivoAdjunto | string) {
    const win = window.open();
    if (!win) return;
    if (this.esImagenArchivo(a)) {
      win.document.write(`<img src="${this.archivoData(a)}" style="max-width:100%;display:block">`);
    } else {
      win.document.write(`<embed src="${this.archivoData(a)}" style="width:100%;height:100vh">`);
    }
    win.document.close();
  }

  guardar() {
    if (!this.form.nombre || !this.form.items.length) return;
    if (this.modoEdicion()) {
      this.svc.update(this.plantillaEditandoId, this.form).subscribe({
        next: () => { this.mostrarModal.set(false); this.cargar(); }
      });
    } else {
      this.svc.create(this.form).subscribe({
        next: () => { this.mostrarModal.set(false); this.cargar(); }
      });
    }
  }

  eliminar(id: string) {
    if (!confirm('Eliminar esta plantilla?')) return;
    this.svc.delete(id).subscribe({ next: () => this.cargar() });
  }

  onImportarExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.importando.set(true);
    this.error.set('');
    this.exito.set('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Saltar header
        const plantillasImportadas: PlantillaForm[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const nombre = String(row[0]).trim();
          const descripcion = row[1] ? String(row[1]).trim() : '';
          const itemsRaw = row[2] ? String(row[2]).trim() : '';
          const itemLabels = itemsRaw.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          if (nombre && itemLabels.length > 0) {
            plantillasImportadas.push({ nombre, descripcion, items: itemLabels.map((label: string) => ({ label, observacionGuia: '', archivosGuia: [] })) });
          }
        }

        if (plantillasImportadas.length === 0) {
          this.error.set('No se encontraron plantillas validas en el archivo');
          this.importando.set(false);
          return;
        }

        // Guardar todas las plantillas
        let guardadas = 0;
        plantillasImportadas.forEach(p => {
          this.svc.create(p).subscribe({
            next: () => {
              guardadas++;
              if (guardadas === plantillasImportadas.length) {
                this.exito.set(`${guardadas} plantilla(s) importadas correctamente`);
                this.importando.set(false);
                this.cargar();
              }
            },
            error: () => {
              this.error.set('Error al guardar algunas plantillas');
              this.importando.set(false);
            }
          });
        });
      } catch (err) {
        this.error.set('Error al leer el archivo. Verifica que sea un Excel valido.');
        this.importando.set(false);
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
  }

  descargarPlantillaExcel() {
    const XLSX = (window as any).XLSX;
    const data = [
      ['nombre', 'descripcion', 'items'],
      ['Mantenimiento PC', 'Revision mensual', 'Revisar antivirus;Revisar disco;Verificar RAM']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantillas');
    XLSX.writeFile(wb, 'plantilla_importar_plantillas.xlsx');
  }
}