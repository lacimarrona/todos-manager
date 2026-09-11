import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TareaProgramada, TareaForm, Equipo, Tecnico, Proyecto } from '../../core/models/models';
import { TareasService } from '../../core/services/otros.services';
import { EquiposService } from '../../core/services/equipos.service';
import { TecnicosService } from '../../core/services/otros.services';
import { ProyectosService } from '../../core/services/proyectos.service';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tareas.component.html'
})
export class TareasComponent implements OnInit {
  tareas = signal<TareaProgramada[]>([]);
  equipos = signal<Equipo[]>([]);
  proyectos = signal<Proyecto[]>([]);
  tecnicos = signal<Tecnico[]>([]);
  cargando = signal(true);
  error = signal('');
  guardando = signal(false);

  mostrarModal = signal(false);
  modoEdicion = signal(false);
  editandoId = '';

  form: TareaForm = this.formVacio();
  diasSeleccionados = signal<Set<number>>(new Set());

  // Dropdown personalizado de equipo
  dropdownAbierto = signal(false);
  gruposColapsados = signal<Set<string>>(new Set());

  readonly DIAS = DIAS;

  readonly gruposEquipos = computed(() => {
    const todos = this.equipos();
    const proyectos = this.proyectos();
    return proyectos
      .map(p => ({
        proyecto: p,
        equipos: todos.filter(e => e.proyectoIds && e.proyectoIds.includes(p.id))
      }))
      .filter(g => g.equipos.length > 0);
  });

  readonly equipoSeleccionadoNombre = computed(() => {
    if (!this.form.equipoId) return '';
    const e = this.equipos().find(eq => eq.id === this.form.equipoId);
    return e?.nombre || '';
  });

  constructor(
    private tareasSvc: TareasService,
    private equiposSvc: EquiposService,
    private tecnicosSvc: TecnicosService,
    private proyectosSvc: ProyectosService,
  ) {}

  ngOnInit() {
    this.cargar();
    this.equiposSvc.getAll().subscribe({ next: d => this.equipos.set(d) });
    this.tecnicosSvc.getAll().subscribe({ next: d => this.tecnicos.set(d) });
    this.proyectosSvc.getAll().subscribe({ next: d => this.proyectos.set(d) });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.closest('.equipo-dropdown')) {
      this.dropdownAbierto.set(false);
    }
  }

  toggleDropdown() {
    this.dropdownAbierto.update(v => !v);
  }

  toggleGrupo(proyectoId: string) {
    const s = new Set(this.gruposColapsados());
    if (s.has(proyectoId)) s.delete(proyectoId); else s.add(proyectoId);
    this.gruposColapsados.set(s);
  }

  seleccionarEquipo(equipoId: string) {
    this.form.equipoId = equipoId;
    this.dropdownAbierto.set(false);
  }

  cargar() {
    this.cargando.set(true);
    this.tareasSvc.getAll().subscribe({
      next: d => { this.tareas.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar tareas'); this.cargando.set(false); }
    });
  }

  private formVacio(): TareaForm {
    return { equipoId: '', tecnicoId: '', hora: '08:00', diasSemana: [], activa: true, fechaFin: '' };
  }

  abrirModalNueva() {
    this.form = this.formVacio();
    this.diasSeleccionados.set(new Set());
    this.gruposColapsados.set(new Set());
    this.dropdownAbierto.set(false);
    this.modoEdicion.set(false);
    this.editandoId = '';
    this.error.set('');
    this.mostrarModal.set(true);
  }

  abrirModalEditar(t: TareaProgramada) {
    this.form = {
      equipoId: t.equipoId,
      tecnicoId: t.tecnicoId || '',
      hora: t.hora,
      diasSemana: [...t.diasSemana],
      activa: t.activa,
      fechaFin: t.fechaFin || '',
    };
    this.diasSeleccionados.set(new Set(t.diasSemana));
    this.gruposColapsados.set(new Set());
    this.dropdownAbierto.set(false);
    this.editandoId = t.id;
    this.modoEdicion.set(true);
    this.error.set('');
    this.mostrarModal.set(true);
  }

  toggleDia(d: number) {
    const s = new Set(this.diasSeleccionados());
    if (s.has(d)) s.delete(d); else s.add(d);
    this.diasSeleccionados.set(s);
  }

  guardar() {
    const dias = [...this.diasSeleccionados()].sort();
    if (!this.form.equipoId) { this.error.set('Selecciona un equipo'); return; }
    if (!dias.length) { this.error.set('Selecciona al menos un día'); return; }
    if (!this.form.hora) { this.error.set('Indica la hora'); return; }

    const payload: TareaForm = {
      ...this.form,
      tecnicoId: this.form.tecnicoId || undefined,
      diasSemana: dias,
      fechaFin: this.form.fechaFin || undefined,
    };

    this.guardando.set(true);
    const obs = this.modoEdicion()
      ? this.tareasSvc.update(this.editandoId, payload)
      : this.tareasSvc.create(payload);

    obs.subscribe({
      next: () => { this.guardando.set(false); this.mostrarModal.set(false); this.cargar(); },
      error: () => { this.guardando.set(false); this.error.set('Error al guardar la tarea'); }
    });
  }

  toggle(t: TareaProgramada) {
    this.tareasSvc.toggle(t.id).subscribe({ next: () => this.cargar() });
  }

  eliminar(t: TareaProgramada) {
    if (!confirm(`¿Eliminar la tarea programada para "${t.equipoNombre}"?`)) return;
    this.tareasSvc.deleteTarea(t.id).subscribe({ next: () => this.cargar() });
  }

  diasLabel(dias: number[]): string {
    if (!dias.length) return '—';
    return dias.sort().map(d => DIAS[d]).join(', ');
  }

  trackById(_: number, t: any) { return t.id; }
  trackByProyectoId(_: number, g: any) { return g.proyecto.id; }
}
