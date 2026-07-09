import { Component, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Network } from '@capacitor/network';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonInputPasswordToggle, IonButton, IonSpinner, IonText,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, mailOutline, cloudOfflineOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonInputPasswordToggle, IonButton, IonSpinner, IonText, IonIcon,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly fb     = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly online  = signal(true);

  readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    addIcons({ lockClosedOutline, mailOutline, cloudOfflineOutline });
  }

  async ngOnInit() {
    const status = await Network.getStatus();
    this.online.set(status.connected);
    Network.addListener('networkStatusChange', s => this.online.set(s.connected));
  }

  async submit() {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const { email, password } = this.form.getRawValue();

    // Sin internet: login offline con hash local
    if (!this.online()) {
      const ok = await this.auth.loginOffline(email, password);
      this.loading.set(false);
      if (ok) {
        this.redirectAfterLogin();
      } else {
        this.error.set('Credenciales incorrectas o nunca has iniciado sesión desde este dispositivo.');
      }
      return;
    }

    // Con internet: login normal
    this.auth.login({ email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.redirectAfterLogin();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.error ?? 'Error al iniciar sesión. Verifica tus credenciales.',
        );
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
