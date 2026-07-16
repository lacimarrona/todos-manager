import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonCheckbox, IonLabel, IonBadge, IonTextarea,
  IonSpinner, IonFooter, IonNote, IonSelect, IonSelectOption,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, chevronDownOutline, chevronUpOutline,
  cameraOutline, attachOutline, closeCircle, documentOutline, closeOutline,
  checkmarkDoneOutline, cloudOfflineOutline, clipboardOutline,
} from 'ionicons/icons';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

import { RevisionService } from '../../../../core/services/revision.service';
import { OfflineSyncService } from '../../../../core/services/offline-sync.service';
import { Revision, ItemRevision, CalidadRevision } from '../../../../core/models/revision.model';

@Component({
  selector: 'app-revision-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonCheckbox, IonLabel, IonBadge, IonTextarea,
    IonSpinner, IonFooter, IonNote, IonSelect, IonSelectOption,
  ],
  templateUrl: './revision-modal.component.html',
})
export class RevisionModalComponent implements OnInit {
  @Input() revisionId!: number;
  @Input() equipoNombre!: string;
  /** Datos prellenados: revisión cacheada offline o recién cargada */
  @Input() revisionLocal?: Revision;

  private readonly revSvc      = inject(RevisionService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly modalCtrl   = inject(ModalController);
  private readonly alertCtrl   = inject(AlertController);
  private readonly toastCtrl   = inject(ToastController);

  readonly revision     = signal<Revision | null>(null);
  readonly loading      = signal(true);
  readonly completando  = signal(false);
  readonly savingItems  = signal(new Set<number>());
  readonly expandedSet  = signal(new Set<number>());
  readonly obsGeneral      = signal('');
  readonly calidadLocal    = signal<CalidadRevision>('ok');
  readonly uploadingItems  = signal(new Set<number>());
  readonly uploadingObs    = signal(false);

  private readonly pendingNotes = new Map<number, string>();

  // Computed signals de estado
  readonly isTerminado  = computed(() => this.revision()?.estado === 'terminado');
  readonly isOffline    = computed(() => !this.offlineSync.online());
  // Revisión con id <= 0 es temporal (creada offline sin sync aún)
  readonly isTempRev    = computed(() => (this.revision()?.id ?? 1) <= 0);
  // Debemos usar la cola offline si no hay internet O si la revisión es temporal
  readonly useOfflineQ  = computed(() => this.isOffline() || this.isTempRev());

  readonly checkedCount = computed(() =>
    this.revision()?.items.filter(i => i.checked).length ?? 0
  );
  readonly totalCount   = computed(() => this.revision()?.items.length ?? 0);
  readonly progress     = computed(() =>
    this.totalCount() === 0 ? 0 : Math.round((this.checkedCount() / this.totalCount()) * 100)
  );
  readonly allChecked   = computed(() =>
    this.totalCount() > 0 && this.checkedCount() === this.totalCount()
  );
  readonly pendingCount = computed(() => this.totalCount() - this.checkedCount());

  constructor() {
    addIcons({
      checkmarkCircleOutline, chevronDownOutline, chevronUpOutline,
      cameraOutline, attachOutline, closeCircle, documentOutline, closeOutline,
      checkmarkDoneOutline, cloudOfflineOutline, clipboardOutline,
    });
  }

  ngOnInit() {
    // Si ya tenemos datos locales (offline o pre-cargados), usarlos directamente
    if (this.revisionLocal) {
      this.revision.set(this.revisionLocal);
      this.obsGeneral.set(this.revisionLocal.observacion_general ?? '');
      this.calidadLocal.set((this.revisionLocal.estado_calidad as CalidadRevision) ?? 'ok');
      const autoExpand = new Set(
        this.revisionLocal.items
          .filter(i => i.checked || i.nota || (i.archivos?.length ?? 0) > 0)
          .map(i => i.id)
      );
      this.expandedSet.set(autoExpand);
      this.loading.set(false);
      return;
    }

    // Cargar desde la API (modo normal con internet)
    this.revSvc.getOne(this.revisionId).subscribe({
      next: rev => {
        this.revision.set(rev);
        this.obsGeneral.set(rev.observacion_general ?? '');
        this.calidadLocal.set((rev.estado_calidad as CalidadRevision) ?? 'ok');
        const autoExpand = new Set(
          rev.items
            .filter(i => i.checked || i.nota || (i.archivos?.length ?? 0) > 0)
            .map(i => i.id)
        );
        this.expandedSet.set(autoExpand);
        this.loading.set(false);
        // Cachear para uso offline futuro
        this.offlineSync.cacheRevision(rev);
      },
      error: () => { this.loading.set(false); this.toast('Error al cargar la revisión', 'danger'); },
    });
  }

  async ionViewDidEnter() {
    const modal = await this.modalCtrl.getTop();
    if (!modal) return;
    modal.canDismiss = async (_data: unknown, role?: string) => {
      if (role === 'completed') return true;
      const rev = this.revision();
      if (rev && rev.estado === 'en_proceso') return this.confirmSalir();
      return true;
    };
  }

  dismiss() {
    this.modalCtrl.dismiss(null, this.isTerminado() ? 'completed' : 'updated');
  }

  private async confirmSalir(): Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header: '¿Salir de la revisión?',
        message: 'La revisión está en progreso. ¿Seguro que quieres salir?',
        backdropDismiss: false,
        buttons: [
          { text: 'Seguir revisando', role: 'cancel',     handler: () => resolve(false) },
          { text: 'Salir',            role: 'destructive', handler: () => resolve(true)  },
        ],
      });
      await alert.present();
    });
  }

  isExpanded(itemId: number) { return this.expandedSet().has(itemId); }
  isSaving(itemId: number)   { return this.savingItems().has(itemId); }
  isUploading(itemId: number){ return this.uploadingItems().has(itemId); }

  toggleExpand(itemId: number) {
    this.expandedSet.update(s => {
      const n = new Set(s);
      n.has(itemId) ? n.delete(itemId) : n.add(itemId);
      return n;
    });
  }

  toggleCheck(item: ItemRevision, event: Event) {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;

    // Actualizar estado local inmediatamente
    this.updateItemInSignal(item.id, { checked });
    if (checked) this.expandedSet.update(s => new Set([...s, item.id]));
    if (this.revision()?.estado === 'pendiente') {
      this.revision.update(r => r ? { ...r, estado: 'en_proceso' } : r);
    }

    if (this.useOfflineQ()) {
      // Modo offline: encolar y cachear
      this.offlineSync.encolar({
        tipo: 'update_item',
        equipoId: this.revision()!.equipo_id,
        payload: { itemEquipoId: item.item_id, checked },
      }).then(() => this.persistRevisionCache());
      return;
    }

    // Modo online: llamar API
    this.savingItems.update(s => new Set([...s, item.id]));
    this.revSvc.updateItem(this.revision()!.id, item.id, { checked }).subscribe({
      next: updated => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.updateItemInSignal(item.id, updated);
        this.offlineSync.cacheRevision(this.revision()!);
      },
      error: (err) => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.updateItemInSignal(item.id, { checked: !checked });
        this.toast(err?.error?.error ?? 'Error al guardar', 'danger');
      },
    });
  }

  onNoteInput(itemId: number, nota: string) {
    this.pendingNotes.set(itemId, nota);
  }

  onNoteBlur(itemId: number) {
    const nota = this.pendingNotes.get(itemId);
    if (nota === undefined) return;
    this.pendingNotes.delete(itemId);

    this.updateItemInSignal(itemId, { nota });

    if (this.useOfflineQ()) {
      const item = this.revision()!.items.find(i => i.id === itemId);
      if (!item) return;
      this.offlineSync.encolar({
        tipo: 'update_item',
        equipoId: this.revision()!.equipo_id,
        payload: { itemEquipoId: item.item_id, nota },
      }).then(() => this.persistRevisionCache());
      return;
    }

    this.savingItems.update(s => new Set([...s, itemId]));
    this.revSvc.updateItem(this.revision()!.id, itemId, { nota }).subscribe({
      next: updated => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
        this.updateItemInSignal(itemId, { nota: updated.nota });
        this.offlineSync.cacheRevision(this.revision()!);
      },
      error: (err) => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
        this.toast(err?.error?.error ?? 'Error al guardar nota', 'danger');
      },
    });
  }

  // ── Captura de foto con cámara nativa ────────────────────────────────────────

  async capturePhoto(item: ItemRevision) {
    if (!this.revision()) return;
    this.uploadingItems.update(s => new Set([...s, item.id]));

    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        width: 1280,
        correctOrientation: true,
      });

      if (!image.dataUrl) {
        this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        return;
      }

      const approxBytes = Math.ceil((image.dataUrl.length * 3) / 4);
      if (approxBytes > 8 * 1024 * 1024) {
        this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.toast('La imagen es demasiado grande (máx 8 MB)', 'danger');
        return;
      }

      if (this.useOfflineQ()) {
        // Guardar archivo localmente con referencia temporal
        const archivoTemp = { id: -(Date.now()), item_rev_id: item.id, url: image.dataUrl, tipo: 'imagen' };
        this.revision.update(r => r ? {
          ...r,
          items: r.items.map(i =>
            i.id === item.id ? { ...i, archivos: [...(i.archivos ?? []), archivoTemp] } : i
          ),
        } : r);
        await this.offlineSync.encolar({
          tipo: 'add_archivo',
          equipoId: this.revision()!.equipo_id,
          payload: { itemEquipoId: item.item_id, url: image.dataUrl, tipo: 'imagen' },
        });
        await this.persistRevisionCache();
        this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.toast('Foto guardada offline. Se sincronizará al reconectar.');
        return;
      }

      this.revSvc.addArchivo(this.revision()!.id, item.id, { url: image.dataUrl, tipo: 'imagen' }).subscribe({
        next: archivo => {
          this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
          this.revision.update(r => r ? {
            ...r,
            items: r.items.map(i =>
              i.id === item.id ? { ...i, archivos: [...(i.archivos ?? []), archivo] } : i
            ),
          } : r);
          this.offlineSync.cacheRevision(this.revision()!);
        },
        error: err => {
          this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
          this.toast(err?.error?.error ?? 'Error al subir foto', 'danger');
        },
      });
    } catch (err: unknown) {
      this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message.toLowerCase()
        : '';
      if (!msg.includes('cancel')) {
        this.toast('Error al capturar imagen', 'danger');
      }
    }
  }

  // ── Adjuntar archivo desde el sistema ───────────────────────────────────────

  triggerFileInput(itemId: number) {
    const input = document.getElementById(`file-input-${itemId}`) as HTMLInputElement;
    input?.click();
  }

  async onFileSelected(event: Event, item: ItemRevision) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.revision()) return;
    input.value = '';

    if (file.size > 5 * 1024 * 1024) {
      this.toast('El archivo no puede superar 5 MB', 'danger');
      return;
    }

    const tipo = file.type.startsWith('image/') ? 'imagen' : 'documento';
    this.uploadingItems.update(s => new Set([...s, item.id]));

    try {
      const url = await fileToDataUrl(file);

      if (this.useOfflineQ()) {
        const archivoTemp = { id: -(Date.now()), item_rev_id: item.id, url, tipo };
        this.revision.update(r => r ? {
          ...r,
          items: r.items.map(i =>
            i.id === item.id ? { ...i, archivos: [...(i.archivos ?? []), archivoTemp] } : i
          ),
        } : r);
        if (!this.expandedSet().has(item.id)) {
          this.expandedSet.update(s => new Set([...s, item.id]));
        }
        await this.offlineSync.encolar({
          tipo: 'add_archivo',
          equipoId: this.revision()!.equipo_id,
          payload: { itemEquipoId: item.item_id, url, tipo },
        });
        await this.persistRevisionCache();
        this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.toast('Archivo guardado offline. Se sincronizará al reconectar.');
        return;
      }

      this.revSvc.addArchivo(this.revision()!.id, item.id, { url, tipo }).subscribe({
        next: archivo => {
          this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
          this.revision.update(r => r ? {
            ...r,
            items: r.items.map(i =>
              i.id === item.id ? { ...i, archivos: [...(i.archivos ?? []), archivo] } : i
            ),
          } : r);
          if (!this.expandedSet().has(item.id)) {
            this.expandedSet.update(s => new Set([...s, item.id]));
          }
          this.offlineSync.cacheRevision(this.revision()!);
        },
        error: err => {
          this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
          this.toast(err?.error?.error ?? 'Error al subir archivo', 'danger');
        },
      });
    } catch {
      this.uploadingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
      this.toast('Error al leer el archivo', 'danger');
    }
  }

  async removeArchivo(itemId: number, archivoId: number) {
    // Archivos temporales (id negativo) solo se borran del estado local
    if (archivoId < 0) {
      this.revision.update(r => r ? {
        ...r,
        items: r.items.map(i =>
          i.id === itemId ? { ...i, archivos: i.archivos?.filter(a => a.id !== archivoId) } : i
        ),
      } : r);
      await this.persistRevisionCache();
      return;
    }

    if (this.useOfflineQ()) {
      this.toast('No puedes eliminar archivos sin conexión', 'danger');
      return;
    }

    this.revSvc.removeArchivo(this.revision()!.id, itemId, archivoId).subscribe({
      next: () => {
        this.revision.update(r => r ? {
          ...r,
          items: r.items.map(i =>
            i.id === itemId ? { ...i, archivos: i.archivos?.filter(a => a.id !== archivoId) } : i
          ),
        } : r);
        this.offlineSync.cacheRevision(this.revision()!);
      },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar archivo', 'danger'),
    });
  }

  readonly imagenVisor = signal<string | null>(null);

  viewImage(url: string)  { this.imagenVisor.set(url); }
  cerrarVisor()           { this.imagenVisor.set(null); }

  async openDocument(url: string) {
    const mime = url.split(';')[0].split(':')[1] ?? 'application/octet-stream';
    const extMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/csv': 'csv',
    };
    const ext = extMap[mime] ?? 'bin';
    const base64 = url.split(',')[1];
    if (!base64) { this.toast('Formato de archivo no soportado', 'danger'); return; }

    try {
      const filename = `techcheck_${Date.now()}.${ext}`;
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      await FileOpener.open({ filePath: uri, contentType: mime });
    } catch (err) {
      console.error('openDocument error:', err);
      this.toast('No se pudo abrir el archivo', 'danger');
    }
  }

  // ── Archivos de observación general ─────────────────────────────────────────

  async capturePhotoObs() {
    if (!this.revision() || this.isTerminado()) return;
    this.uploadingObs.set(true);
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        width: 1280,
        correctOrientation: true,
      });
      if (!image.dataUrl) { this.uploadingObs.set(false); return; }

      this.revSvc.addArchivoObs(this.revision()!.id, { url: image.dataUrl, tipo: 'imagen' }).subscribe({
        next: archivo => {
          this.uploadingObs.set(false);
          this.revision.update(r => r ? { ...r, archivos_obs: [...(r.archivos_obs ?? []), archivo] } : r);
        },
        error: err => { this.uploadingObs.set(false); this.toast(err?.error?.error ?? 'Error al subir foto', 'danger'); },
      });
    } catch (err: unknown) {
      this.uploadingObs.set(false);
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message.toLowerCase() : '';
      if (!msg.includes('cancel')) this.toast('Error al capturar imagen', 'danger');
    }
  }

  triggerFileInputObs() {
    (document.getElementById('file-input-obs') as HTMLInputElement)?.click();
  }

  async onFileSelectedObs(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.revision()) return;
    input.value = '';
    if (file.size > 5 * 1024 * 1024) { this.toast('El archivo no puede superar 5 MB', 'danger'); return; }

    const tipo = file.type.startsWith('image/') ? 'imagen' : 'documento';
    this.uploadingObs.set(true);
    try {
      const url = await fileToDataUrl(file);
      this.revSvc.addArchivoObs(this.revision()!.id, { url, tipo }).subscribe({
        next: archivo => {
          this.uploadingObs.set(false);
          this.revision.update(r => r ? { ...r, archivos_obs: [...(r.archivos_obs ?? []), archivo] } : r);
        },
        error: err => { this.uploadingObs.set(false); this.toast(err?.error?.error ?? 'Error al subir archivo', 'danger'); },
      });
    } catch {
      this.uploadingObs.set(false);
      this.toast('Error al leer el archivo', 'danger');
    }
  }

  removeArchivoObs(archivoId: number) {
    if (this.isOffline()) { this.toast('No puedes eliminar archivos sin conexión', 'danger'); return; }
    this.revSvc.removeArchivoObs(this.revision()!.id, archivoId).subscribe({
      next: () => this.revision.update(r => r ? { ...r, archivos_obs: r.archivos_obs?.filter(a => a.id !== archivoId) } : r),
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar archivo', 'danger'),
    });
  }

  // ── Completar revisión ───────────────────────────────────────────────────────

  async completar() {
    if (!this.allChecked()) {
      const alert = await this.alertCtrl.create({
        header: 'Ítems pendientes',
        message: `Faltan ${this.pendingCount()} ítem(s) por revisar. Debes marcar todos los ítems antes de finalizar.`,
        buttons: [{ text: 'Entendido', role: 'cancel' }],
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Completar revisión',
      message: this.useOfflineQ()
        ? 'La revisión se guardará localmente y se sincronizará cuando haya conexión. ¿Continuar?'
        : 'Una vez marcada como terminada no podrás modificar los ítems. ¿Continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Completar', handler: () => this.doCompletar() },
      ],
    });
    await alert.present();
  }

  private async doCompletar() {
    if (this.useOfflineQ()) {
      // Modo offline: actualizar estado local y encolar
      this.revision.update(r => r ? {
        ...r,
        estado: 'terminado',
        observacion_general: this.obsGeneral() || null,
        estado_calidad: this.calidadLocal(),
      } : r);
      await this.offlineSync.encolar({
        tipo: 'complete_revision',
        equipoId: this.revision()!.equipo_id,
        payload: {
          estado: 'terminado',
          observacion_general: this.obsGeneral() || null,
          estado_calidad: this.calidadLocal(),
        },
      });
      await this.persistRevisionCache();
      this.toast('Revisión completada offline. Se sincronizará al reconectar.');
      return;
    }

    this.completando.set(true);
    this.revSvc.update(this.revision()!.id, {
      estado: 'terminado',
      observacion_general: this.obsGeneral() || null,
      estado_calidad: this.calidadLocal(),
    }).subscribe({
      next: rev => {
        this.completando.set(false);
        this.revision.set(rev);
        this.offlineSync.cacheRevision(rev);
        this.toast('Revisión completada');
      },
      error: err => { this.completando.set(false); this.toast(err?.error?.error ?? 'Error al completar', 'danger'); },
    });
  }

  estadoColor(estado?: string) {
    const map: Record<string, string> = { pendiente: 'warning', en_proceso: 'primary', terminado: 'success' };
    return map[estado ?? ''] ?? 'medium';
  }

  estadoLabel(estado?: string) {
    const map: Record<string, string> = { pendiente: 'Pendiente', en_proceso: 'En Proceso', terminado: 'Terminado' };
    return map[estado ?? ''] ?? '';
  }

  calidadLabel(c: CalidadRevision | null | string): string {
    const map: Record<string, string> = {
      ok: '✓ Sin problemas',
      observacion: '⚠ Con observaciones',
      problema: '✗ Con problemas',
    };
    return c ? (map[c] ?? String(c)) : 'Sin evaluar';
  }

  calidadColor(c: CalidadRevision | null | string): string {
    const map: Record<string, string> = { ok: 'success', observacion: 'warning', problema: 'danger' };
    return c ? (map[c] ?? 'medium') : 'medium';
  }

  private updateItemInSignal(itemId: number, patch: Partial<ItemRevision>) {
    this.revision.update(r => {
      if (!r) return r;
      return { ...r, items: r.items.map(i => i.id === itemId ? { ...i, ...patch } : i) };
    });
  }

  private async persistRevisionCache() {
    const rev = this.revision();
    if (rev) await this.offlineSync.cacheRevision(rev);
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3500, position: 'bottom', color });
    await t.present();
  }
}
