import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonFab, IonFabButton, IonSpinner, IonMenuButton,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  add, folderOpenOutline, pencilOutline, trashOutline,
  chevronForwardOutline, downloadOutline, timeOutline, cloudUploadOutline, lockClosedOutline,
} from 'ionicons/icons';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Proyecto } from '../../../../core/models/proyecto.model';
import { ProyectoFormModalComponent } from '../proyecto-form-modal/proyecto-form-modal.component';
import { ProyectoPermisosModalComponent } from '../proyecto-permisos-modal/proyecto-permisos-modal.component';

@Component({
  selector: 'app-proyecto-list',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonFab, IonFabButton, IonSpinner, IonMenuButton,
  ],
  templateUrl: './proyecto-list.component.html',
})
export class ProyectoListComponent {
  private readonly proyectoSvc = inject(ProyectoService);
  private readonly auth        = inject(AuthService);
  private readonly modalCtrl   = inject(ModalController);
  private readonly alertCtrl   = inject(AlertController);
  private readonly toastCtrl   = inject(ToastController);
  private readonly router      = inject(Router);

  readonly proyectos = signal<Proyecto[]>([]);
  readonly loading   = signal(false);
  readonly isAdmin   = this.auth.isAdmin;

  private readonly activeWsId = computed(() => this.auth.user()?.workspace_id);

  constructor() {
    // Recargar proyectos cada vez que cambie el workspace activo
    effect(() => {
      const wsId = this.activeWsId();
      if (wsId) this.load();
    }, { allowSignalWrites: true });
    addIcons({ add, folderOpenOutline, pencilOutline, trashOutline, chevronForwardOutline, downloadOutline, timeOutline, cloudUploadOutline, lockClosedOutline });
  }

  async openPermisos(p: Proyecto, event: Event) {
    event.stopPropagation();
    try {
      const modal = await this.modalCtrl.create({
        component: ProyectoPermisosModalComponent,
        componentProps: { proyecto: p },
        cssClass: 'form-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'saved') this.load();
    } catch (err) {
      console.error('openPermisos error:', err);
      this.toast('Error al abrir permisos', 'danger');
    }
  }

  load() {
    this.loading.set(true);
    this.proyectoSvc.list().subscribe({
      next:  ps => { this.proyectos.set(ps); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.toast('Error al cargar proyectos', 'danger'); },
    });
  }

  openEquipos(p: Proyecto) {
    this.router.navigate(['/workspace/proyectos', p.id, 'equipos']);
  }

  openHistorial(p: Proyecto, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/workspace/proyectos', p.id, 'historial']);
  }

  async openCreate() {
    try {
      const modal = await this.modalCtrl.create({
        component: ProyectoFormModalComponent,
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

  async openEdit(p: Proyecto, event: Event) {
    event.stopPropagation();
    try {
      const modal = await this.modalCtrl.create({
        component: ProyectoFormModalComponent,
        componentProps: { proyecto: p },
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

  async confirmDelete(p: Proyecto, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Eliminar proyecto',
      message: `¿Eliminar "${p.nombre}"? Se eliminarán todos sus equipos y revisiones.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(p) },
      ],
    });
    await alert.present();
  }

  async exportar(p: Proyecto, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: `Exportar "${p.nombre}"`,
      message: 'Elige el formato de exportación',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'JSON (completo)',
          handler: () => {
            this.proyectoSvc.exportarJSON(p.id).subscribe({
              next: datos => {
                const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${p.nombre.replace(/\s+/g, '_')}_proyecto_techcheck.json`;
                a.click();
                URL.revokeObjectURL(url);
              },
              error: () => this.toast('Error al exportar JSON', 'danger'),
            });
          },
        },
        {
          text: 'CSV (Excel)',
          handler: () => {
            this.proyectoSvc.exportarCSV(p.id).subscribe({
              next: blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${p.nombre.replace(/\s+/g, '_')}_proyecto_techcheck.csv`;
                a.click();
                URL.revokeObjectURL(url);
              },
              error: () => this.toast('Error al exportar CSV', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async importarJSON(event: Event) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const datos = JSON.parse(e.target!.result as string);
          this.proyectoSvc.importarJSON(datos).subscribe({
            next: () => { this.load(); this.toast('Proyecto importado correctamente'); },
            error: err => this.toast(err?.error?.error ?? 'Error al importar', 'danger'),
          });
        } catch {
          this.toast('El archivo no es un JSON válido', 'danger');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  private delete(p: Proyecto) {
    this.proyectoSvc.remove(p.id).subscribe({
      next:  () => { this.proyectos.update(list => list.filter(x => x.id !== p.id)); this.toast(`"${p.nombre}" eliminado`); },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
