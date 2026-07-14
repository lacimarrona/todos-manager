import { Component, Input, OnInit, HostListener, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonInput, IonSpinner, IonText, IonSelect, IonSelectOption,
  IonCheckbox,
  ModalController, ToastController, AlertController,
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
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonInput, IonSpinner, IonText, IonSelect, IonSelectOption,
    IonCheckbox,
  ],
  templateUrl: './tarea-form-modal.component.html',
})
export class TareaFormModalComponent implements OnInit {
  @Input() tarea?: TareaProgramada;

  private readonly svc          = inject(TareaService);
  private readonly proyectoSvc  = inject(ProyectoService);
  private readonly modalCtrl    = inject(ModalController);
  private readonly toastCtrl    = inject(ToastController);
  private readonly alertCtrl    = inject(AlertController);
  private readonly fb           = inject(FormBuilder);

  readonly DAYS = [
    { value: 0, label: 'Dom' }, { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' }, { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
  ];

  readonly form = this.fb.nonNullable.group({
    proyecto_id: [0 as number, [Validators.required, Validators.min(1)]],
    equipo_id:   [0 as number, [Validators.required, Validators.min(1)]],
    hora:        ['', [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
  });

  readonly proyectos    = signal<Proyecto[]>([]);
  readonly equipos      = signal<Equipo[]>([]);
  readonly selectedDays = signal<number[]>([]);
  readonly saving       = signal(false);
  readonly loadingEqs   = signal(false);
  readonly error        = signal<string | null>(null);

  get isEdit() { return !!this.tarea; }

  constructor() { addIcons({ close }); }

  // ionChange bubbles from checkboxes too, covering day selections
  @HostListener('ionInput') @HostListener('ionChange')
  onAnyInteraction() { this.form.markAsDirty(); }

  ngOnInit() {
    if (this.isEdit) {
      this.form.get('proyecto_id')!.clearValidators();
      this.form.get('equipo_id')!.clearValidators();
      this.form.get('proyecto_id')!.updateValueAndValidity();
      this.form.get('equipo_id')!.updateValueAndValidity();
      this.form.patchValue({ hora: this.tarea!.hora.substring(0, 5) });
      this.selectedDays.set([...this.tarea!.dias_semana]);
      this.form.markAsPristine();
    } else {
      this.proyectoSvc.list().subscribe({
        next: ps => this.proyectos.set(ps),
        error: () => this.toast('Error al cargar proyectos', 'danger'),
      });
      this.form.get('proyecto_id')!.valueChanges.subscribe(pid => {
        if (pid && pid > 0) this.loadEquipos(pid);
        else { this.equipos.set([]); this.form.patchValue({ equipo_id: 0 }); }
      });
    }
  }

  async ionViewDidEnter() {
    const modal = await this.modalCtrl.getTop();
    if (!modal) return;
    modal.canDismiss = async (_data: unknown, role?: string) => {
      if (role === 'saved') return true;
      if (this.form.dirty) return this.confirmSalir();
      return true;
    };
  }

  private loadEquipos(proyectoId: number) {
    this.loadingEqs.set(true);
    this.equipos.set([]);
    this.form.patchValue({ equipo_id: 0 });
    this.proyectoSvc.listEquipos(proyectoId).subscribe({
      next:  resp => { this.equipos.set(resp.data); this.loadingEqs.set(false); },
      error: () => { this.loadingEqs.set(false); this.toast('Error al cargar equipos', 'danger'); },
    });
  }

  isDaySelected(day: number): boolean { return this.selectedDays().includes(day); }

  toggleDay(day: number, event: Event) {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    this.selectedDays.update(days =>
      checked ? [...days, day].sort() : days.filter(d => d !== day)
    );
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  private async confirmSalir(): Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header: '¿Salir sin guardar?',
        message: 'Tienes cambios sin guardar. Si sales, se perderán.',
        backdropDismiss: false,
        buttons: [
          { text: 'Seguir editando',   role: 'cancel',      handler: () => resolve(false) },
          { text: 'Salir sin guardar', role: 'destructive',  handler: () => resolve(true)  },
        ],
      });
      await alert.present();
    });
  }

  submit() {
    const hora = this.form.value.hora ?? '';
    if (!hora || this.selectedDays().length === 0 || this.saving()) return;
    this.error.set(null);
    this.saving.set(true);

    if (this.isEdit) {
      this.svc.update(this.tarea!.id, { hora, dias_semana: this.selectedDays() }).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      const { equipo_id } = this.form.getRawValue();
      if (!equipo_id) { this.saving.set(false); return; }
      this.svc.create({ equipo_id, hora, dias_semana: this.selectedDays() }).subscribe({
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
