import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { map, forkJoin, switchMap, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario, UsuarioForm, ApiResponse, Proyecto, Equipo, TareaProgramada } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';

interface PermisoProyecto { proyectoId: string; nivel: 'ver' | 'asignados'; }
interface EquipoConProyecto extends Equipo { proyectoNombre: string; }

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  private url = `${environment.apiUrl}/usuarios`;

  usuarios = signal<Usuario[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');

  mostrarModal = signal(false);
  usuarioEditar: Usuario | null = null;

  form: UsuarioForm & { passwordConfirm?: string } = {
    nombre: '', username: '', password: '', rol: 'tecnico', activo: true
  };
  formError = signal('');

  // Proyectos para asignar al técnico dentro del modal de crear/editar
  proyectosForm = signal<Proyecto[]>([]);
  permisosForm = signal<Map<string, 'ver' | 'asignados'>>(new Map());
  cargandoProyectosForm = signal(false);

  cargarProyectosParaForm(usuarioId?: string) {
    if (this.form.rol !== 'tecnico') {
      this.proyectosForm.set([]);
      this.permisosForm.set(new Map());
      return;
    }
    this.cargandoProyectosForm.set(true);
    const proyObs = this.http.get<ApiResponse<Proyecto[]>>(`${environment.apiUrl}/proyectos`).pipe(map(r => r.data || []));
    const permObs = usuarioId
      ? this.http.get<ApiResponse<PermisoProyecto[]>>(`${this.url}/${usuarioId}/permisos-proyectos`).pipe(map(r => r.data || []))
      : of([]);

    forkJoin({ proyectos: proyObs, permisos: permObs }).subscribe({
      next: ({ proyectos, permisos }) => {
        this.proyectosForm.set(proyectos);
        const map = new Map<string, 'ver' | 'asignados'>();
        for (const p of permisos) map.set(p.proyectoId, p.nivel as 'ver' | 'asignados');
        this.permisosForm.set(map);
        this.cargandoProyectosForm.set(false);
      },
      error: () => this.cargandoProyectosForm.set(false)
    });
  }

  toggleProyectoForm(proyectoId: string) {
    const m = new Map(this.permisosForm());
    if (m.has(proyectoId)) {
      m.delete(proyectoId);
    } else {
      m.set(proyectoId, 'ver');
    }
    this.permisosForm.set(m);
  }

  setNivelForm(proyectoId: string, nivel: string) {
    const m = new Map(this.permisosForm());
    m.set(proyectoId, nivel as 'ver' | 'asignados');
    this.permisosForm.set(m);
  }

  onRolChange() {
    if (this.form.rol === 'tecnico') {
      this.cargarProyectosParaForm(this.usuarioEditar?.id);
    } else {
      this.proyectosForm.set([]);
      this.permisosForm.set(new Map());
    }
  }

  // Modal cambiar contraseña propio
  mostrarCambiarPwd = signal(false);
  pwdActual = '';
  pwdNuevo = '';
  pwdConfirm = '';
  pwdError = signal('');
  pwdOk = signal('');
  guardandoPwd = signal(false);

  // Modal asignar proyectos a project_admin
  mostrarAsignaciones = signal(false);
  usuarioAsignaciones: Usuario | null = null;
  todosProyectos = signal<Proyecto[]>([]);
  proyectosAsignados = signal<Set<string>>(new Set());
  cargandoAsignaciones = signal(false);

  toggleProyecto(proyectoId: string) {
    const set = new Set(this.proyectosAsignados());
    const url = `${environment.apiUrl}/proyectos/${proyectoId}/asignaciones`;
    if (set.has(proyectoId)) {
      this.http.delete<ApiResponse<void>>(`${url}/${this.usuarioAsignaciones!.id}`).subscribe({
        next: () => { set.delete(proyectoId); this.proyectosAsignados.set(new Set(set)); },
        error: (err) => alert(err?.error?.message || 'Error al desasignar')
      });
    } else {
      this.http.post<ApiResponse<void>>(url, { usuarioId: this.usuarioAsignaciones!.id }).subscribe({
        next: () => { set.add(proyectoId); this.proyectosAsignados.set(new Set(set)); },
        error: (err) => alert(err?.error?.message || 'Error al asignar')
      });
    }
  }

  abrirAsignaciones(u: Usuario) {
    this.usuarioAsignaciones = u;
    this.cargandoAsignaciones.set(true);
    this.mostrarAsignaciones.set(true);
    forkJoin({
      todos: this.http.get<ApiResponse<Proyecto[]>>(`${environment.apiUrl}/proyectos`).pipe(map(r => r.data || [])),
      asignados: this.http.get<ApiResponse<Proyecto[]>>(`${environment.apiUrl}/usuarios/${u.id}/proyectos`).pipe(map(r => r.data || []))
    }).subscribe({
      next: ({ todos, asignados }) => {
        this.todosProyectos.set(todos);
        this.proyectosAsignados.set(new Set(asignados.map((p: Proyecto) => p.id)));
        this.cargandoAsignaciones.set(false);
      },
      error: () => { this.cargandoAsignaciones.set(false); alert('Error al cargar proyectos'); }
    });
  }

  // Modal gestionar supervisores de un técnico (admin asigna a qué project_admin pertenece)
  mostrarSupervisores = signal(false);
  usuarioSupervisores: Usuario | null = null;
  todosProjectAdmins = signal<Usuario[]>([]);
  supervisoresAsignados = signal<Set<string>>(new Set());
  cargandoSupervisores = signal(false);

  toggleSupervisor(supervisorId: string) {
    const set = new Set(this.supervisoresAsignados());
    const tecnicoId = this.usuarioSupervisores!.id;
    if (set.has(supervisorId)) {
      this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/usuarios/${tecnicoId}/supervisores/${supervisorId}`).subscribe({
        next: () => { set.delete(supervisorId); this.supervisoresAsignados.set(new Set(set)); },
        error: (err) => alert(err?.error?.message || 'Error al quitar supervisor')
      });
    } else {
      this.http.post<ApiResponse<void>>(`${environment.apiUrl}/usuarios/${tecnicoId}/supervisores`, { supervisorId }).subscribe({
        next: () => { set.add(supervisorId); this.supervisoresAsignados.set(new Set(set)); },
        error: (err) => alert(err?.error?.message || 'Error al asignar supervisor')
      });
    }
  }

  abrirSupervisores(u: Usuario) {
    this.usuarioSupervisores = u;
    this.cargandoSupervisores.set(true);
    this.mostrarSupervisores.set(true);
    forkJoin({
      todos: this.http.get<ApiResponse<Usuario[]>>(`${environment.apiUrl}/usuarios`).pipe(map(r => (r.data || []).filter(x => x.rol === 'project_admin'))),
      asignados: this.http.get<ApiResponse<Usuario[]>>(`${environment.apiUrl}/usuarios/${u.id}/supervisores`).pipe(map(r => r.data || []))
    }).subscribe({
      next: ({ todos, asignados }) => {
        this.todosProjectAdmins.set(todos);
        this.supervisoresAsignados.set(new Set(asignados.map(s => s.id)));
        this.cargandoSupervisores.set(false);
      },
      error: () => { this.cargandoSupervisores.set(false); alert('Error al cargar administradores de proyectos'); }
    });
  }

  // ── Permisos especiales de técnicos ─────────────────────────────────────────
  mostrarPermisosEspeciales = signal(false);
  usuarioPermisos: Usuario | null = null;
  permisosEspecialesActuales = signal<Set<string>>(new Set());
  guardandoPermisos = signal(false);

  readonly PERMISOS_ESPECIALES = [
    { id: 'editar_plantillas', label: 'Editar plantillas', desc: 'Puede crear y modificar plantillas en sus proyectos' },
    { id: 'eliminar_plantillas', label: 'Eliminar plantillas', desc: 'Puede eliminar plantillas en sus proyectos' },
    { id: 'asignar_tareas', label: 'Asignar tareas', desc: 'Puede asignar tareas programadas a otros técnicos' },
  ];

  abrirPermisosEspeciales(u: Usuario) {
    this.usuarioPermisos = u;
    this.guardandoPermisos.set(false);
    this.mostrarPermisosEspeciales.set(true);
    this.http.get<ApiResponse<string[]>>(`${this.url}/${u.id}/permisos-especiales`).pipe(map(r => r.data || [])).subscribe({
      next: permisos => this.permisosEspecialesActuales.set(new Set(permisos)),
      error: () => alert('Error al cargar permisos')
    });
  }

  togglePermisoEspecial(permiso: string) {
    const set = new Set(this.permisosEspecialesActuales());
    if (set.has(permiso)) set.delete(permiso);
    else set.add(permiso);
    this.permisosEspecialesActuales.set(set);
  }

  guardarPermisosEspeciales() {
    if (!this.usuarioPermisos) return;
    this.guardandoPermisos.set(true);
    const permisos = Array.from(this.permisosEspecialesActuales());
    this.http.put<ApiResponse<void>>(`${this.url}/${this.usuarioPermisos.id}/permisos-especiales`, { permisos }).subscribe({
      next: () => { this.guardandoPermisos.set(false); this.mostrarPermisosEspeciales.set(false); },
      error: (err) => { this.guardandoPermisos.set(false); alert(err?.error?.message || 'Error al guardar permisos'); }
    });
  }

  // ── Horario semanal del técnico ─────────────────────────────────────────────
  readonly DIAS = [
    { num: 0, label: 'Lun', full: 'Lunes' },
    { num: 1, label: 'Mar', full: 'Martes' },
    { num: 2, label: 'Mié', full: 'Miércoles' },
    { num: 3, label: 'Jue', full: 'Jueves' },
    { num: 4, label: 'Vie', full: 'Viernes' },
    { num: 5, label: 'Sáb', full: 'Sábado' },
    { num: 6, label: 'Dom', full: 'Domingo' },
  ];

  mostrarHorario = signal(false);
  usuarioHorario: Usuario | null = null;
  tareasHorario = signal<TareaProgramada[]>([]);
  equiposDisponibles = signal<EquipoConProyecto[]>([]);
  diaActivo = signal(0);
  cargandoHorario = signal(false);

  mostrarFormTarea = signal(false);
  ntEquipoId = '';
  ntHora = '';
  ntDias = signal<Set<number>>(new Set());
  guardandoTarea = signal(false);
  errorTarea = signal('');

  abrirHorario(u: Usuario) {
    this.usuarioHorario = u;
    this.diaActivo.set(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // lun=0
    this.mostrarHorario.set(true);
    this.mostrarFormTarea.set(false);
    this.cargandoHorario.set(true);
    forkJoin({
      tareas: this.http.get<ApiResponse<TareaProgramada[]>>(`${this.url}/${u.id}/tareas`).pipe(map(r => r.data || [])),
      equipos: this.http.get<ApiResponse<EquipoConProyecto[]>>(`${this.url}/${u.id}/equipos-disponibles`).pipe(map(r => r.data || []))
    }).subscribe({
      next: ({ tareas, equipos }) => {
        this.tareasHorario.set(tareas);
        this.equiposDisponibles.set(equipos);
        this.cargandoHorario.set(false);
      },
      error: () => { this.cargandoHorario.set(false); alert('Error al cargar horario'); }
    });
  }

  tareasDeDia(dia: number): TareaProgramada[] {
    return this.tareasHorario().filter(t => t.diasSemana.includes(dia));
  }

  tareasCount(dia: number): number {
    return this.tareasDeDia(dia).length;
  }

  abrirFormTarea() {
    this.ntEquipoId = '';
    this.ntHora = '08:00';
    this.ntDias.set(new Set([this.diaActivo()]));
    this.errorTarea.set('');
    this.mostrarFormTarea.set(true);
  }

  toggleDiaNT(dia: number) {
    const s = new Set(this.ntDias());
    s.has(dia) ? s.delete(dia) : s.add(dia);
    this.ntDias.set(s);
  }

  agregarTarea() {
    this.errorTarea.set('');
    if (!this.ntEquipoId) { this.errorTarea.set('Selecciona un equipo'); return; }
    if (!this.ntDias().size) { this.errorTarea.set('Selecciona al menos un día'); return; }
    this.guardandoTarea.set(true);
    const body = {
      equipoId: this.ntEquipoId,
      tecnicoId: this.usuarioHorario!.id,
      hora: this.ntHora,
      diasSemana: Array.from(this.ntDias()),
      activa: true,
    };
    this.http.post<ApiResponse<TareaProgramada>>(`${environment.apiUrl}/tareas`, body).subscribe({
      next: (res) => {
        this.tareasHorario.update(t => [...t, res.data!]);
        this.mostrarFormTarea.set(false);
        this.guardandoTarea.set(false);
      },
      error: (err) => { this.errorTarea.set(err?.error?.message || 'Error al agregar'); this.guardandoTarea.set(false); }
    });
  }

  desasignarTarea(tarea: TareaProgramada) {
    if (!confirm(`¿Quitar a ${this.usuarioHorario?.nombre} de la tarea "${tarea.equipoNombre}" — ${tarea.hora}?`)) return;
    this.http.put<ApiResponse<TareaProgramada>>(`${environment.apiUrl}/tareas/${tarea.id}`, { tecnicoId: null }).subscribe({
      next: () => {
        this.tareasHorario.update(t => t.filter(x => x.id !== tarea.id));
      },
      error: () => alert('Error al quitar tarea')
    });
  }

  constructor(private http: HttpClient, public auth: AuthService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.http.get<ApiResponse<Usuario[]>>(this.url).pipe(map(r => r.data || [])).subscribe({
      next: (data) => { this.usuarios.set(data); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar usuarios'); this.cargando.set(false); }
    });
  }

  abrirNuevo() {
    this.usuarioEditar = null;
    this.form = { nombre: '', username: '', password: '', rol: 'tecnico', activo: true };
    this.formError.set('');
    this.permisosForm.set(new Map());
    this.mostrarModal.set(true);
    this.cargarProyectosParaForm();
  }

  abrirEditar(u: Usuario) {
    this.usuarioEditar = u;
    this.form = { nombre: u.nombre, username: u.username, password: '', rol: u.rol, activo: u.activo };
    this.formError.set('');
    this.permisosForm.set(new Map());
    this.mostrarModal.set(true);
    if (u.rol === 'tecnico') this.cargarProyectosParaForm(u.id);
  }

  cerrarModal() { this.mostrarModal.set(false); }

  rolesDisponibles(): { value: string; label: string }[] {
    if (this.auth.isAdmin()) {
      return [
        { value: 'tecnico', label: 'Técnico' },
        { value: 'project_admin', label: 'Administrador de Proyectos' },
        { value: 'admin', label: 'Administrador' },
      ];
    }
    return [{ value: 'tecnico', label: 'Técnico' }];
  }

  guardar() {
    this.formError.set('');
    if (!this.form.nombre.trim() || !this.form.username.trim()) {
      this.formError.set('Nombre y nombre de usuario son requeridos');
      return;
    }
    if (!this.usuarioEditar && !this.form.password) {
      this.formError.set('La contraseña es requerida al crear un usuario');
      return;
    }
    if (this.form.password && this.form.password.length < 8) {
      this.formError.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const body: any = { nombre: this.form.nombre, username: this.form.username, rol: this.form.rol, activo: this.form.activo };
    if (this.form.password) body.password = this.form.password;

    this.guardando.set(true);

    const req = this.usuarioEditar
      ? this.http.put<ApiResponse<Usuario>>(`${this.url}/${this.usuarioEditar.id}`, body)
      : this.http.post<ApiResponse<Usuario>>(this.url, body);

    // Después de guardar el usuario, si es técnico guarda los permisos de proyectos
    req.pipe(
      switchMap(res => {
        const userId = (res as any).data?.id || this.usuarioEditar?.id;
        if (this.form.rol === 'tecnico' && userId) {
          const permisos: PermisoProyecto[] = [];
          this.permisosForm().forEach((nivel, proyectoId) => permisos.push({ proyectoId, nivel }));
          return this.http.put<ApiResponse<void>>(`${this.url}/${userId}/permisos-proyectos`, { permisos });
        }
        return of(null);
      })
    ).subscribe({
      next: () => { this.cerrarModal(); this.cargar(); this.guardando.set(false); },
      error: (err) => { this.formError.set(err?.error?.message || 'Error al guardar'); this.guardando.set(false); }
    });
  }

  eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar el usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.http.delete<ApiResponse<void>>(`${this.url}/${u.id}`).subscribe({
      next: () => this.cargar(),
      error: (err) => alert(err?.error?.message || 'Error al eliminar')
    });
  }

  toggleActivo(u: Usuario) {
    this.http.put<ApiResponse<Usuario>>(`${this.url}/${u.id}`, { activo: !u.activo }).subscribe({
      next: () => this.cargar(),
      error: () => alert('Error al actualizar estado')
    });
  }

  abrirCambiarPwd() {
    this.pwdActual = ''; this.pwdNuevo = ''; this.pwdConfirm = '';
    this.pwdError.set(''); this.pwdOk.set('');
    this.mostrarCambiarPwd.set(true);
  }

  guardarPwd() {
    this.pwdError.set(''); this.pwdOk.set('');
    if (!this.pwdActual || !this.pwdNuevo) { this.pwdError.set('Completa todos los campos'); return; }
    if (this.pwdNuevo !== this.pwdConfirm) { this.pwdError.set('Las contraseñas no coinciden'); return; }
    if (this.pwdNuevo.length < 8) { this.pwdError.set('Mínimo 8 caracteres'); return; }
    this.guardandoPwd.set(true);
    this.auth.changePassword(this.pwdActual, this.pwdNuevo).subscribe({
      next: () => {
        this.pwdOk.set('Contraseña actualizada. Iniciando sesión nuevamente...');
        this.guardandoPwd.set(false);
        setTimeout(() => this.auth._clearSession(), 1500);
      },
      error: (err) => { this.pwdError.set(err?.error?.message || 'Error al cambiar contraseña'); this.guardandoPwd.set(false); }
    });
  }
}
