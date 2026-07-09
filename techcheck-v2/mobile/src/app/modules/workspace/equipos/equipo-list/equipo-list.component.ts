import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon, IonButton,
  IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle,
  IonCardContent, IonBadge, IonSpinner, IonBackButton,
  IonModal, IonSelect, IonSelectOption, IonItem,
  ModalController, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  clipboardOutline, personOutline, timeOutline, chevronForwardOutline,
  archiveOutline, eyeOutline, addOutline, createOutline, trashOutline,
  cloudUploadOutline, closeOutline, cloudOfflineOutline,
} from 'ionicons/icons';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { EquipoService } from '../../../../core/services/equipo.service';
import { RevisionService } from '../../../../core/services/revision.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { OfflineSyncService } from '../../../../core/services/offline-sync.service';
import { Equipo, RevisionEstado } from '../../../../core/models/equipo.model';
import { Plantilla } from '../../../../core/models/plantilla.model';
import { Revision } from '../../../../core/models/revision.model';
import { RevisionModalComponent } from '../../revisiones/revision-modal/revision-modal.component';
import { EquipoFormModalComponent } from '../equipo-form-modal/equipo-form-modal.component';

@Component({
  selector: 'app-equipo-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon, IonButton,
    IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonBadge, IonSpinner, IonBackButton,
    IonModal, IonSelect, IonSelectOption, IonItem,
  ],
  templateUrl: './equipo-list.component.html',
})
export class EquipoListComponent implements OnInit {
  private readonly proyectoSvc  = inject(ProyectoService);
  private readonly equipoSvc    = inject(EquipoService);
  private readonly revSvc       = inject(RevisionService);
  private readonly auth         = inject(AuthService);
  private readonly plantillaSvc = inject(PlantillaService);
  private readonly offlineSync  = inject(OfflineSyncService);
  private readonly modalCtrl    = inject(ModalController);
  private readonly toastCtrl    = inject(ToastController);
  private readonly alertCtrl    = inject(AlertController);
  private readonly route        = inject(ActivatedRoute);

  readonly online        = this.offlineSync.online;       // true = hay internet
  readonly pendientes    = this.offlineSync.pendientes;
  readonly sincronizando = this.offlineSync.sincronizando;

  readonly proyectoId     = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
  readonly proyectoNombre = signal('Proyecto');
  readonly equipos        = signal<Equipo[]>([]);
  readonly loading        = signal(false);
  readonly abriendo       = signal<number | null>(null);
  readonly filtro         = signal<string>('todos');

  // Import signals
  readonly mostrarImport     = signal(false);
  readonly importEquipos     = signal<{ nombre: string }[]>([]);
  readonly importPlantillaId = signal<number | null>(null);
  readonly importandoMasivo  = signal(false);
  readonly importError       = signal<string | null>(null);
  readonly importExito       = signal<string | null>(null);
  readonly plantillas        = signal<Plantilla[]>([]);

  constructor() {
    addIcons({
      clipboardOutline, personOutline, timeOutline, chevronForwardOutline,
      archiveOutline, eyeOutline, addOutline, createOutline, trashOutline,
      cloudUploadOutline, closeOutline, cloudOfflineOutline,
    });
  }

  ngOnInit() {
    this.proyectoSvc.getOne(this.proyectoId).subscribe({
      next: p => this.proyectoNombre.set(p.nombre),
    });
    this.plantillaSvc.list().subscribe({
      next: ps => this.plantillas.set(ps),
    });
    this.loadEquipos();
  }

  loadEquipos() {
    this.loading.set(true);
    const f = this.filtro();
    const esArchivado = f === 'archivado';
    const estado = esArchivado || f === 'todos' ? undefined : f;

    // Sin internet: usar cache
    if (!this.online()) {
      this.offlineSync.getEquiposCache(this.proyectoId).then(cached => {
        if (cached) {
          const filtrados = esArchivado ? cached.filter(e => e.archivado) : cached;
          this.equipos.set(filtrados);
        } else {
          this.toast('Sin conexión y sin datos en caché para este proyecto.', 'danger');
        }
        this.loading.set(false);
      });
      return;
    }

    this.proyectoSvc.listEquipos(this.proyectoId, estado, esArchivado).pipe(
      map(es => esArchivado ? es.filter(e => e.archivado) : es)
    ).subscribe({
      next: es => {
        this.equipos.set(es);
        this.loading.set(false);
        if (!esArchivado) {
          this.offlineSync.cacheEquipos(this.proyectoId, es);
          // Pre-cachear ítems y revisiones activas de todos los equipos en background
          this.precachearEquipos(es);
        }
      },
      error: () => { this.loading.set(false); this.toast('Error al cargar equipos', 'danger'); },
    });
  }

  onFiltroChange(event: CustomEvent) {
    this.filtro.set((event as CustomEvent<{ value: string }>).detail.value);
    this.loadEquipos();
  }

  // Pre-cachea ítems de cada equipo y sus revisiones activas (en background, sin bloquear UI)
  private precachearEquipos(equipos: Equipo[]) {
    equipos.forEach(eq => {
      // Cachear ítems del equipo
      this.equipoSvc.getOne(eq.id).subscribe({
        next: e => {
          if (e.items?.length) this.offlineSync.cacheItemsEquipo(eq.id, e.items);
        },
        error: () => {},
      });
      // Cachear revisión activa si existe
      this.equipoSvc.listRevisiones(eq.id).subscribe({
        next: revisiones => {
          const activa = revisiones.find(r => r.estado !== 'terminado') ?? revisiones[0];
          if (activa) {
            this.revSvc.getOne(activa.id).subscribe({
              next: rev => this.offlineSync.cacheRevision(rev),
              error: () => {},
            });
          }
        },
        error: () => {},
      });
    });
  }

  async openRevision(equipo: Equipo) {
    if (this.abriendo()) return;
    this.abriendo.set(equipo.id);

    // ── Modo offline ────────────────────────────────────────────────────────
    if (!this.online()) {
      const revCached = await this.offlineSync.getRevisionCache(equipo.id);
      this.abriendo.set(null);

      // Sin revisión cacheada: intentar crear una nueva desde los ítems del equipo
      if (!revCached) {
        const itemsEquipo = await this.offlineSync.getItemsEquipoCache(equipo.id);
        if (!itemsEquipo?.length) {
          this.toast('Sin conexión. Este equipo no tiene datos disponibles offline.', 'danger');
          return;
        }
        // Crear revisión temporal con los ítems del equipo
        const revNueva: Revision = {
          id: -equipo.id,
          equipo_id: equipo.id,
          tecnico_id: null,
          estado: 'pendiente',
          estado_calidad: null,
          observacion_general: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: itemsEquipo.map(i => ({
            id: -(i.id),
            revision_id: -equipo.id,
            item_id: i.id,
            label: i.label,
            checked: false,
            nota: null,
            archivos: [],
          })),
        };
        await this.offlineSync.encolar({
          tipo: 'create_revision',
          equipoId: equipo.id,
          payload: { equipo_id: equipo.id },
        });
        await this.offlineSync.cacheRevision(revNueva);

        const modal = await this.modalCtrl.create({
          component: RevisionModalComponent,
          componentProps: { revisionId: 0, revisionLocal: revNueva, equipoNombre: equipo.nombre },
          cssClass: 'revision-modal',
        });
        await modal.present();
        await modal.onWillDismiss();
        this.loadEquipos();
        return;
      }

      let revParaModal: Revision = revCached;

      // Si la revisión cacheada está terminada, crear una nueva local con los ítems en blanco
      if (revCached.estado === 'terminado') {
        const accion = await this.preguntarAccionRevision(equipo.nombre);
        if (!accion || accion === 'archivar') return; // archivar requiere internet
        if (accion === 'ver') {
          // Mostrar la revisión terminada tal cual
        } else {
          // Crear nueva revisión local con los ítems del equipo en blanco
          revParaModal = {
            ...revCached,
            id: -equipo.id, // ID temporal negativo, único por equipo
            estado: 'pendiente',
            estado_calidad: null,
            observacion_general: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: revCached.items.map(i => ({
              ...i,
              id: -(i.item_id),  // ID temporal negativo = -(id_item_equipo)
              revision_id: -equipo.id,
              checked: false,
              nota: null,
              archivos: [],
            })),
          };
          // Encolar la creación de la revisión real
          await this.offlineSync.encolar({
            tipo: 'create_revision',
            equipoId: equipo.id,
            payload: { equipo_id: equipo.id },
          });
          // Cachear la revisión temporal
          await this.offlineSync.cacheRevision(revParaModal);
        }
      }

      const modal = await this.modalCtrl.create({
        component: RevisionModalComponent,
        componentProps: {
          revisionId: Math.max(0, revParaModal.id),
          revisionLocal: revParaModal,
          equipoNombre: equipo.nombre,
        },
        cssClass: 'revision-modal',
      });
      await modal.present();
      await modal.onWillDismiss();
      this.loadEquipos();
      return;
    }

    // ── Modo online ─────────────────────────────────────────────────────────
    try {
      const revisiones = await firstValueFrom(this.equipoSvc.listRevisiones(equipo.id));
      const latest = revisiones?.[0];
      let revisionId: number;

      if (equipo.archivado) {
        if (!latest) { this.abriendo.set(null); return; }
        revisionId = latest.id;
      } else if (latest && latest.estado !== 'terminado') {
        revisionId = latest.id;
      } else if (latest && latest.estado === 'terminado') {
        this.abriendo.set(null);
        const accion = await this.preguntarAccionRevision(equipo.nombre);
        if (!accion) return;

        if (accion === 'archivar') {
          await firstValueFrom(this.equipoSvc.archivar(equipo.id));
          this.toast('Equipo archivado correctamente');
          this.loadEquipos();
          return;
        }

        this.abriendo.set(equipo.id);
        if (accion === 'ver') {
          revisionId = latest.id;
        } else {
          const nueva = await firstValueFrom(this.revSvc.create({ equipo_id: equipo.id }));
          revisionId = nueva.id;
        }
      } else {
        const nueva = await firstValueFrom(this.revSvc.create({ equipo_id: equipo.id }));
        revisionId = nueva.id;
      }

      this.abriendo.set(null);

      const modal = await this.modalCtrl.create({
        component: RevisionModalComponent,
        componentProps: { revisionId, equipoNombre: equipo.nombre },
        cssClass: 'revision-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'completed' || role === 'updated') this.loadEquipos();
    } catch {
      this.abriendo.set(null);
      this.toast('Error al abrir la revisión', 'danger');
    }
  }

  private async preguntarAccionRevision(nombre: string): Promise<'ver' | 'nueva' | 'archivar' | null> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header: 'Revisión completada',
        message: `"${nombre}" ya tiene una revisión terminada. ¿Qué deseas hacer?`,
        buttons: [
          { text: 'Cancelar',      role: 'cancel', handler: () => resolve(null) },
          { text: 'Ver resultado',                  handler: () => resolve('ver') },
          { text: 'Nueva revisión',                 handler: () => resolve('nueva') },
          { text: 'Archivar',                       handler: () => resolve('archivar') },
        ],
      });
      await alert.present();
    });
  }

  get isAdmin() { return this.auth.isAdmin(); }

  async createEquipo() {
    const modal = await this.modalCtrl.create({
      component: EquipoFormModalComponent,
      componentProps: { proyectoId: this.proyectoId },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.loadEquipos();
  }

  async editEquipo(equipo: Equipo, event: Event) {
    event.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: EquipoFormModalComponent,
      componentProps: { equipo, proyectoId: this.proyectoId },
      cssClass: 'form-modal',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') this.loadEquipos();
  }

  async deleteEquipo(equipo: Equipo, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Eliminar equipo',
      message: `¿Eliminar "${equipo.nombre}"? Se borrarán todas sus revisiones.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar', role: 'destructive',
          handler: () => {
            this.equipoSvc.remove(equipo.id).subscribe({
              next: () => { this.toast('Equipo eliminado'); this.loadEquipos(); },
              error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  // ── Importar equipos ─────────────────────────────────────────────────────────

  abrirImport() {
    this.importEquipos.set([]);
    this.importPlantillaId.set(null);
    this.importError.set(null);
    this.importExito.set(null);
    this.mostrarImport.set(true);
  }

  cerrarImport() { this.mostrarImport.set(false); }

  triggerImportInput() {
    const input = document.getElementById('import-file-input') as HTMLInputElement;
    input?.click();
  }

  onImportFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    input.value = '';
    this.importError.set(null);
    this.importExito.set(null);
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      this.equipoSvc.importarExcelNombres(file).subscribe({
        next: ({ equipos }) => {
          if (!equipos.length) {
            this.importError.set('No se encontraron equipos. Asegúrate de que la columna A tenga los nombres (fila 1 = encabezado).');
            return;
          }
          this.importEquipos.set(equipos);
        },
        error: err => this.importError.set(err?.error?.error ?? 'Error al leer el archivo Excel.'),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lineas = text.split(/\r?\n/).filter(l => l.trim() !== '');
        let inicio = 0;
        if (lineas.length > 0 && lineas[0].trim().toLowerCase() === 'nombre') inicio = 1;
        const equipos = lineas.slice(inicio)
          .map(l => ({ nombre: l.split(',')[0].trim() }))
          .filter(e => e.nombre);
        if (!equipos.length) {
          this.importError.set('No se encontraron equipos en el archivo.');
          return;
        }
        this.importEquipos.set(equipos);
      };
      reader.onerror = () => this.importError.set('Error al leer el archivo.');
      reader.readAsText(file);
    }
  }

  confirmarImport() {
    const equipos = this.importEquipos();
    if (!equipos.length) { this.importError.set('No hay equipos para importar.'); return; }

    this.importandoMasivo.set(true);
    this.importError.set(null);
    this.importExito.set(null);

    this.equipoSvc.importarMasivo({
      proyecto_id: this.proyectoId,
      equipos,
      plantilla_id: this.importPlantillaId(),
    }).subscribe({
      next: (res) => {
        this.importandoMasivo.set(false);
        this.importExito.set(`Se importaron ${res.ids.length} equipo(s) correctamente.`);
        this.loadEquipos();
      },
      error: (err) => {
        this.importandoMasivo.set(false);
        this.importError.set(err?.error?.error ?? 'Error al importar equipos.');
      },
    });
  }

  // ── Helpers de visualización ─────────────────────────────────────────────────

  estadoColor(estado: RevisionEstado | undefined): string {
    const map: Record<string, string> = {
      pendiente:  'warning',
      en_proceso: 'primary',
      terminado:  'success',
    };
    return map[estado ?? 'pendiente'] ?? 'medium';
  }

  estadoLabel(estado: RevisionEstado | undefined): string {
    const map: Record<string, string> = {
      pendiente:  'Pendiente',
      en_proceso: 'En Proceso',
      terminado:  'Terminado',
    };
    return map[estado ?? 'pendiente'] ?? 'Pendiente';
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
