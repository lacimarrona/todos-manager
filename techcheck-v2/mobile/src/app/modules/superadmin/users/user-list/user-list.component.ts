import { Component, OnInit, signal, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonItem, IonLabel, IonBadge, IonSelect, IonSelectOption,
  IonSpinner,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, pencilOutline, trashOutline, arrowBackOutline, logOutOutline } from 'ionicons/icons';
import { UserService } from '../../../../core/services/user.service';
import { WorkspaceService } from '../../../../core/services/workspace.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/models/user.model';
import { Workspace } from '../../../../core/models/workspace.model';
import { SuperadminUserFormModalComponent } from '../user-form-modal/user-form-modal.component';
import { NavController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-superadmin-user-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonItem, IonLabel, IonBadge, IonSelect, IonSelectOption,
    IonSpinner,
  ],
  templateUrl: './user-list.component.html',
})
export class SuperadminUserListComponent implements OnInit {
  private readonly userSvc   = inject(UserService);
  private readonly wsSvc     = inject(WorkspaceService);
  private readonly auth      = inject(AuthService);
  private readonly navCtrl   = inject(NavController);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly users      = signal<User[]>([]);
  readonly workspaces = signal<Workspace[]>([]);
  readonly loading    = signal(false);
  readonly filtroWs   = signal<number | null>(null);

  constructor() {
    addIcons({ add, pencilOutline, trashOutline, arrowBackOutline, logOutOutline });
  }

  ngOnInit() {
    this.wsSvc.list().subscribe({ next: ws => this.workspaces.set(ws) });
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    const wsId = this.filtroWs() ?? undefined;
    this.userSvc.list(wsId).subscribe({
      next:  us => { this.users.set(us); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.toast('Error al cargar usuarios', 'danger'); },
    });
  }

  onFiltroChange(event: Event) {
    const v = (event as CustomEvent<{ value: number | null }>).detail.value;
    this.filtroWs.set(v || null);
    this.loadUsers();
  }

  rolColor(rol: string): string {
    const map: Record<string, string> = { superadmin: 'danger', admin: 'warning', usuario: 'primary' };
    return map[rol] ?? 'medium';
  }

  rolLabel(rol: string): string {
    const map: Record<string, string> = { superadmin: 'SuperAdmin', admin: 'Admin', usuario: 'Usuario' };
    return map[rol] ?? rol;
  }

  async openCreate() {
    const modal = await this.modalCtrl.create({
      component: SuperadminUserFormModalComponent,
      componentProps: { workspaces: this.workspaces() },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') { this.loadUsers(); this.toast('Usuario creado'); }
  }

  async openEdit(user: User) {
    const modal = await this.modalCtrl.create({
      component: SuperadminUserFormModalComponent,
      componentProps: { user, workspaces: this.workspaces() },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') { this.loadUsers(); this.toast('Usuario actualizado'); }
  }

  async confirmDelete(user: User) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: `¿Eliminar a "${user.nombre}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(user) },
      ],
    });
    await alert.present();
  }

  goBack()  { this.navCtrl.back(); }
  logout()  { this.auth.logout().subscribe(); }

  private delete(user: User) {
    this.userSvc.remove(user.id).subscribe({
      next:  () => {
        this.users.update(list => list.filter(u => u.id !== user.id));
        this.toast(`"${user.nombre}" eliminado`);
      },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
