import { Component, Input, OnInit, HostListener, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonTextarea, IonSpinner, IonText,
  ModalController, AlertController,
} from '@ionic/angular/standalone';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { Proyecto } from '../../../../core/models/proyecto.model';

@Component({
  selector: 'app-proyecto-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonTextarea, IonSpinner, IonText,
  ],
  templateUrl: './proyecto-form-modal.component.html',
})
export class ProyectoFormModalComponent implements OnInit {
  @Input() proyecto?: Proyecto;

  private readonly proyectoSvc = inject(ProyectoService);
  private readonly modalCtrl   = inject(ModalController);
  private readonly alertCtrl   = inject(AlertController);
  private readonly fb          = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre:      ['', Validators.required],
    descripcion: [''],
  });

  get isEdit() { return !!this.proyecto; }

  @HostListener('ionInput') @HostListener('ionChange')
  onAnyInteraction() { this.form.markAsDirty(); }

  ngOnInit() {
    if (this.proyecto) {
      this.form.patchValue({
        nombre:      this.proyecto.nombre,
        descripcion: this.proyecto.descripcion ?? '',
      });
      this.form.markAsPristine();
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
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const val = this.form.getRawValue();
    const req$ = this.isEdit
      ? this.proyectoSvc.update(this.proyecto!.id, val)
      : this.proyectoSvc.create(val);

    req$.subscribe({
      next: () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
      error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
    });
  }
}
