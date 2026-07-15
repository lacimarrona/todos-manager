import { Component, Input, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption,
  IonBadge, IonSpinner, IonText, IonNote,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { ProyectoService, ProyectoPermiso } from '../../../../core/services/proyecto.service';
import { UserService } from '../../../../core/services/user.service';
import { Proyecto } from '../../../../core/models/proyecto.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-proyecto-permisos-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption,
    IonBadge, IonSpinner, IonText, IonNote,
  ],
  templateUrl: './proyecto-permisos-modal.component.html',
})
export class ProyectoPermisosModalComponent implements OnInit {
  @Input() proyecto!: Proyecto;

  private readonly proyectoSvc = inject(ProyectoService);
  private readonly userSvc     = inject(UserService);
  private readonly modalCtrl   = inject(ModalController);
  private readonly toastCtrl   = inject(ToastController);

  readonly loading    = signal(false);
  readonly saving     = signal(false);
  readonly restringido = signal(false);
  readonly usuarios   = signal<User[]>([]);
  // mapa: usuario_id → nivel ('ver' | 'editar' | null = sin acceso)
  readonly permisos   = signal<Map<number, 'ver' | 'editar'>>(new Map());

  ngOnInit() {
    this.restringido.set(this.proyecto.restringido);
    this.loading.set(true);

    Promise.all([
      new Promise<void>(resolve =>
        this.proyectoSvc.getPermissions(this.proyecto.id).subscribe({
          next: data => {
            const m = new Map<number, 'ver' | 'editar'>();
            data.permisos.forEach(p => m.set(p.usuario_id, p.nivel));
            this.permisos.set(m);
            resolve();
          },
          error: () => resolve(),
        })
      ),
      new Promise<void>(resolve =>
        this.userSvc.list().subscribe({
          next: us => {
            // Solo usuarios del workspace activo (excluye superadmins y admins del mismo ws)
            this.usuarios.set(us.filter(u => u.rol !== 'superadmin'));
            resolve();
          },
          error: () => resolve(),
        })
      ),
    ]).finally(() => this.loading.set(false));
  }

  getPermiso(uid: number): 'ver' | 'editar' | null {
    return this.permisos().get(uid) ?? null;
  }

  setPermiso(uid: number, nivel: 'ver' | 'editar' | null) {
    const m = new Map(this.permisos());
    if (nivel === null) {
      m.delete(uid);
    } else {
      m.set(uid, nivel);
    }
    this.permisos.set(m);
  }

  async save() {
    if (this.saving()) return;
    this.saving.set(true);

    const permisos: ProyectoPermiso[] = [];
    this.permisos().forEach((nivel, usuario_id) => permisos.push({ usuario_id, nivel }));

    this.proyectoSvc.updatePermissions(this.proyecto.id, {
      restringido: this.restringido(),
      permisos,
    }).subscribe({
      next: async () => {
        this.saving.set(false);
        this.modalCtrl.dismiss(null, 'saved');
        const t = await this.toastCtrl.create({ message: 'Permisos actualizados', duration: 2500, color: 'success' });
        await t.present();
      },
      error: async err => {
        this.saving.set(false);
        const t = await this.toastCtrl.create({
          message: err?.error?.error ?? 'Error al guardar permisos',
          duration: 3000, color: 'danger',
        });
        await t.present();
      },
    });
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }
}
