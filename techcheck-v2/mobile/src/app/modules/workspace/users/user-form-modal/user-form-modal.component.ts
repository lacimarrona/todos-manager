import { Component, Input, OnInit, HostListener, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption, IonToggle, IonLabel,
  IonSpinner, IonText,
  ModalController, AlertController,
} from '@ionic/angular/standalone';
import { UserService, UpdateUserDto } from '../../../../core/services/user.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption, IonToggle, IonLabel,
    IonSpinner, IonText,
  ],
  templateUrl: './user-form-modal.component.html',
})
export class UserFormModalComponent implements OnInit {
  @Input() user?: User;

  private readonly userSvc   = inject(UserService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly fb        = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rol:      ['usuario', Validators.required],
    activo:   [true],
  });

  get isEdit() { return !!this.user; }

  @HostListener('ionInput') @HostListener('ionChange')
  onAnyInteraction() { this.form.markAsDirty(); }

  ngOnInit() {
    if (this.user) {
      this.form.patchValue({
        nombre: this.user.nombre,
        email:  this.user.email,
        rol:    this.user.rol,
        activo: this.user.activo,
      });
      this.form.controls.password.clearValidators();
      this.form.controls.password.updateValueAndValidity();
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

    if (this.isEdit) {
      const dto: UpdateUserDto = {
        nombre: val.nombre,
        email:  val.email,
        rol:    val.rol as User['rol'],
        activo: val.activo,
      };
      if (val.password) dto.password = val.password;

      this.userSvc.update(this.user!.id, dto).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      this.userSvc.create({
        nombre:   val.nombre,
        email:    val.email,
        password: val.password,
        rol:      val.rol as User['rol'],
      }).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al crear'); },
      });
    }
  }
}
