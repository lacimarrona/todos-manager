import { Component, OnInit, signal, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonSpinner, IonBadge,
  IonMenuButton,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, documentTextOutline, trashOutline, pencilOutline } from 'ionicons/icons';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Plantilla } from '../../../../core/models/plantilla.model';
import { PlantillaFormModalComponent } from '../plantilla-form-modal/plantilla-form-modal.component';

@Component({
  selector: 'app-plantilla-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonSpinner, IonBadge,
    IonMenuButton,
  ],
  templateUrl: './plantilla-list.component.html',
})
export class PlantillaListComponent implements OnInit {
  private readonly svc       = inject(PlantillaService);
  private readonly auth      = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly plantillas = signal<Plantilla[]>([]);
  readonly loading    = signal(false);
  readonly isAdmin    = this.auth.isAdmin;

  constructor() {
    addIcons({ add, documentTextOutline, trashOutline, pencilOutline });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list().subscribe({
      next:  list => { this.plantillas.set(list); this.loading.set(false); },
      error: ()   => { this.loading.set(false); this.toast('Error al cargar plantillas', 'danger'); },
    });
  }

  async openCreate() {
    const modal = await this.modalCtrl.create({
      component: PlantillaFormModalComponent,
      cssClass: 'plantilla-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  async openEdit(p: Plantilla, event: Event) {
    event.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: PlantillaFormModalComponent,
      componentProps: { plantilla: p },
      cssClass: 'plantilla-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  async confirmDelete(p: Plantilla, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Eliminar plantilla',
      message: `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(p) },
      ],
    });
    await alert.present();
  }

  private delete(p: Plantilla) {
    this.svc.remove(p.id).subscribe({
      next:  () => { this.plantillas.update(list => list.filter(x => x.id !== p.id)); this.toast('Plantilla eliminada'); },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
