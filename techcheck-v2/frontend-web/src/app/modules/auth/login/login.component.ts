import { Component, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  lockClosedOutline, mailOutline, eyeOutline, eyeOffOutline, alertCircleOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);
  readonly showPwd  = signal(false);
  readonly email    = signal('');
  readonly password = signal('');

  readonly isValid = computed(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email()) && this.password().length >= 6;
  });

  constructor() {
    addIcons({ lockClosedOutline, mailOutline, eyeOutline, eyeOffOutline, alertCircleOutline });
  }

  togglePwd() { this.showPwd.update(v => !v); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    this.auth.login({ email: this.email(), password: this.password() }).subscribe({
      next: () => {
        this.loading.set(false);
        this.redirectAfterLogin();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Error al iniciar sesión. Verifica tus credenciales.');
      },
    });
  }

  private redirectAfterLogin() {
    const role = this.auth.role();
    if (role === 'superadmin') {
      this.router.navigate(['/superadmin']);
    } else {
      this.router.navigate(['/workspace']);
    }
  }
}
