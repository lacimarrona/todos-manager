import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonInput, IonTextarea, IonLabel, IonSpinner, IonNote,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, add, trashOutline, cloudUploadOutline } from 'ionicons/icons';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { Plantilla } from '../../../../core/models/plantilla.model';

interface ItemLocal { id?: number; label: string; observacion_guia?: string; }

@Component({
  selector: 'app-plantilla-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonInput, IonTextarea, IonLabel, IonSpinner, IonNote,
  ],
  templateUrl: './plantilla-form-modal.component.html',
})
export class PlantillaFormModalComponent implements OnInit {
  @Input() plantilla?: Plantilla;

  private readonly svc       = inject(PlantillaService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);

  readonly nombre      = signal('');
  readonly descripcion = signal('');
  readonly newItem     = signal('');
  readonly items       = signal<ItemLocal[]>([]);
  readonly saving      = signal(false);
  readonly importing   = signal(false);
  readonly addingItem  = signal(false);
  readonly touched     = signal(false);

  readonly isValid = computed(() => this.nombre().trim().length > 0);

  get isEdit() { return !!this.plantilla; }

  constructor() {
    addIcons({ close, add, trashOutline, cloudUploadOutline });
  }

  ngOnInit() {
    if (this.plantilla) {
      this.nombre.set(this.plantilla.nombre);
      this.descripcion.set(this.plantilla.descripcion ?? '');
      this.items.set(this.plantilla.items.map(i => ({ id: i.id, label: i.label, observacion_guia: i.observacion_guia ?? '' })));
    }
  }

  addItem() {
    const label = this.newItem().trim();
    if (!label) return;

    if (this.isEdit && this.plantilla) {
      this.addingItem.set(true);
      this.svc.addItem(this.plantilla.id, { label }).subscribe({
        next: item => {
          this.items.update(list => [...list, { id: item.id, label: item.label }]);
          this.newItem.set('');
          this.addingItem.set(false);
        },
        error: () => { this.addingItem.set(false); this.toast('Error al agregar ítem', 'danger'); },
      });
    } else {
      this.items.update(list => [...list, { label }]);
      this.newItem.set('');
    }
  }

  removeItem(index: number) {
    const item = this.items()[index];
    if (this.isEdit && this.plantilla && item.id) {
      this.svc.removeItem(this.plantilla.id, item.id).subscribe({
        next:  () => this.items.update(list => list.filter((_, i) => i !== index)),
        error: () => this.toast('Error al eliminar ítem', 'danger'),
      });
    } else {
      this.items.update(list => list.filter((_, i) => i !== index));
    }
  }

  triggerImport() {
    (document.getElementById('excel-import') as HTMLInputElement)?.click();
  }

  onExcelSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importing.set(true);
    this.svc.importarExcel(file).subscribe({
      next: result => {
        this.items.update(list => [...list, ...result.items.map(label => ({ label }))]);
        this.importing.set(false);
        this.toast(`${result.count} ítems importados desde Excel`);
      },
      error: err => { this.importing.set(false); this.toast(err?.error?.error ?? 'Error al importar', 'danger'); },
    });
    (event.target as HTMLInputElement).value = '';
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    this.touched.set(true);
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);

    if (this.isEdit) {
      this.svc.update(this.plantilla!.id, {
        nombre:      this.nombre(),
        descripcion: this.descripcion() || undefined,
      }).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.toast(err?.error?.error ?? 'Error al guardar', 'danger'); },
      });
    } else {
      const items = this.items().map((it, i) => ({ label: it.label, observacion_guia: it.observacion_guia || undefined, orden: i }));
      this.svc.create({
        nombre:      this.nombre(),
        descripcion: this.descripcion() || undefined,
        items,
      }).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.toast(err?.error?.error ?? 'Error al crear plantilla', 'danger'); },
      });
    }
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
