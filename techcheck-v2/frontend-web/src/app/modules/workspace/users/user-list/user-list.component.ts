import { Component, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonSearchbar, IonBadge, IonFab, IonFabButton,
  IonSpinner, IonMenuButton,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, pencilOutline, trashOutline, personOutline } from 'ionicons/icons';
import { UserService } from '../../../../core/services/user.service';
import { User } from '../../../../core/models/user.model';
import { UserFormModalComponent } from '../user-form-modal/user-form-modal.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonSearchbar, IonBadge, IonFab, IonFabButton,
    IonSpinner, IonMenuButton,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private readonly userSvc   = inject(UserService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly users    = signal<User[]>([]);
  readonly loading  = signal(false);
  readonly query    = signal('');

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.users();
    return this.users().filter(u =>
      u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  constructor() {
    addIcons({ add, pencilOutline, trashOutline, personOutline });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.userSvc.list().subscribe({
      next:  us => { this.users.set(us); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.toast('Error al cargar usuarios', 'danger'); },
    });
  }

  async openCreate() {
    try {
      const modal = await this.modalCtrl.create({
        component: UserFormModalComponent,
        cssClass: 'form-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'saved') this.load();
    } catch (err) {
      console.error('openCreate error:', err);
      this.toast('Error al abrir el formulario', 'danger');
    }
  }

  async openEdit(user: User) {
    try {
      const modal = await this.modalCtrl.create({
        component: UserFormModalComponent,
        componentProps: { user },
        cssClass: 'form-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'saved') this.load();
    } catch (err) {
      console.error('openEdit error:', err);
      this.toast('Error al abrir el formulario', 'danger');
    }
  }

  async confirmDelete(user: User) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: `¿Eliminar a "${user.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(user) },
      ],
    });
    await alert.present();
  }

  rolColor(rol: string) {
    const map: Record<string, string> = { superadmin: 'warning', admin: 'primary', usuario: 'medium' };
    return map[rol] ?? 'medium';
  }

  initials(nombre: string) {
    return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

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
