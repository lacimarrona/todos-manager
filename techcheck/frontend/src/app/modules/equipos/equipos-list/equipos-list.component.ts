import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Proyecto, ProyectoForm, Equipo, EquipoForm, Plantilla, Tecnico, RevisionForm, ItemRevision, EstadoRevision } from '../../../core/models/models';
import { ProyectosService } from '../../../core/services/proyectos.service';
import { EquiposService } from '../../../core/services/equipos.service';
import { PlantillasService } from '../../../core/services/plantillas.service';
import { TecnicosService, RevisionesService } from '../../../core/services/otros.services';

type FiltroEstado = 'pendiente' | 'en_proceso' | 'terminado';

@Component({
  selector: 'app-equipos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipos-list.component.html'
})
export class EquiposListComponent implements OnInit {
  vista = signal<'proyectos' | 'equipos'>('proyectos');

  proyectos = signal<Proyecto[]>([]);
  proyectoActual = signal<Proyecto | null>(null);
  equipos = signal<Equipo[]>([]);
  plantillas = signal<Plantilla[]>([]);
  tecnicos = signal<Tecnico[]>([]);
  cargando = signal(true);
  error = signal('');

  filtroActivo = signal<FiltroEstado>('pendiente');

  mostrarModalProyecto = signal(false);
  modoEdicionProyecto = signal(false);
  proyectoEditandoId = '';
  formProyecto: ProyectoForm = { nombre: '', descripcion: '' };

  mostrarModalEquipo = signal(false);
  modoEdicionEquipo = signal(false);
  equipoEditandoId = '';
  nuevoItem = '';
  formEquipo: EquipoForm = { nombre: '', descripcion: '', items: [], plantillaId: '', proyectoIds: [] };

  mostrarModalRevision = signal(false);
  equipoRevisando = signal<Equipo | null>(null);
  guardandoRevision = signal(false);
  tecnicoId = '';
  estado: EstadoRevision = 'ok';
  observacionGeneral = '';
  itemsRevision = signal<ItemRevision[]>([]);
  fotosBase64: string[] = [];
  revisionRetomadaId = '';

  constructor(
    private proyectosSvc: ProyectosService,
    private equiposSvc: EquiposService,
    private plantillasSvc: PlantillasService,
    private tecnicosSvc: TecnicosService,
    private revisionesSvc: RevisionesService,
  ) {}

  ngOnInit() {
    this.cargarProyectos();
    this.plantillasSvc.getAll().subscribe({ next: d => this.plantillas.set(d) });
    this.tecnicosSvc.getAll().subscribe({ next: d => this.tecnicos.set(d) });
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
    this.vista.set('equipos');
    this.filtroActivo.set('pendiente');
    this.cargarEquiposFiltrados('pendiente');
  }

  volverAProyectos() {
    this.vista.set('proyectos');
    this.proyectoActual.set(null);
    this.equipos.set([]);
    this.cargarProyectos();
  }

  cambiarFiltro(filtro: FiltroEstado) {
    this.filtroActivo.set(filtro);
    this.cargarEquiposFiltrados(filtro);
  }

  cargarEquiposFiltrados(filtro: FiltroEstado) {
  this.cargando.set(true);
  const proyectoId = this.proyectoActual()!.id;
  this.proyectosSvc.getEquiposFiltrados(proyectoId, filtro).subscribe({
    next: d => { this.equipos.set(d); this.cargando.set(false); },
    error: () => { this.error.set('Error al cargar equipos'); this.cargando.set(false); }
  });
}

  abrirModalNuevoProyecto() {
    this.formProyecto = { nombre: '', descripcion: '' };
    this.modoEdicionProyecto.set(false);
    this.proyectoEditandoId = '';
    this.mostrarModalProyecto.set(true);
  }

  abrirModalEditarProyecto(p: Proyecto, event: Event) {
    event.stopPropagation();
    this.formProyecto = { nombre: p.nombre, descripcion: p.descripcion };
    this.proyectoEditandoId = p.id;
    this.modoEdicionProyecto.set(true);
    this.mostrarModalProyecto.set(true);
  }

  guardarProyecto() {
    if (!this.formProyecto.nombre.trim()) return;
    if (this.modoEdicionProyecto()) {
      this.proyectosSvc.update(this.proyectoEditandoId, this.formProyecto).subscribe({
        next: () => { this.mostrarModalProyecto.set(false); this.cargarProyectos(); }
      });
    } else {
      this.proyectosSvc.create(this.formProyecto).subscribe({
        next: () => { this.mostrarModalProyecto.set(false); this.cargarProyectos(); }
      });
    }
  }

  eliminarProyecto(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Eliminar este proyecto? Los equipos asociados no se eliminaran.')) return;
    this.proyectosSvc.delete(id).subscribe({ next: () => this.cargarProyectos() });
  }

  abrirModalNuevoEquipo() {
    this.formEquipo = { nombre: '', descripcion: '', items: [], plantillaId: '', proyectoIds: [this.proyectoActual()!.id] };
    this.modoEdicionEquipo.set(false);
    this.equipoEditandoId = '';
    this.nuevoItem = '';
    this.mostrarModalEquipo.set(true);
  }

  abrirModalEditarEquipo(equipo: Equipo) {
    this.formEquipo = {
      nombre: equipo.nombre,
      descripcion: equipo.descripcion,
      items: [...equipo.items],
      plantillaId: equipo.plantillaId || '',
      proyectoIds: equipo.proyectoIds || []
    };
    this.equipoEditandoId = equipo.id;
    this.modoEdicionEquipo.set(true);
    this.nuevoItem = '';
    this.mostrarModalEquipo.set(true);
  }

  onPlantillaChange() {
    if (!this.formEquipo.plantillaId) return;
    const p = this.plantillas().find(x => x.id === this.formEquipo.plantillaId);
    if (p) this.formEquipo.items = [...p.items];
  }

  agregarItem() {
    const t = this.nuevoItem.trim();
    if (!t) return;
    this.formEquipo.items = [...this.formEquipo.items, t];
    this.nuevoItem = '';
  }

  quitarItem(idx: number) {
    this.formEquipo.items = this.formEquipo.items.filter((_, i) => i !== idx);
  }

  guardarEquipo() {
    if (!this.formEquipo.nombre.trim()) return;
    if (this.modoEdicionEquipo()) {
      this.equiposSvc.update(this.equipoEditandoId, this.formEquipo).subscribe({
        next: () => { this.mostrarModalEquipo.set(false); this.cargarEquiposFiltrados(this.filtroActivo()); }
      });
    } else {
      this.equiposSvc.create(this.formEquipo).subscribe({
        next: () => { this.mostrarModalEquipo.set(false); this.cargarEquiposFiltrados(this.filtroActivo()); }
      });
    }
  }

  eliminarEquipo(id: string) {
    if (!confirm('Eliminar este equipo?')) return;
    this.equiposSvc.delete(id).subscribe({
      next: () => this.cargarEquiposFiltrados(this.filtroActivo())
    });
  }

  abrirModalRevision(equipo: Equipo) {
    this.equipoRevisando.set(equipo);
    this.tecnicoId = '';
    this.estado = 'ok';
    this.observacionGeneral = '';
    this.fotosBase64 = [];
    if (equipo.ultimaRevision) {
      const ultima = equipo.ultimaRevision;
      const completados = ultima.items.filter(i => i.checked).length;
      const total = ultima.items.length;
      if (total > 0 && completados < total) {
        this.itemsRevision.set(ultima.items.map(i => ({ ...i, archivos: i.archivos || [] })));
        this.tecnicoId = ultima.tecnicoId || '';
        this.estado = ultima.estado;
        this.observacionGeneral = ultima.observacionGeneral || '';
        this.revisionRetomadaId = ultima.id;
      } else {
        this.itemsRevision.set(equipo.items.map(label => ({ label, checked: false, nota: '', archivos: [] })));
        this.revisionRetomadaId = '';
      }
    } else {
      this.itemsRevision.set(equipo.items.map(label => ({ label, checked: false, nota: '', archivos: [] })));
      this.revisionRetomadaId = '';
    }
    this.mostrarModalRevision.set(true);
  }

  toggleItem(idx: number) {
    const updated = [...this.itemsRevision()];
    updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
    this.itemsRevision.set(updated);
  }

  updateNota(idx: number, nota: string) {
    const updated = [...this.itemsRevision()];
    updated[idx] = { ...updated[idx], nota };
    this.itemsRevision.set(updated);
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

  onArchivoItemChange(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const updated = [...this.itemsRevision()];
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        updated[idx] = { ...updated[idx], archivos: [...(updated[idx].archivos || []), e.target!.result as string] };
        this.itemsRevision.set([...updated]);
      };
      reader.readAsDataURL(file);
    });
  }

  eliminarArchivoItem(idx: number, archivoIdx: number) {
    const updated = [...this.itemsRevision()];
    updated[idx] = { ...updated[idx], archivos: updated[idx].archivos.filter((_, i) => i !== archivoIdx) };
    this.itemsRevision.set(updated);
  }

  get itemsCompletados(): number { return this.itemsRevision().filter(i => i.checked).length; }
  get totalItemsRevision(): number { return this.itemsRevision().length; }
  get revisionCompleta(): boolean { return this.totalItemsRevision > 0 && this.itemsCompletados === this.totalItemsRevision; }

  guardarRevision() {
    const equipo = this.equipoRevisando();
    if (!equipo) return;
    const tecnico = this.tecnicos().find(t => t.id === this.tecnicoId);
    const form: RevisionForm = {
      equipoId: equipo.id,
      tecnicoId: this.tecnicoId || undefined,
      tecnicoNombre: tecnico?.nombre || '',
      estado: this.estado,
      items: this.itemsRevision(),
      observacionGeneral: this.observacionGeneral,
      fotos: this.fotosBase64
    };
    this.guardandoRevision.set(true);

    const guardar = () => {
      this.revisionesSvc.create(form).subscribe({
        next: () => {
          this.guardandoRevision.set(false);
          this.mostrarModalRevision.set(false);
          this.revisionRetomadaId = '';
          this.cargarEquiposFiltrados(this.filtroActivo());
        },
        error: () => { this.guardandoRevision.set(false); }
      });
    };

    if (this.revisionRetomadaId) {
      this.revisionesSvc.delete(this.revisionRetomadaId).subscribe({
        next: () => guardar(),
        error: () => guardar()
      });
    } else {
      guardar();
    }
  }

  progreso(equipo: Equipo): number {
    if (!equipo.ultimaRevision || !equipo.items.length) return 0;
    const ok = equipo.ultimaRevision.items.filter(i => i.checked).length;
    return Math.round((ok / equipo.items.length) * 100);
  }

  estadoBadge(equipo: Equipo): string {
    if (!equipo.ultimaRevision) return 'sin-revision';
    return equipo.ultimaRevision.estado;
  }

  estadoLabel(equipo: Equipo): string {
    if (!equipo.ultimaRevision) return 'Sin revisiones';
    const map: any = { ok: 'OK', observacion: 'Observaciones', problema: 'Problemas' };
    return map[equipo.ultimaRevision.estado] || equipo.ultimaRevision.estado;
  }

  trackById(_: number, e: any) { return e.id; }
}