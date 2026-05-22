import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Revision, Proyecto } from '../../../core/models/models';
import { DonePipe } from '../../../shared/done.pipe';
import { RevisionesService } from '../../../core/services/otros.services';
import { ProyectosService } from '../../../core/services/proyectos.service';

@Component({
  selector: 'app-historial-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DonePipe],
  templateUrl: './historial-list.component.html'
})
export class HistorialListComponent implements OnInit {
  vista = signal<'proyectos' | 'revisiones'>('proyectos');
  proyectos = signal<Proyecto[]>([]);
  proyectoActual = signal<Proyecto | null>(null);
  revisiones = signal<Revision[]>([]);
  cargando = signal(true);
  error = signal('');
  revisionDetalle = signal<Revision | null>(null);
  filtroEstado = '';
  filtroTexto = '';

  constructor(
    private revisionesSvc: RevisionesService,
    private proyectosSvc: ProyectosService
  ) {}

  ngOnInit() { this.cargarProyectos(); }

  cargarProyectos() {
    this.cargando.set(true);
    this.proyectosSvc.getAll().subscribe({
      next: d => { this.proyectos.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar proyectos'); this.cargando.set(false); }
    });
  }

  entrarProyecto(proyecto: Proyecto) {
    this.proyectoActual.set(proyecto);
    this.vista.set('revisiones');
    this.cargarRevisionesProyecto(proyecto.id);
  }

  volverAProyectos() {
    this.vista.set('proyectos');
    this.proyectoActual.set(null);
    this.revisiones.set([]);
    this.cargarProyectos();
  }
cargarRevisionesProyecto(proyectoId: string) {
  this.cargando.set(true);
  this.proyectosSvc.getTodosEquipos(proyectoId).subscribe({
    next: equipos => {
      this.revisionesSvc.getAll().subscribe({
        next: revisiones => {
          const equipoIds = equipos.map(e => e.id);
          const delProyecto = revisiones.filter(r => equipoIds.includes(r.equipoId));
          this.revisiones.set(delProyecto);
          this.cargando.set(false);
        },
        error: () => { this.error.set('Error al cargar historial'); this.cargando.set(false); }
      });
    },
    error: () => { this.error.set('Error al cargar equipos'); this.cargando.set(false); }
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
    const map: any = { ok: 'OK', observacion: 'Observaciones', problema: 'Problemas' };
    return map[estado] || estado;
  }

  eliminar(id: string) {
    if (!confirm('Eliminar esta revision del historial?')) return;
    this.revisionesSvc.delete(id).subscribe({ next: () => this.cargarRevisionesProyecto(this.proyectoActual()!.id) });
  }

  trackById(_: number, r: any) { return r.id; }
}