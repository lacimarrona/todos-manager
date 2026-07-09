import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption, IonToggle, IonLabel,
  IonSpinner, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { UserService, UpdateUserDto } from '../../../../core/services/user.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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

  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);
  readonly nombre   = signal('');
  readonly email    = signal('');
  readonly password = signal('');
  readonly rol      = signal<string>('usuario');
  readonly activo   = signal(true);

  readonly isValid = computed(() => {
    const basicOk = this.nombre().trim().length > 0 && this.email().includes('@');
    if (this.isEdit) return basicOk;
    return basicOk && this.password().length >= 6;
  });

  get isEdit() { return !!this.user; }

  ngOnInit() {
    if (this.user) {
      this.nombre.set(this.user.nombre);
      this.email.set(this.user.email);
      this.rol.set(this.user.rol);
      this.activo.set(this.user.activo);
    }
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    if (this.isEdit) {
      const dto: UpdateUserDto = {
        nombre: this.nombre(),
        email:  this.email(),
        rol:    this.rol() as User['rol'],
        activo: this.activo(),
      };
      if (this.password()) dto.password = this.password();

      this.userSvc.update(this.user!.id, dto).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      this.userSvc.create({
        nombre:   this.nombre(),
        email:    this.email(),
        password: this.password(),
        rol:      this.rol() as User['rol'],
      }).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    }
  }
}
