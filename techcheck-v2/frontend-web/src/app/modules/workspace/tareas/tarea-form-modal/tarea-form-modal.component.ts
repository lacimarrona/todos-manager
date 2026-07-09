import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonInput, IonSpinner, IonText, IonSelect, IonSelectOption,
  IonCheckbox,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { TareaService } from '../../../../core/services/tarea.service';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { TareaProgramada } from '../../../../core/models/tarea.model';
import { Proyecto } from '../../../../core/models/proyecto.model';
import { Equipo } from '../../../../core/models/equipo.model';

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
  private readonly modalCtrl   = inject(ModalController);
  private readonly toastCtrl   = inject(ToastController);

  readonly DAYS = [
    { value: 0, label: 'Dom' }, { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' }, { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
  ];

  readonly proyectos    = signal<Proyecto[]>([]);
  readonly equipos      = signal<Equipo[]>([]);
  readonly selectedDays = signal<number[]>([]);
  readonly saving       = signal(false);
  readonly loadingEqs   = signal(false);
  readonly error        = signal<string | null>(null);
  readonly proyectoId   = signal<number>(0);
  readonly equipoId     = signal<number>(0);
  readonly hora         = signal('');

  readonly isValid = computed(() => {
    if (this.isEdit) return !!this.hora() && this.selectedDays().length > 0;
    return !!this.hora() && this.selectedDays().length > 0 && this.equipoId() > 0;
  });

  get isEdit() { return !!this.tarea; }

  constructor() { addIcons({ close }); }

  ngOnInit() {
    if (this.isEdit) {
      this.hora.set(this.tarea!.hora.substring(0, 5));
      this.selectedDays.set([...this.tarea!.dias_semana]);
    } else {
      this.proyectoSvc.list().subscribe({
        next: ps => this.proyectos.set(ps),
        error: () => this.toast('Error al cargar proyectos', 'danger'),
      });
    }
  }

  private loadEquipos(proyectoId: number) {
    this.loadingEqs.set(true);
    this.equipos.set([]);
    this.equipoId.set(0);
    this.proyectoSvc.listEquipos(proyectoId).subscribe({
      next:  eqs => { this.equipos.set(eqs); this.loadingEqs.set(false); },
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

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.saving()) return;
    this.error.set(null);
    this.saving.set(true);

    if (this.isEdit) {
      this.svc.update(this.tarea!.id, { hora: this.hora(), dias_semana: this.selectedDays() }).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      this.svc.create({ equipo_id: this.equipoId(), hora: this.hora(), dias_semana: this.selectedDays() }).subscribe({
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
