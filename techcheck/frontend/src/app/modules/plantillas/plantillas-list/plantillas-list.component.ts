import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Plantilla, PlantillaForm } from '../../../core/models/models';
import { PlantillasService } from '../../../core/services/plantillas.service';

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

  constructor(private svc: PlantillasService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.svc.getAll().subscribe({ next: d => { this.plantillas.set(d); this.cargando.set(false); } });
  }

  abrirModalNueva() {
    this.form = { nombre: '', descripcion: '', items: [] };
    this.modoEdicion.set(false);
    this.plantillaEditandoId = '';
    this.nuevoItem = '';
    this.mostrarModal.set(true);
  }

  abrirModalEditar(p: Plantilla) {
    this.form = { nombre: p.nombre, descripcion: p.descripcion, items: [...p.items] };
    this.modoEdicion.set(true);
    this.plantillaEditandoId = p.id;
    this.nuevoItem = '';
    this.mostrarModal.set(true);
  }

  cerrarModal() { this.mostrarModal.set(false); }

  agregarItem() {
    const t = this.nuevoItem.trim();
    if (!t) return;
    this.form.items = [...this.form.items, t];
    this.nuevoItem = '';
  }

  quitarItem(i: number) { this.form.items = this.form.items.filter((_, idx) => idx !== i); }

  guardar() {
    if (!this.form.nombre || !this.form.items.length) return;
    if (this.modoEdicion()) {
      this.svc.update(this.plantillaEditandoId, this.form).subscribe({
        next: () => { this.cerrarModal(); this.cargar(); }
      });
    } else {
      this.svc.create(this.form).subscribe({
        next: () => { this.cerrarModal(); this.cargar(); }
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
          const items = itemsRaw.split('|').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          if (nombre && items.length > 0) {
            plantillasImportadas.push({ nombre, descripcion, items });
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
      ['Mantenimiento PC', 'Revision de equipos de computo', 'Revisar antivirus|Revisar disco duro|Verificar RAM|Revisar actualizaciones'],
      ['Revision Red', 'Infraestructura de red', 'Verificar switch|Probar velocidad|Revisar cables']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantillas');
    XLSX.writeFile(wb, 'plantillas_techcheck.xlsx');
  }
}