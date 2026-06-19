import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Revision, Proyecto, ArchivoAdjunto } from '../../../core/models/models';
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
          const delProyecto = revisiones.filter(r => {
            if (!equipoIds.includes(r.equipoId)) return false;
            // Solo revisiones donde todos los items estan marcados
            if (r.items.length === 0) return false;
            const completados = r.items.filter(i => i.checked).length;
            return completados === r.items.length;
          });
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
    const data = this.archivoData(a);
    const nombre = typeof a === 'string' ? 'archivo_adjunto' : a.nombre;
    const link = document.createElement('a');
    link.href = data;
    link.download = nombre;
    link.click();
  }

  abrirArchivoAdjunto(a: ArchivoAdjunto | string) {
    const data = this.archivoData(a);
    const win = window.open();
    if (win) {
      if (this.esImagenArchivo(a)) {
        win.document.write(`<img src="${data}" style="max-width:100%;display:block">`);
      } else {
        win.document.write(`<embed src="${data}" style="width:100%;height:100vh">`);
      }
      win.document.close();
    }
  }
}