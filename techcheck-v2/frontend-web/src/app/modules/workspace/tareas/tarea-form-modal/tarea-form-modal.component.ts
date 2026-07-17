import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonInput, IonSpinner, IonText, IonSelect, IonSelectOption,
  IonCheckbox,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, calendarOutline, checkboxOutline } from 'ionicons/icons';
import { TareaService } from '../../../../core/services/tarea.service';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { GrupoElementoService, GrupoElemento } from '../../../../core/services/grupo-elemento.service';
import { TareaProgramada } from '../../../../core/models/tarea.model';
import { Proyecto } from '../../../../core/models/proyecto.model';
import { Equipo } from '../../../../core/models/equipo.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-tarea-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonInput, IonSpinner, IonText, IonSelect, IonSelectOption,
    IonCheckbox,
  ],
  templateUrl: './tarea-form-modal.component.html',
})
export class TareaFormModalComponent implements OnInit {
  @Input() tarea?: TareaProgramada;

  private readonly svc         = inject(TareaService);
  private readonly proyectoSvc = inject(ProyectoService);
  private readonly userSvc     = inject(UserService);
  private readonly grupoSvc    = inject(GrupoElementoService);
  private readonly auth        = inject(AuthService);
  private readonly modalCtrl   = inject(ModalController);
  private readonly toastCtrl   = inject(ToastController);

  readonly isAdmin = this.auth.isAdmin;

  readonly DAYS = [
    { value: 0, label: 'Dom' }, { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' }, { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
  ];

  readonly proyectos       = signal<Proyecto[]>([]);
  readonly equipos         = signal<Equipo[]>([]);
  readonly usuarios        = signal<User[]>([]);
  readonly grupos          = signal<GrupoElemento[]>([]);
  readonly selectedDays    = signal<number[]>([]);
  readonly saving          = signal(false);
  readonly loadingEqs      = signal(false);
  readonly error           = signal<string | null>(null);
  readonly proyectoId      = signal<number>(0);
  readonly equipoId        = signal<number>(0);
  readonly hora            = signal('');
  readonly asignadoAId     = signal<number | null>(null);
  readonly fechaFin        = signal<string>('');
  readonly grupoElementoId = signal<number | null>(null);

  readonly isValid = computed(() => {
    if (this.isEdit) return !!this.hora() && this.selectedDays().length > 0;
    return !!this.hora() && this.selectedDays().length > 0 && this.equipoId() > 0;
  });

  get isEdit() { return !!this.tarea; }

  constructor() { addIcons({ close, calendarOutline, checkboxOutline }); }

  ngOnInit() {
    if (this.isEdit) {
      this.hora.set(this.tarea!.hora.substring(0, 5));
      this.selectedDays.set([...this.tarea!.dias_semana]);
      this.asignadoAId.set(this.tarea!.asignado_a_id);
      this.fechaFin.set(this.tarea!.fecha_fin ?? '');
      this.grupoElementoId.set(this.tarea!.grupo_elemento_id ?? null);
    } else {
      this.proyectoSvc.list().subscribe({
        next: ps => this.proyectos.set(ps),
        error: () => this.toast('Error al cargar proyectos', 'danger'),
      });
    }
    if (this.isAdmin()) {
      this.userSvc.list().subscribe({
        next: us => this.usuarios.set(us.filter(u => u.rol !== 'superadmin')),
        error: () => {},
      });
      this.grupoSvc.listGrupos().subscribe({
        next: gs => this.grupos.set(gs.filter(g => g.activo)),
        error: () => {},
      });
    }
  }

  private loadEquipos(proyectoId: number) {
    this.loadingEqs.set(true);
    this.equipos.set([]);
    this.equipoId.set(0);
    this.proyectoSvc.listEquipos(proyectoId).subscribe({
      next:  resp => { this.equipos.set(resp.data); this.loadingEqs.set(false); },
      error: () => { this.loadingEqs.set(false); this.toast('Error al cargar equipos', 'danger'); },
    });
  }

  onProyectoChange(pid: number) {
    this.proyectoId.set(pid);
    if (pid && pid > 0) this.loadEquipos(pid);
    else { this.equipos.set([]); this.equipoId.set(0); }
  }

  isDaySelected(day: number): boolean { return this.selectedDays().includes(day); }

  toggleDay(day: number, event: Event) {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    this.selectedDays.update(days =>
      checked ? [...days, day].sort() : days.filter(d => d !== day)
    );
  }

  selectAllWeek() {
    this.selectedDays.set([0, 1, 2, 3, 4, 5, 6]);
  }

  onlyThisWeek() {
    // Selecciona todos los días Y pone fecha_fin al domingo más próximo
    this.selectedDays.set([0, 1, 2, 3, 4, 5, 6]);
    const hoy = new Date();
    const diasHastaDomingo = 7 - hoy.getDay(); // getDay() 0=dom, si ya es domingo = 7 (semana siguiente)
    const domingo = new Date(hoy);
    domingo.setDate(hoy.getDate() + (hoy.getDay() === 0 ? 0 : diasHastaDomingo));
    this.fechaFin.set(domingo.toISOString().slice(0, 10));
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.saving()) return;
    this.error.set(null);
    this.saving.set(true);

    const fechaFinVal    = this.fechaFin() || null;
    const asignadoId     = this.isAdmin() ? (this.asignadoAId() || null) : null;
    const grupoId        = this.isAdmin() ? (this.grupoElementoId() || null) : null;

    if (this.isEdit) {
      this.svc.update(this.tarea!.id, {
        hora:              this.hora(),
        dias_semana:       this.selectedDays(),
        asignado_a_id:     asignadoId,
        fecha_fin:         fechaFinVal,
        grupo_elemento_id: grupoId,
      } as any).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      this.svc.create({
        equipo_id:         this.equipoId(),
        hora:              this.hora(),
        dias_semana:       this.selectedDays(),
        asignado_a_id:     asignadoId,
        fecha_fin:         fechaFinVal,
        grupo_elemento_id: grupoId,
      } as any).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.error.set(err?.error?.error ?? 'Error al crear tarea'); },
      });
    }
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
