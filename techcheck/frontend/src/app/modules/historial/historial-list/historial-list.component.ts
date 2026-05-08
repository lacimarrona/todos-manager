import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Revision } from '../../../core/models/models';
import { DonePipe } from '../../../shared/done.pipe';
import { RevisionesService } from '../../../core/services/otros.services';

@Component({
  selector: 'app-historial-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DonePipe],
  templateUrl: './historial-list.component.html'
})
export class HistorialListComponent implements OnInit {
  revisiones = signal<Revision[]>([]);
  cargando = signal(true);
  error = signal('');
  revisionDetalle = signal<Revision | null>(null);

  filtroEstado = '';
  filtroTexto = '';

  constructor(private revisionesSvc: RevisionesService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.revisionesSvc.getAll().subscribe({
      next: d => { this.revisiones.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar historial'); this.cargando.set(false); }
    });
  }

  get revisionesFiltradas(): Revision[] {
    return this.revisiones().filter(r => {
      const matchEstado = !this.filtroEstado || r.estado === this.filtroEstado;
      const matchTexto = !this.filtroTexto ||
        r.equipoNombre?.toLowerCase().includes(this.filtroTexto.toLowerCase()) ||
        r.tecnicoNombre?.toLowerCase().includes(this.filtroTexto.toLowerCase());
      return matchEstado && matchTexto;
    });
  }

  verDetalle(r: Revision) { this.revisionDetalle.set(r); }
  cerrarDetalle() { this.revisionDetalle.set(null); }

  estadoLabel(estado: string): string {
    const map: any = { ok: '✅ OK', observacion: '⚠️ Observaciones', problema: '❌ Problemas' };
    return map[estado] || estado;
  }

  eliminar(id: string) {
    if (!confirm('¿Eliminar esta revisión del historial?')) return;
    this.revisionesSvc.delete(id).subscribe({ next: () => this.cargar() });
  }

  trackById(_: number, r: Revision) { return r.id; }
}