import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Equipo, Tecnico, RevisionForm, ItemRevision, EstadoRevision, EstadoItem } from '../../../core/models/models';
import { EquiposService } from '../../../core/services/equipos.service';
import { TecnicosService, RevisionesService } from '../../../core/services/otros.services';

@Component({
  selector: 'app-revisiones-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './revisiones-form.component.html'
})
export class RevisionesFormComponent implements OnInit {
  equipos = signal<Equipo[]>([]);
  tecnicos = signal<Tecnico[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  exito = signal(false);
  error = signal('');

  equipoSeleccionadoId = '';
  equipoSeleccionado = signal<Equipo | null>(null);
  tecnicoId = '';
  estado: EstadoRevision = 'ok';
  observacionGeneral = '';
  items = signal<ItemRevision[]>([]);
  notasTemp: string[][] = [];
  fotosBase64: string[] = [];

  constructor(
    private equiposSvc: EquiposService,
    private tecnicosSvc: TecnicosService,
    private revisionesSvc: RevisionesService
  ) {}

  ngOnInit() {
    this.equiposSvc.getAll().subscribe({ next: d => { this.equipos.set(d); this.cargando.set(false); } });
    this.tecnicosSvc.getAll().subscribe({ next: d => this.tecnicos.set(d) });
  }

  onEquipoChange() {
    const eq = this.equipos().find(e => e.id === this.equipoSeleccionadoId);
    this.equipoSeleccionado.set(eq || null);
    if (eq) {
      this.items.set(eq.items.map(i => ({
        label: typeof i === 'string' ? i : i.label,
        checked: false,
        nota: '',
        archivos: [],
        observacionGuia: typeof i === 'string' ? '' : i.observacionGuia,
        archivosGuia: typeof i === 'string' ? [] : (i.archivosGuia || [])
      })));
      this.notasTemp = this.items().map(() => ['']);
    } else {
      this.items.set([]);
      this.notasTemp = [];
    }
    this.exito.set(false);
  }

  toggleItem(idx: number) {
    const updated = [...this.items()];
    updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
    this.items.set(updated);
  }

  updateNota(idx: number, nota: string) {
    const updated = [...this.items()];
    updated[idx] = { ...updated[idx], nota };
    this.items.set(updated);
  }

  onNotaKeydown(event: KeyboardEvent, itemIdx: number, lineIdx: number) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.agregarNota(itemIdx, lineIdx);
    }
  }

  agregarNota(itemIdx: number, lineIdx: number) {
    if (!this.notasTemp[itemIdx]) this.notasTemp[itemIdx] = [''];
    this.notasTemp[itemIdx].splice(lineIdx + 1, 0, '');
    setTimeout(() => {
      const el = document.getElementById(`nota-${itemIdx}-${lineIdx + 1}`);
      if (el) (el as HTMLInputElement).focus();
    }, 0);
  }

  eliminarNotaLine(itemIdx: number, lineIdx: number) {
    if (!this.notasTemp[itemIdx] || this.notasTemp[itemIdx].length <= 1) {
      if (this.notasTemp[itemIdx]) this.notasTemp[itemIdx][0] = '';
      return;
    }
    this.notasTemp[itemIdx].splice(lineIdx, 1);
    setTimeout(() => {
      const el = document.getElementById(`nota-${itemIdx}-${Math.max(0, lineIdx - 1)}`);
      if (el) (el as HTMLInputElement).focus();
    }, 0);
  }

  trackByNotaIdx(index: number) { return index; }

  setItemEstado(idx: number, estado: EstadoItem) {
    const updated = [...this.items()];
    // Toggle: si ya está seleccionado, lo limpia
    const current = updated[idx].estado;
    updated[idx] = { ...updated[idx], estado: current === estado ? null : estado };
    this.items.set(updated);
  }

  onFotoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.fotosBase64 = [];
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => this.fotosBase64.push(e.target!.result as string);
      reader.readAsDataURL(file);
    });
  }

  get itemsCompletados(): number {
    return this.items().filter(i => i.checked).length;
  }

  get totalItems(): number {
    return this.items().length;
  }

  guardar() {
    if (!this.equipoSeleccionadoId) { this.error.set('Selecciona un equipo'); return; }
    const tecnico = this.tecnicos().find(t => t.id === this.tecnicoId);
    const items = this.items().map((item, idx) => ({
      ...item,
      nota: (this.notasTemp[idx] || []).filter(n => n.trim()).join('\n') || (item.nota || ''),
    }));
    const form: RevisionForm = {
      equipoId: this.equipoSeleccionadoId,
      tecnicoId: this.tecnicoId || undefined,
      tecnicoNombre: tecnico?.nombre || '',
      estado: this.estado,
      items,
      observacionGeneral: this.observacionGeneral,
      fotos: this.fotosBase64
    };
    this.guardando.set(true);
    this.revisionesSvc.create(form).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set(true);
        this.equipoSeleccionadoId = '';
        this.equipoSeleccionado.set(null);
        this.items.set([]);
        this.observacionGeneral = '';
        this.fotosBase64 = [];
        this.estado = 'ok';
      },
      error: () => { this.guardando.set(false); this.error.set('Error al guardar la revision'); }
    });
  }
}