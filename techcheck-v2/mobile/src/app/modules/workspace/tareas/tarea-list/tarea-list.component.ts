import { Component, OnInit, signal, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonSpinner, IonToggle,
  IonMenuButton,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, timeOutline, trashOutline, pencilOutline, toggleOutline } from 'ionicons/icons';
import { TareaService } from '../../../../core/services/tarea.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TareaProgramada } from '../../../../core/models/tarea.model';
import { TareaFormModalComponent } from '../tarea-form-modal/tarea-form-modal.component';

@Component({
  selector: 'app-tarea-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonSpinner, IonToggle,
    IonMenuButton,
  ],
  templateUrl: './tarea-list.component.html',
})
export class TareaListComponent implements OnInit {
  private readonly svc       = inject(TareaService);
  private readonly auth      = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly tareas  = signal<TareaProgramada[]>([]);
  readonly loading = signal(false);
  readonly isAdmin = this.auth.isAdmin;

  private readonly DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  constructor() {
    addIcons({ add, timeOutline, trashOutline, pencilOutline, toggleOutline });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list().subscribe({
      next:  list => { this.tareas.set(list); this.loading.set(false); },
      error: ()   => { this.loading.set(false); this.toast('Error al cargar tareas', 'danger'); },
    });
  }

  diasLabel(dias: number[]): string {
    return [...dias].sort().map(d => this.DAYS[d]).join(', ');
  }

  horaCorta(hora: string): string {
    return hora.substring(0, 5); // "HH:MM:SS" → "HH:MM"
  }

  async openCreate() {
    const modal = await this.modalCtrl.create({
      component: TareaFormModalComponent,
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  async openEdit(t: TareaProgramada, event: Event) {
    event.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: TareaFormModalComponent,
      componentProps: { tarea: t },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  toggleActiva(t: TareaProgramada, event: Event) {
    event.stopPropagation();
    const prev = t.activa;
    this.tareas.update(list => list.map(x => x.id === t.id ? { ...x, activa: !x.activa } : x));
    this.svc.toggle(t.id).subscribe({
      next: updated => this.tareas.update(list => list.map(x => x.id === t.id ? { ...x, activa: updated.activa } : x)),
      error: () => {
        this.tareas.update(list => list.map(x => x.id === t.id ? { ...x, activa: prev } : x));
        this.toast('Error al cambiar estado', 'danger');
      },
    });
  }

  async confirmDelete(t: TareaProgramada, event: Event) {
    event.stopPropagation();
    const nombre = t.equipo?.nombre ?? 'equipo';
    const alert = await this.alertCtrl.create({
      header: 'Eliminar tarea',
      message: `¿Eliminar la tarea programada de "${nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(t) },
      ],
    });
    await alert.present();
  }

  private delete(t: TareaProgramada) {
    this.svc.remove(t.id).subscribe({
      next:  () => { this.tareas.update(list => list.filter(x => x.id !== t.id)); this.toast('Tarea eliminada'); },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
