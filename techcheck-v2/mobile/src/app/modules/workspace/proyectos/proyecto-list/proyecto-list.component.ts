import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonSpinner,
  IonMenuButton,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  add, folderOpenOutline, pencilOutline, trashOutline,
  chevronForwardOutline, downloadOutline, timeOutline, cloudUploadOutline,
} from 'ionicons/icons';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Proyecto } from '../../../../core/models/proyecto.model';
import { ProyectoFormModalComponent } from '../proyecto-form-modal/proyecto-form-modal.component';

@Component({
  selector: 'app-proyecto-list',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonSpinner,
    IonMenuButton,
  ],
  templateUrl: './proyecto-list.component.html',
})
export class ProyectoListComponent implements OnInit {
  private readonly proyectoSvc = inject(ProyectoService);
  private readonly auth        = inject(AuthService);
  private readonly modalCtrl   = inject(ModalController);
  private readonly alertCtrl   = inject(AlertController);
  private readonly toastCtrl   = inject(ToastController);
  private readonly router      = inject(Router);

  readonly proyectos = signal<Proyecto[]>([]);
  readonly loading   = signal(false);
  readonly isAdmin   = this.auth.isAdmin;

  constructor() {
    addIcons({ add, folderOpenOutline, pencilOutline, trashOutline, chevronForwardOutline, downloadOutline, timeOutline, cloudUploadOutline });
  }

  ngOnInit() { this.load(); }

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
    const modal = await this.modalCtrl.create({
      component: ProyectoFormModalComponent,
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
  }

  async openEdit(p: Proyecto, event: Event) {
    event.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: ProyectoFormModalComponent,
      componentProps: { proyecto: p },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.load();
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

  // ── Exportar proyecto ────────────────────────────────────────────────────────

  async exportar(p: Proyecto, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: `Exportar "${p.nombre}"`,
      message: 'Elige el formato de exportación',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'JSON (completo)',  handler: () => this.exportarJSON(p) },
        { text: 'CSV (resumen)',    handler: () => this.exportarCSV(p) },
      ],
    });
    await alert.present();
  }

  private exportarJSON(p: Proyecto) {
    this.proyectoSvc.exportarJSON(p.id).subscribe({
      next: async (datos) => {
        try {
          const filename = `${p.nombre.replace(/\s+/g, '_')}_proyecto_techcheck.json`;
          const content = btoa(unescape(encodeURIComponent(JSON.stringify(datos, null, 2))));
          await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache });
          const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
          await Share.share({ title: filename, url: uri, dialogTitle: 'Compartir proyecto JSON' });
        } catch {
          this.toast('Error al compartir el archivo', 'danger');
        }
      },
      error: () => this.toast('Error al exportar JSON', 'danger'),
    });
  }

  private exportarCSV(p: Proyecto) {
    this.proyectoSvc.exportarCSV(p.id).subscribe({
      next: async (blob) => {
        try {
          const filename = `${p.nombre.replace(/\s+/g, '_')}_proyecto_techcheck.csv`;
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = (e.target!.result as string).split(',')[1];
            await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
            const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
            await Share.share({ title: filename, url: uri, dialogTitle: 'Compartir proyecto CSV' });
          };
          reader.readAsDataURL(blob);
        } catch {
          this.toast('Error al compartir el archivo', 'danger');
        }
      },
      error: () => this.toast('Error al exportar CSV', 'danger'),
    });
  }

  // ── Importar proyecto JSON ───────────────────────────────────────────────────

  triggerImportInput() {
    const input = document.getElementById('proyecto-import-input') as HTMLInputElement;
    input?.click();
  }

  onImportFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
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
