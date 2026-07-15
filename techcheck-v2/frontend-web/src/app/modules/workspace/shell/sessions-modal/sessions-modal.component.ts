import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonLabel, IonIcon, IonSpinner, IonText,
  ModalController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  desktopOutline, phonePortraitOutline, trashOutline,
  warningOutline, refreshOutline,
} from 'ionicons/icons';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface Session {
  id: number;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
}

@Component({
  selector: 'app-sessions-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonLabel, IonIcon, IonSpinner, IonText,
  ],
  templateUrl: './sessions-modal.component.html',
})
export class SessionsModalComponent implements OnInit {
  private readonly http      = inject(HttpClient);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);

  readonly sessions = signal<Session[]>([]);
  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);

  constructor() {
    addIcons({ desktopOutline, phonePortraitOutline, trashOutline, warningOutline, refreshOutline });
  }

  ngOnInit() { this.loadSessions(); }

  dismiss() { this.modalCtrl.dismiss(); }

  private loadSessions() {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<Session[]>(`${environment.apiUrl}/auth/sessions`).subscribe({
      next: data => { this.sessions.set(data); this.loading.set(false); },
      error: () => { this.error.set('Error al cargar sesiones'); this.loading.set(false); },
    });
  }

  async revokeSession(id: number) {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesión',
      message: '¿Cerrar esta sesión en ese dispositivo?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar',
          role: 'confirm',
          handler: () => {
            this.http.delete(`${environment.apiUrl}/auth/sessions/${id}`).subscribe({
              next: () => this.loadSessions(),
              error: () => this.error.set('Error al cerrar sesión'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async revokeOthers() {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar otras sesiones',
      message: 'Se cerrarán todas las sesiones activas excepto la actual. Los otros dispositivos deberán volver a iniciar sesión.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar todo',
          cssClass: 'alert-button-danger',
          role: 'confirm',
          handler: () => {
            this.http.delete(`${environment.apiUrl}/auth/sessions`).subscribe({
              next: () => this.loadSessions(),
              error: () => this.error.set('Error al cerrar sesiones'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  deviceIcon(ua: string | null): string {
    if (!ua) return 'desktop-outline';
    return /android|iphone|mobile/i.test(ua) ? 'phone-portrait-outline' : 'desktop-outline';
  }

  deviceLabel(ua: string | null): string {
    if (!ua) return 'Dispositivo desconocido';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad/i.test(ua)) return 'iOS';
    if (/windows/i.test(ua)) return 'Windows';
    if (/mac os/i.test(ua)) return 'Mac';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Navegador';
  }
}
