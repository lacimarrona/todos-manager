import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonSpinner, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonInputPasswordToggle, IonSpinner, IonText,
  ],
  templateUrl: './change-password-modal.component.html',
})
export class ChangePasswordModalComponent {
  private readonly authSvc   = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);

  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);
  readonly success   = signal(false);
  readonly actual    = signal('');
  readonly nuevo     = signal('');
  readonly confirmar = signal('');

  readonly isValid = () =>
    this.actual().length > 0 &&
    this.nuevo().length >= 6 &&
    this.nuevo() === this.confirmar();

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    this.authSvc.changePassword(this.actual(), this.nuevo()).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.modalCtrl.dismiss(null, 'saved'), 1500);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Error al cambiar contraseña');
      },
    });
  }
}
