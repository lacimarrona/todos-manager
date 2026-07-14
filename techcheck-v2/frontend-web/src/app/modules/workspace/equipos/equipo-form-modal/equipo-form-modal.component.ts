import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonText,
  IonIcon, IonLabel, IonNote,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, trashOutline, pencilOutline, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { EquipoService, UpdateEquipoDto } from '../../../../core/services/equipo.service';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { UserService } from '../../../../core/services/user.service';
import { Equipo } from '../../../../core/models/equipo.model';
import { Plantilla } from '../../../../core/models/plantilla.model';
import { User } from '../../../../core/models/user.model';

interface LocalItem { id?: number; label: string; observacion_guia?: string | null; }

@Component({
  selector: 'app-equipo-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonSpinner, IonText,
    IonIcon, IonLabel, IonNote,
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

  readonly loading     = signal(false);
  readonly error       = signal<string | null>(null);
  readonly nombre      = signal('');
  readonly plantillaId = signal<number | null>(null);
  readonly tecnicoId   = signal<number | null>(null);
  readonly tiempoLimite = signal<string>('');
  readonly localItems    = signal<LocalItem[]>([]);
  readonly nuevoLabel    = signal('');
  readonly nuevoObsGuia  = signal('');
  readonly expandedObs   = signal<number | null>(null);

  readonly plantillas  = signal<Plantilla[]>([]);
  readonly tecnicos    = signal<User[]>([]);
  readonly loadingData = signal(true);

  readonly isValid = computed(() => this.nombre().trim().length > 0);
  get isEdit() { return !!this.equipo; }

  constructor() {
    addIcons({ add, trashOutline, pencilOutline, chevronDownOutline, chevronUpOutline });
  }

  ngOnInit() {
    if (this.equipo) {
      this.nombre.set(this.equipo.nombre);
      this.plantillaId.set(this.equipo.plantilla_id);
      this.tecnicoId.set(this.equipo.tecnico_asignado_id);
      this.tiempoLimite.set(this.equipo.tiempo_limite ? String(this.equipo.tiempo_limite) : '');
      this.localItems.set((this.equipo.items || []).map(i => ({ id: i.id, label: i.label, observacion_guia: i.observacion_guia ?? null })));
    }

    let pending = 2;
    const done = () => { if (--pending === 0) this.loadingData.set(false); };

    this.plantillaSvc.list().subscribe({ next: ps => { this.plantillas.set(ps); done(); }, error: done });
    this.userSvc.list().subscribe({
      next: us => { this.tecnicos.set(us.filter(u => u.rol === 'usuario')); done(); },
      error: done,
    });
  }

  onPlantillaChange(id: number | null) {
    this.plantillaId.set(id);
    if (!this.isEdit && id) {
      const plantilla = this.plantillas().find(p => p.id === id);
      if (plantilla?.items?.length) {
        this.localItems.set(plantilla.items.map(i => ({ label: i.label, observacion_guia: i.observacion_guia })));
      }
    }
  }

  agregarItem() {
    const label = this.nuevoLabel().trim();
    if (!label) return;
    this.localItems.update(items => [...items, { label, observacion_guia: this.nuevoObsGuia().trim() || null }]);
    this.nuevoLabel.set('');
    this.nuevoObsGuia.set('');
  }

  eliminarItem(idx: number) {
    this.localItems.update(items => items.filter((_, i) => i !== idx));
    if (this.expandedObs() === idx) this.expandedObs.set(null);
  }

  updateItemLabel(idx: number, label: string) {
    this.localItems.update(items => items.map((it, i) => i === idx ? { ...it, label } : it));
  }

  updateItemObs(idx: number, obs: string) {
    this.localItems.update(items => items.map((it, i) => i === idx ? { ...it, observacion_guia: obs.trim() || null } : it));
  }

  toggleItemObs(idx: number) {
    this.expandedObs.update(v => v === idx ? null : idx);
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

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
      const items = this.localItems().map(i => ({ label: i.label, observacion_guia: i.observacion_guia ?? null }));
      this.equipoSvc.create({
        proyecto_id:         this.proyectoId,
        nombre:              dto.nombre!,
        plantilla_id:        dto.plantilla_id,
        tecnico_asignado_id: dto.tecnico_asignado_id,
        tiempo_limite:       dto.tiempo_limite,
        items:               items.length ? items : undefined,
      }).subscribe({
        next: () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    }
  }

  private syncItems(equipoId: number) {
    const originalItems = this.equipo!.items || [];
    const currentItems  = this.localItems();

    const originalMap = new Map(originalItems.map(i => [i.id, i]));
    const currentIds  = new Set(currentItems.filter(i => i.id).map(i => i.id!));

    const toDelete = originalItems.filter(i => !currentIds.has(i.id));
    const toAdd    = currentItems.filter(i => !i.id);
    const toUpdate = currentItems.filter(i => {
      if (!i.id) return false;
      const orig = originalMap.get(i.id);
      return orig && (
        orig.label !== i.label ||
        (orig.observacion_guia ?? null) !== (i.observacion_guia ?? null)
      );
    });

    const ops = [
      ...toDelete.map(i  => this.equipoSvc.removeItem(equipoId, i.id)),
      ...toAdd.map(i     => this.equipoSvc.addItem(equipoId, i.label, i.observacion_guia)),
      ...toUpdate.map(i  => this.equipoSvc.updateItem(equipoId, i.id!, { label: i.label, observacion_guia: i.observacion_guia ?? null })),
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
}
