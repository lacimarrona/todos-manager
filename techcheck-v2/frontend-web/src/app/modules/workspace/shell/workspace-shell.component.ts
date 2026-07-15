import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonList, IonItem, IonLabel, IonIcon, IonButton, IonBadge,
  IonRouterOutlet,
  MenuController, ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, folderOpenOutline, logOutOutline, personCircleOutline,
  documentTextOutline, timeOutline, constructOutline, keyOutline,
  swapHorizontalOutline, checkmarkCircleOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';
import { ChangePasswordModalComponent } from './change-password-modal/change-password-modal.component';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive,
    IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
    IonList, IonItem, IonLabel, IonIcon, IonButton, IonBadge,
    IonRouterOutlet,
  ],
  templateUrl: './workspace-shell.component.html',
})
export class WorkspaceShellComponent {
  readonly auth      = inject(AuthService);
  private menuCtrl   = inject(MenuController);
  private modalCtrl  = inject(ModalController);
  private toastCtrl  = inject(ToastController);

  readonly workspaces     = computed(() => this.auth.user()?.workspaces ?? []);
  readonly hasMultiWs     = computed(() => this.workspaces().length > 1);
  readonly activeWsId     = computed(() => this.auth.user()?.workspace_id);

  readonly navItems: NavItem[] = [
    { label: 'Proyectos',         icon: 'folder-open-outline',  path: '/workspace/proyectos' },
    { label: 'Plantillas',        icon: 'document-text-outline', path: '/workspace/plantillas' },
    { label: 'Tareas Programadas', icon: 'time-outline',         path: '/workspace/tareas' },
    { label: 'Técnicos',          icon: 'construct-outline',     path: '/workspace/tecnicos',  adminOnly: true },
    { label: 'Usuarios',          icon: 'people-outline',        path: '/workspace/usuarios', adminOnly: true },
  ];

  constructor() {
    addIcons({
      peopleOutline, folderOpenOutline, logOutOutline, personCircleOutline,
      documentTextOutline, timeOutline, constructOutline, keyOutline,
      swapHorizontalOutline, checkmarkCircleOutline,
    });
  }

  async closeMenu() { await this.menuCtrl.close('workspace-menu'); }
  logout() { this.auth.logout().subscribe(); }

  async openChangePassword() {
    await this.menuCtrl.close('workspace-menu');
    const modal = await this.modalCtrl.create({ component: ChangePasswordModalComponent });
    await modal.present();
  }

  switchWorkspace(wsId: number) {
    if (wsId === this.activeWsId()) return;
    this.auth.switchWorkspace(wsId).subscribe({
      next: async () => {
        await this.menuCtrl.close('workspace-menu');
        const t = await this.toastCtrl.create({ message: 'Workspace cambiado', duration: 2000, color: 'success' });
        await t.present();
      },
      error: async () => {
        const t = await this.toastCtrl.create({ message: 'Error al cambiar workspace', duration: 2500, color: 'danger' });
        await t.present();
      },
    });
  }
}
