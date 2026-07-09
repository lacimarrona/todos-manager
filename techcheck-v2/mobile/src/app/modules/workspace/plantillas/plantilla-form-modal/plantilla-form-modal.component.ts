import { Component, Input, OnInit, HostListener, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonInput, IonTextarea, IonLabel, IonSpinner, IonNote,
  ModalController, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, add, trashOutline, cloudUploadOutline } from 'ionicons/icons';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { Plantilla } from '../../../../core/models/plantilla.model';

interface ItemLocal { id?: number; label: string; }

@Component({
  selector: 'app-plantilla-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
  private readonly alertCtrl = inject(AlertController);
  private readonly fb        = inject(FormBuilder);

  private originalItemCount = 0;

  readonly form = this.fb.nonNullable.group({
    nombre:      ['', Validators.required],
    descripcion: [''],
    newItem:     [''],
  });

  readonly items      = signal<ItemLocal[]>([]);
  readonly saving     = signal(false);
  readonly importing  = signal(false);
  readonly addingItem = signal(false);

  get isEdit() { return !!this.plantilla; }

  constructor() { addIcons({ close, add, trashOutline, cloudUploadOutline }); }

  @HostListener('ionInput') @HostListener('ionChange')
  onAnyInteraction() { this.form.markAsDirty(); }

  ngOnInit() {
    if (this.plantilla) {
      this.form.patchValue({ nombre: this.plantilla.nombre, descripcion: this.plantilla.descripcion ?? '' });
      this.items.set(this.plantilla.items.map(i => ({ id: i.id, label: i.label })));
      this.originalItemCount = this.plantilla.items.length;
      this.form.markAsPristine();
    }
  }

  async ionViewDidEnter() {
    const modal = await this.modalCtrl.getTop();
    if (!modal) return;
    modal.canDismiss = async (_data: unknown, role?: string) => {
      if (role === 'saved') return true;
      const dirty = this.form.dirty || this.items().length !== this.originalItemCount;
      if (dirty) return this.confirmSalir();
      return true;
    };
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  private async confirmSalir(): Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header: '¿Salir sin guardar?',
        message: 'Tienes cambios sin guardar. Si sales, se perderán.',
        backdropDismiss: false,
        buttons: [
          { text: 'Seguir editando',   role: 'cancel',      handler: () => resolve(false) },
          { text: 'Salir sin guardar', role: 'destructive',  handler: () => resolve(true)  },
        ],
      });
      await alert.present();
    });
  }

  addItem() {
    const label = (this.form.value.newItem ?? '').trim();
    if (!label) return;

    if (this.isEdit && this.plantilla) {
      this.addingItem.set(true);
      this.svc.addItem(this.plantilla.id, { label }).subscribe({
        next: item => {
          this.items.update(list => [...list, { id: item.id, label: item.label }]);
          this.form.patchValue({ newItem: '' });
          this.addingItem.set(false);
        },
        error: () => { this.addingItem.set(false); this.toast('Error al agregar ítem', 'danger'); },
      });
    } else {
      this.items.update(list => [...list, { label }]);
      this.form.patchValue({ newItem: '' });
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
        const newItems = result.items.map(label => ({ label }));
        this.items.update(list => [...list, ...newItems]);
        this.importing.set(false);
        this.toast(`${result.count} ítems importados desde Excel`);
      },
      error: err => { this.importing.set(false); this.toast(err?.error?.error ?? 'Error al importar', 'danger'); },
    });
    (event.target as HTMLInputElement).value = '';
  }

  submit() {
    if (this.form.get('nombre')?.invalid || this.saving()) return;
    const { nombre, descripcion } = this.form.getRawValue();
    this.saving.set(true);

    if (this.isEdit) {
      this.svc.update(this.plantilla!.id, { nombre, descripcion: descripcion || undefined }).subscribe({
        next: () => { this.saving.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.saving.set(false); this.toast(err?.error?.error ?? 'Error al guardar', 'danger'); },
      });
    } else {
      const items = this.items().map((it, i) => ({ label: it.label, orden: i }));
      this.svc.create({ nombre, descripcion: descripcion || undefined, items }).subscribe({
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
