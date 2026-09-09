import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Revision, Proyecto, ArchivoAdjunto } from '../../../core/models/models';
import { DonePipe } from '../../../shared/done.pipe';
import { RevisionesService } from '../../../core/services/otros.services';
import { ProyectosService } from '../../../core/services/proyectos.service';

export interface ResumenEquipo {
  nombre: string;
  totalRevisiones: number;
  ultimaFecha: string;
  ultimoEstado: string;
  itemsConProblema: number;
  itemsConObservacion: number;
}

export interface ItemProblematico {
  label: string;
  problemas: number;
  observaciones: number;
}

@Component({
  selector: 'app-historial-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DonePipe],
  templateUrl: './historial-list.component.html'
})
export class HistorialListComponent implements OnInit {
  vista = signal<'proyectos' | 'revisiones' | 'informe'>('proyectos');
  proyectos = signal<Proyecto[]>([]);
  proyectoActual = signal<Proyecto | null>(null);
  revisiones = signal<Revision[]>([]);
  todasRevisiones = signal<Revision[]>([]);
  equiposInforme = signal<any[]>([]);
  filtroArchivoInforme = signal<'activos' | 'todos' | 'archivados'>('activos');
  cargando = signal(true);
  error = signal('');
  revisionDetalle = signal<Revision | null>(null);
  filtroEstado = '';
  filtroTexto = '';

  readonly revisionesInforme = computed<Revision[]>(() => {
    const todas = this.todasRevisiones();
    const equipos = this.equiposInforme();
    const filtro = this.filtroArchivoInforme();
    if (!equipos.length) return todas;
    const archivadosIds = new Set(equipos.filter((e: any) => e.archivado).map((e: any) => e.id));
    if (filtro === 'activos') return todas.filter(r => !archivadosIds.has(r.equipoId));
    if (filtro === 'archivados') return todas.filter(r => archivadosIds.has(r.equipoId));
    return todas;
  });

  readonly resumenEquipos = computed<ResumenEquipo[]>(() => {
    const revs = this.revisionesInforme();
    const byEquipo = new Map<string, Revision[]>();
    for (const r of revs) {
      const key = r.equipoNombre || r.equipoId;
      if (!byEquipo.has(key)) byEquipo.set(key, []);
      byEquipo.get(key)!.push(r);
    }
    return Array.from(byEquipo.entries()).map(([nombre, revisions]) => {
      const sorted = [...revisions].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
      const ultima = sorted[0];
      let itemsConProblema = 0;
      let itemsConObservacion = 0;
      for (const rev of revisions) {
        for (const item of rev.items) {
          if (item.estado === 'problema') itemsConProblema++;
          else if (item.estado === 'observacion') itemsConObservacion++;
        }
      }
      return {
        nombre,
        totalRevisiones: revisions.length,
        ultimaFecha: ultima.creadoEn,
        ultimoEstado: ultima.estado,
        itemsConProblema,
        itemsConObservacion,
      };
    }).sort((a, b) => (b.itemsConProblema + b.itemsConObservacion) - (a.itemsConProblema + a.itemsConObservacion));
  });

  readonly itemsProblematicos = computed<ItemProblematico[]>(() => {
    const byLabel = new Map<string, { problemas: number; observaciones: number }>();
    for (const rev of this.revisionesInforme()) {
      for (const item of rev.items) {
        if (!item.estado || item.estado === 'ok') continue;
        if (!byLabel.has(item.label)) byLabel.set(item.label, { problemas: 0, observaciones: 0 });
        const entry = byLabel.get(item.label)!;
        if (item.estado === 'problema') entry.problemas++;
        else if (item.estado === 'observacion') entry.observaciones++;
      }
    }
    return Array.from(byLabel.entries())
      .map(([label, c]) => ({ label, ...c }))
      .sort((a, b) => (b.problemas * 2 + b.observaciones) - (a.problemas * 2 + a.observaciones));
  });

  readonly statsGeneral = computed(() => {
    const revs = this.revisionesInforme();
    return {
      total: revs.length,
      ok: revs.filter(r => r.estado === 'ok').length,
      observacion: revs.filter(r => r.estado === 'observacion').length,
      problema: revs.filter(r => r.estado === 'problema').length,
    };
  });

  // Si viene con proyectoId en la ruta, indica que se entró desde dentro de un proyecto
  readonly modoProyecto = signal(false);

  constructor(
    private revisionesSvc: RevisionesService,
    private proyectosSvc: ProyectosService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    const proyectoId = this.route.snapshot.paramMap.get('proyectoId');
    if (proyectoId) {
      this.modoProyecto.set(true);
      this.cargando.set(true);
      this.proyectosSvc.getById(proyectoId).subscribe({
        next: p => {
          this.proyectoActual.set(p);
          this.vista.set('revisiones');
          this.cargarRevisionesProyecto(p.id, true);
        },
        error: () => { this.error.set('Error al cargar proyecto'); this.cargando.set(false); }
      });
    } else {
      this.cargarProyectos();
    }
  }

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

  verInformeProyecto(proyecto: Proyecto, event: Event) {
    event.stopPropagation();
    this.proyectoActual.set(proyecto);
    this.vista.set('informe');
    this.filtroArchivoInforme.set('activos');
    this.cargarRevisionesProyecto(proyecto.id, true);
  }

  volverAProyecto() {
    if (this.modoProyecto() && this.proyectoActual()) {
      this.router.navigate(['/equipos'], { queryParams: { proyecto: this.proyectoActual()!.id } });
    } else {
      this.volverAProyectos();
    }
  }

  volverAProyectos() {
    this.vista.set('proyectos');
    this.proyectoActual.set(null);
    this.revisiones.set([]);
    this.todasRevisiones.set([]);
    this.cargarProyectos();
  }

  volverARevisiones() {
    this.vista.set('revisiones');
  }

  cargarRevisionesProyecto(proyectoId: string, todasIncluyendoParciales = false) {
    this.cargando.set(true);
    this.proyectosSvc.getTodosEquipos(proyectoId).subscribe({
      next: equipos => {
        if (todasIncluyendoParciales) this.equiposInforme.set(equipos);
        this.revisionesSvc.getAll().subscribe({
          next: revisiones => {
            const equipoIds = equipos.map((e: any) => e.id);
            const completadas = revisiones.filter(r => {
              if (!equipoIds.includes(r.equipoId)) return false;
              if (r.items.length === 0) return false;
              const completados = r.items.filter(i => i.checked).length;
              return completados === r.items.length;
            });
            this.revisiones.set(completadas);
            this.todasRevisiones.set(todasIncluyendoParciales ? revisiones.filter((r: Revision) => equipoIds.includes(r.equipoId)) : completadas);
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

  range(n: number): number[] { return Array.from({ length: Math.min(n, 10) }, (_, i) => i); }

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