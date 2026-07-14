import { Component, OnInit, signal, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonItem, IonLabel, IonBadge, IonSelect, IonSelectOption,
  IonSpinner, IonChip,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, pencilOutline, trashOutline, arrowBackOutline, logOutOutline, cloudOfflineOutline } from 'ionicons/icons';
import { UserService } from '../../../../core/services/user.service';
import { WorkspaceService } from '../../../../core/services/workspace.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/models/user.model';
import { Workspace } from '../../../../core/models/workspace.model';
import { SuperadminUserFormModalComponent } from '../user-form-modal/user-form-modal.component';
import { NavController } from '@ionic/angular/standalone';

const CACHE_USERS_KEY = 'tc_superadmin_users';
const CACHE_WS_KEY    = 'tc_superadmin_workspaces';

@Component({
  selector: 'app-superadmin-user-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonItem, IonLabel, IonBadge, IonSelect, IonSelectOption,
    IonSpinner, IonChip,
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
  readonly fromCache  = signal(false);

  constructor() {
    addIcons({ add, pencilOutline, trashOutline, arrowBackOutline, logOutOutline, cloudOfflineOutline });
  }

  ngOnInit() {
    this.wsSvc.list().subscribe({
      next: ws => {
        this.workspaces.set(ws);
        Preferences.set({ key: CACHE_WS_KEY, value: JSON.stringify(ws) });
      },
      error: async () => {
        const { value } = await Preferences.get({ key: CACHE_WS_KEY });
        if (value) this.workspaces.set(JSON.parse(value));
      },
    });
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.fromCache.set(false);
    const wsId = this.filtroWs() ?? undefined;
    this.userSvc.list(wsId).subscribe({
      next: us => {
        this.users.set(us);
        this.loading.set(false);
        Preferences.set({ key: CACHE_USERS_KEY, value: JSON.stringify(us) });
      },
      error: () => this.loadUsersFromCache(),
    });
  }

  private async loadUsersFromCache() {
    const { value } = await Preferences.get({ key: CACHE_USERS_KEY });
    if (value) {
      this.users.set(JSON.parse(value));
      this.fromCache.set(true);
    } else {
      this.toast('Sin conexión y sin datos en caché', 'danger');
    }
    this.loading.set(false);
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
