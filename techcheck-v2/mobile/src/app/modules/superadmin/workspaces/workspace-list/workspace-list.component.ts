import { Component, OnInit, signal, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonBadge, IonSpinner, IonChip, IonLabel,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, pencilOutline, trashOutline, personAddOutline, businessOutline,
  peopleOutline, logOutOutline, personOutline, keyOutline, cloudOfflineOutline,
} from 'ionicons/icons';
import { WorkspaceService } from '../../../../core/services/workspace.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Workspace } from '../../../../core/models/workspace.model';
import { WorkspaceFormModalComponent } from '../workspace-form-modal/workspace-form-modal.component';
import { AssignAdminModalComponent } from '../assign-admin-modal/assign-admin-modal.component';
import { NavController } from '@ionic/angular/standalone';
import { ChangePasswordModalComponent } from '../../../workspace/shell/change-password-modal/change-password-modal.component';

const CACHE_KEY = 'tc_superadmin_workspaces';

@Component({
  selector: 'app-workspace-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonBadge, IonSpinner, IonChip, IonLabel,
  ],
  templateUrl: './workspace-list.component.html',
})
export class WorkspaceListComponent implements OnInit {
  private readonly wsSvc     = inject(WorkspaceService);
  private readonly auth      = inject(AuthService);
  private readonly navCtrl   = inject(NavController);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly workspaces = signal<Workspace[]>([]);
  readonly loading    = signal(false);
  readonly fromCache  = signal(false);

  constructor() {
    addIcons({ add, pencilOutline, trashOutline, personAddOutline, businessOutline, peopleOutline, logOutOutline, personOutline, keyOutline, cloudOfflineOutline });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.fromCache.set(false);
    this.wsSvc.list().subscribe({
      next: ws => {
        this.workspaces.set(ws);
        this.loading.set(false);
        Preferences.set({ key: CACHE_KEY, value: JSON.stringify(ws) });
      },
      error: () => this.loadFromCache(),
    });
  }

  private async loadFromCache() {
    const { value } = await Preferences.get({ key: CACHE_KEY });
    if (value) {
      this.workspaces.set(JSON.parse(value));
      this.fromCache.set(true);
    } else {
      this.toast('Sin conexión y sin datos en caché', 'danger');
    }
    this.loading.set(false);
  }

  async openCreate() {
    const modal = await this.modalCtrl.create({
      component: WorkspaceFormModalComponent,
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  async openEdit(ws: Workspace) {
    const modal = await this.modalCtrl.create({
      component: WorkspaceFormModalComponent,
      componentProps: { workspace: ws },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  async openAssignAdmin(ws: Workspace) {
    const modal = await this.modalCtrl.create({
      component: AssignAdminModalComponent,
      componentProps: { workspaceId: ws.id, workspaceName: ws.nombre },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.toast(`Admin asignado a "${ws.nombre}"`);
  }

  async confirmDelete(ws: Workspace) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar workspace',
      message: `¿Eliminar "${ws.nombre}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(ws) },
      ],
    });
    await alert.present();
  }

  goToUsers() { this.navCtrl.navigateForward('/superadmin/usuarios'); }

  async openChangePassword() {
    const modal = await this.modalCtrl.create({ component: ChangePasswordModalComponent });
    await modal.present();
  }

  logout() {
    this.auth.logout().subscribe();
  }

  private delete(ws: Workspace) {
    this.wsSvc.remove(ws.id).subscribe({
      next:  () => {
        this.workspaces.update(list => list.filter(w => w.id !== ws.id));
        this.toast(`"${ws.nombre}" eliminado`);
      },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
