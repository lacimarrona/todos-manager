import { Component, Input, OnInit, signal, computed, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonSpinner, IonText, IonList,
  ModalController, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, trashOutline, chevronDownOutline, chevronUpOutline,
  cameraOutline, documentOutline, closeCircle,
} from 'ionicons/icons';
import { EquipoService, CreateEquipoDto, UpdateEquipoDto } from '../../../../core/services/equipo.service';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { UserService } from '../../../../core/services/user.service';
import { Equipo, ArchivoGuia } from '../../../../core/models/equipo.model';
import { Plantilla } from '../../../../core/models/plantilla.model';
import { User } from '../../../../core/models/user.model';

interface LocalItem {
  id?: number;
  label: string;
  observacion_guia: string;
  expanded: boolean;
  archivos: ArchivoGuia[];
  uploading: boolean;
}

@Component({
  selector: 'app-equipo-form-modal',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonSpinner, IonText, IonList,
  ],
  templateUrl: './equipo-form-modal.component.html',
})
export class EquipoFormModalComponent implements OnInit {
  @Input() equipo?: Equipo;
  @Input() proyectoId!: number;

  private readonly equipoSvc    = inject(EquipoService);
  private readonly plantillaSvc = inject(PlantillaService);
  private readonly userSvc      = inject(UserService);
  private readonly modalCtrl    = inject(ModalController);
  private readonly toastCtrl    = inject(ToastController);
  private readonly alertCtrl    = inject(AlertController);

  readonly loading      = signal(false);
  readonly loadingData  = signal(true);
  readonly touched      = signal(false);
  readonly error        = signal<string | null>(null);
  readonly nombre       = signal('');
  readonly plantillaId  = signal<number | null>(null);
  readonly tecnicoId    = signal<number | null>(null);
  readonly tiempoLimite = signal('');
  readonly localItems   = signal<LocalItem[]>([]);
  readonly nuevoLabel   = signal('');
  readonly nuevaObs     = signal('');

  readonly plantillas   = signal<Plantilla[]>([]);
  readonly tecnicos     = signal<User[]>([]);

  readonly isValid = computed(() => this.nombre().trim().length > 0);
  get isEdit() { return !!this.equipo; }

  constructor() {
    addIcons({ add, trashOutline, chevronDownOutline, chevronUpOutline, cameraOutline, documentOutline, closeCircle });
  }

  ngOnInit() {
    if (this.equipo) {
      this.nombre.set(this.equipo.nombre);
      this.plantillaId.set(this.equipo.plantilla_id);
      this.tecnicoId.set(this.equipo.tecnico_asignado_id);
      this.tiempoLimite.set(this.equipo.tiempo_limite ? String(this.equipo.tiempo_limite) : '');
      this.localItems.set((this.equipo.items ?? []).map(i => ({
        id: i.id,
        label: i.label,
        observacion_guia: i.observacion_guia ?? '',
        expanded: false,
        archivos: i.archivos ?? [],
        uploading: false,
      })));
    }

    let pending = 2;
    const done = () => { if (--pending === 0) this.loadingData.set(false); };
    this.plantillaSvc.list().subscribe({ next: ps => { this.plantillas.set(ps); done(); }, error: () => done() });
    this.userSvc.list().subscribe({
      next: us => { this.tecnicos.set(us.filter(u => u.rol === 'usuario')); done(); },
      error: () => done(),
    });
  }

  async ionViewDidEnter() {
    const modal = await this.modalCtrl.getTop();
    if (!modal) return;
    modal.canDismiss = async (_data: unknown, role?: string) => {
      if (role === 'saved') return true;
      if (this.touched()) return this.confirmSalir();
      return true;
    };
  }

  onNombreChange(v: string) { this.nombre.set(v); this.touched.set(true); }

  onPlantillaChange(id: number | null) {
    this.touched.set(true);
    this.plantillaId.set(id);
    if (!this.isEdit && id) {
      const p = this.plantillas().find(p => p.id === id);
      if (p?.items?.length) {
        this.localItems.set(p.items.map(i => ({
          label: i.label,
          observacion_guia: '',
          expanded: false,
          archivos: [],
          uploading: false,
        })));
      }
    }
  }

  toggleItem(idx: number) {
    this.localItems.update(items =>
      items.map((it, i) => i === idx ? { ...it, expanded: !it.expanded } : it)
    );
  }

  updateLabel(idx: number, label: string) {
    this.touched.set(true);
    this.localItems.update(items =>
      items.map((it, i) => i === idx ? { ...it, label } : it)
    );
  }

  updateObs(idx: number, obs: string) {
    this.touched.set(true);
    this.localItems.update(items =>
      items.map((it, i) => i === idx ? { ...it, observacion_guia: obs } : it)
    );
  }

  agregarItem() {
    const label = this.nuevoLabel().trim();
    if (!label) return;
    this.touched.set(true);
    this.localItems.update(items => [...items, {
      label,
      observacion_guia: this.nuevaObs().trim(),
      expanded: false,
      archivos: [],
      uploading: false,
    }]);
    this.nuevoLabel.set('');
    this.nuevaObs.set('');
  }

  eliminarItem(idx: number) {
    this.touched.set(true);
    this.localItems.update(items => items.filter((_, i) => i !== idx));
  }

  async addFoto(idx: number) {
    const item = this.localItems()[idx];
    if (!item.id) {
      this.toast('Guarda el equipo primero para poder añadir fotos a nuevos ítems', 'warning');
      return;
    }

    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        width: 1280,
        correctOrientation: true,
      });
      if (!image.dataUrl) return;

      this.localItems.update(items =>
        items.map((it, i) => i === idx ? { ...it, uploading: true } : it)
      );

      this.equipoSvc.addArchivoGuia(this.equipo!.id, item.id, { url: image.dataUrl, tipo: 'imagen' }).subscribe({
        next: archivo => {
          this.localItems.update(items =>
            items.map((it, i) => i === idx
              ? { ...it, uploading: false, archivos: [...it.archivos, archivo] }
              : it)
          );
        },
        error: err => {
          this.localItems.update(items =>
            items.map((it, i) => i === idx ? { ...it, uploading: false } : it)
          );
          this.toast(err?.error?.error ?? 'Error al subir foto', 'danger');
        },
      });
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message.toLowerCase() : '';
      if (!msg.includes('cancel')) this.toast('Error al capturar imagen', 'danger');
    }
  }

  removeArchivo(idx: number, archivoId: number) {
    const item = this.localItems()[idx];
    if (!item.id) return;
    this.equipoSvc.removeArchivoGuia(this.equipo!.id, item.id, archivoId).subscribe({
      next: () => {
        this.localItems.update(items =>
          items.map((it, i) => i === idx
            ? { ...it, archivos: it.archivos.filter(a => a.id !== archivoId) }
            : it)
        );
      },
      error: () => this.toast('Error al eliminar archivo', 'danger'),
    });
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

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const tl = parseInt(this.tiempoLimite());
    const dto: UpdateEquipoDto = {
      nombre:              this.nombre().trim(),
      plantilla_id:        this.plantillaId() || null,
      tecnico_asignado_id: this.tecnicoId() || null,
      tiempo_limite:       isNaN(tl) || tl <= 0 ? null : tl,
    };

    if (this.isEdit) {
      this.equipoSvc.update(this.equipo!.id, dto).subscribe({
        next: () => this.syncItems(this.equipo!.id),
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      const createDto: CreateEquipoDto = {
        proyecto_id:         this.proyectoId,
        nombre:              dto.nombre!,
        plantilla_id:        dto.plantilla_id,
        tecnico_asignado_id: dto.tecnico_asignado_id,
        tiempo_limite:       dto.tiempo_limite,
        items: this.localItems().length
          ? this.localItems().map(i => ({ label: i.label, observacion_guia: i.observacion_guia || null }))
          : undefined,
      };
      this.equipoSvc.create(createDto).subscribe({
        next: () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al crear'); },
      });
    }
  }

  private syncItems(equipoId: number) {
    const originalItems = this.equipo!.items ?? [];
    const currentItems  = this.localItems();
    const currentIds    = new Set(currentItems.filter(i => i.id).map(i => i.id!));

    const toDelete = originalItems.filter(i => !currentIds.has(i.id));
    const toAdd    = currentItems.filter(i => !i.id);
    const toUpdate = currentItems.filter(i => {
      if (!i.id) return false;
      const orig = originalItems.find(o => o.id === i.id);
      if (!orig) return false;
      return orig.label !== i.label
          || (orig.observacion_guia ?? '') !== i.observacion_guia;
    });

    const ops = [
      ...toDelete.map(i => this.equipoSvc.removeItem(equipoId, i.id)),
      ...toAdd.map(i    => this.equipoSvc.addItem(equipoId, i.label, i.observacion_guia || null)),
      ...toUpdate.map(i => this.equipoSvc.updateItem(equipoId, i.id!, {
        label: i.label,
        observacion_guia: i.observacion_guia || null,
      })),
    ];

    if (!ops.length) {
      this.loading.set(false);
      this.modalCtrl.dismiss(null, 'saved');
      return;
    }

    forkJoin(ops).subscribe({
      next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
      error: () => { this.loading.set(false); this.error.set('Error al sincronizar ítems'); },
    });
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
