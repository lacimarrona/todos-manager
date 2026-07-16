import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonCheckbox, IonLabel, IonBadge, IonTextarea,
  IonSpinner, IonFooter, IonNote, IonSelect, IonSelectOption,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, chevronDownOutline, chevronUpOutline,
  attachOutline, closeCircle, documentOutline, closeOutline,
  imagesOutline, checkmarkDoneOutline, clipboardOutline,
} from 'ionicons/icons';
import { RevisionService } from '../../../../core/services/revision.service';
import { Revision, ItemRevision, CalidadRevision } from '../../../../core/models/revision.model';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  private readonly revSvc     = inject(RevisionService);
  private readonly modalCtrl  = inject(ModalController);
  private readonly alertCtrl  = inject(AlertController);
  private readonly toastCtrl  = inject(ToastController);

  readonly revision     = signal<Revision | null>(null);
  readonly loading      = signal(true);
  readonly completando  = signal(false);
  readonly savingItems  = signal(new Set<number>());
  readonly expandedSet  = signal(new Set<number>());
  readonly obsGeneral   = signal('');
  readonly calidadLocal = signal<'ok' | 'observacion' | 'problema' | null>(null);

  // Track pending note values for blur-to-save
  private readonly pendingNotes = new Map<number, string>();
  // Track in-progress file uploads per item
  readonly uploadingItems = signal(new Set<number>());
  // Drag & Drop: item sobre el que se está arrastrando
  readonly draggingOverItemId   = signal<number | null>(null);
  readonly uploadingObs         = signal(false);
  readonly draggingObs          = signal(false);
  // Drag enter counters to handle shadow DOM false-positive dragleave events
  private readonly _dragCounters    = new Map<number, number>();
  private _dragCounterObs           = 0;

  readonly isTerminado  = computed(() => this.revision()?.estado === 'terminado');
  readonly checkedCount = computed(() =>
    this.revision()?.items.filter(i => i.checked).length ?? 0
  );
  readonly totalCount   = computed(() => this.revision()?.items.length ?? 0);
  readonly progress     = computed(() =>
    this.totalCount() === 0 ? 0 : Math.round((this.checkedCount() / this.totalCount()) * 100)
  );

  constructor() {
    addIcons({
      checkmarkCircleOutline, chevronDownOutline, chevronUpOutline,
      attachOutline, closeCircle, documentOutline, closeOutline,
      imagesOutline, checkmarkDoneOutline, clipboardOutline,
    });
  }

  ngOnInit() {
    this.revSvc.getOne(this.revisionId).subscribe({
      next: rev => {
        this.revision.set(rev);
        this.obsGeneral.set(rev.observacion_general ?? '');
        this.calidadLocal.set(rev.estado_calidad ?? null);
        // Auto-expand items that already have notes or files
        const autoExpand = new Set(
          rev.items
            .filter(i => i.checked || i.nota || (i.archivos?.length ?? 0) > 0)
            .map(i => i.id)
        );
        this.expandedSet.set(autoExpand);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast('Error al cargar la revisión', 'danger'); },
    });
  }

  dismiss() {
    this.modalCtrl.dismiss(null, this.isTerminado() ? 'completed' : 'updated');
  }

  // ── Item interaction ─────────────────────────────────────────────────────────

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
    // Optimistic update
    this.updateItemInSignal(item.id, { checked });
    if (checked) this.expandedSet.update(s => new Set([...s, item.id]));

    this.savingItems.update(s => new Set([...s, item.id]));
    this.revSvc.updateItem(this.revision()!.id, item.id, { checked }).subscribe({
      next: updated => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.updateItemInSignal(item.id, updated);
        // Reflect revision state based on current items
        const items = this.revision()?.items ?? [];
        const allChecked = items.length > 0 && items.every(i => i.checked);
        const anyChecked = items.some(i => i.checked);
        const estado = this.revision()?.estado;
        if (allChecked) {
          this.revision.update(r => r ? { ...r, estado: 'terminado' } : r);
        } else if (anyChecked && estado === 'pendiente') {
          this.revision.update(r => r ? { ...r, estado: 'en_proceso' } : r);
        }
      },
      error: (err) => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(item.id); return n; });
        this.updateItemInSignal(item.id, { checked: !checked }); // revert
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
    this.savingItems.update(s => new Set([...s, itemId]));
    this.revSvc.updateItem(this.revision()!.id, itemId, { nota }).subscribe({
      next: updated => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
        this.updateItemInSignal(itemId, { nota: updated.nota });
      },
      error: (err) => {
        this.savingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
        this.toast(err?.error?.error ?? 'Error al guardar nota', 'danger');
      },
    });
  }

  // ── Archivos de evidencia ────────────────────────────────────────────────────

  triggerUpload(itemId: number) {
    const input = document.getElementById(`upload-${itemId}`) as HTMLInputElement;
    input?.click();
  }

  async onFileSelected(event: Event, itemId: number) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.revision()) return;
    await this.uploadFile(itemId, file);
    input.value = '';
  }

  async removeArchivo(itemId: number, archivoId: number) {
    this.revSvc.removeArchivo(this.revision()!.id, itemId, archivoId).subscribe({
      next: () => {
        this.revision.update(r => {
          if (!r) return r;
          return {
            ...r,
            items: r.items.map(i =>
              i.id === itemId
                ? { ...i, archivos: i.archivos?.filter(a => a.id !== archivoId) }
                : i
            ),
          };
        });
      },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar archivo', 'danger'),
    });
  }

  // ── Fotos en observación general ─────────────────────────────────────────────

  triggerUploadObs() {
    (document.getElementById('upload-obs-general') as HTMLInputElement)?.click();
  }

  async onObsFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file || !this.revision()) return;
    await this.uploadObsFile(file);
    input.value = '';
  }

  onObsDragEnter(event: DragEvent) {
    if (this.isTerminado()) return;
    event.preventDefault();
    this._dragCounterObs++;
    this.draggingObs.set(true);
  }

  onObsDragOver(event: DragEvent) {
    if (this.isTerminado()) return;
    event.preventDefault();
  }

  onObsDragLeave() {
    this._dragCounterObs = Math.max(0, this._dragCounterObs - 1);
    if (this._dragCounterObs === 0) this.draggingObs.set(false);
  }

  onObsDrop(event: DragEvent) {
    event.preventDefault();
    this._dragCounterObs = 0;
    this.draggingObs.set(false);
    if (this.isTerminado()) return;
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    Array.from(files).forEach(f => this.uploadObsFile(f));
  }

  onPasteObs(event: ClipboardEvent) {
    if (this.isTerminado()) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        event.preventDefault();
        const file = items[i].getAsFile();
        if (file) this.uploadObsFile(file);
      }
    }
  }

  private async uploadObsFile(file: File) {
    if (!this.revision()) return;
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
        error: err => {
          this.uploadingObs.set(false);
          this.toast(err?.error?.error ?? 'Error al subir foto', 'danger');
        },
      });
    } catch {
      this.uploadingObs.set(false);
      this.toast('Error al leer el archivo', 'danger');
    }
  }

  removeArchivoObs(archivoId: number) {
    this.revSvc.removeArchivoObs(this.revision()!.id, archivoId).subscribe({
      next: () => {
        this.revision.update(r => r ? { ...r, archivos_obs: r.archivos_obs?.filter(a => a.id !== archivoId) } : r);
      },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar foto', 'danger'),
    });
  }

  viewImage(url: string) {
    window.open(url, '_blank');
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  onDragEnter(itemId: number, event: DragEvent) {
    if (this.isTerminado()) return;
    event.preventDefault();
    const count = (this._dragCounters.get(itemId) ?? 0) + 1;
    this._dragCounters.set(itemId, count);
    if (count === 1) this.draggingOverItemId.set(itemId);
  }

  onDragOver(itemId: number, event: DragEvent) {
    if (this.isTerminado()) return;
    event.preventDefault(); // imprescindible para que funcione el drop
  }

  onDragLeave(itemId: number) {
    const count = Math.max(0, (this._dragCounters.get(itemId) ?? 1) - 1);
    this._dragCounters.set(itemId, count);
    if (count === 0) {
      this._dragCounters.delete(itemId);
      this.draggingOverItemId.set(null);
    }
  }

  onDrop(itemId: number, event: DragEvent) {
    event.preventDefault();
    this._dragCounters.delete(itemId);
    this.draggingOverItemId.set(null);
    if (this.isTerminado()) return;
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    Array.from(files).forEach(f => this.uploadFile(itemId, f));
  }

  // ── Paste desde portapapeles ─────────────────────────────────────────────────

  onPasteItem(itemId: number, event: ClipboardEvent) {
    if (this.isTerminado()) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        event.preventDefault();
        const file = items[i].getAsFile();
        if (file) this.uploadFile(itemId, file);
      }
    }
  }

  private async uploadFile(itemId: number, file: File) {
    if (!this.revision()) return;
    if (file.size > 5 * 1024 * 1024) { this.toast('El archivo no puede superar 5 MB', 'danger'); return; }

    const tipo = file.type.startsWith('image/') ? 'imagen' : 'documento';
    this.uploadingItems.update(s => new Set([...s, itemId]));

    try {
      const url = await fileToDataUrl(file);
      this.revSvc.addArchivo(this.revision()!.id, itemId, { url, tipo }).subscribe({
        next: archivo => {
          this.uploadingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
          this.revision.update(r => {
            if (!r) return r;
            return {
              ...r,
              items: r.items.map(i =>
                i.id === itemId ? { ...i, archivos: [...(i.archivos ?? []), archivo] } : i
              ),
            };
          });
          if (!this.expandedSet().has(itemId)) {
            this.expandedSet.update(s => new Set([...s, itemId]));
          }
        },
        error: err => {
          this.uploadingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
          this.toast(err?.error?.error ?? 'Error al subir archivo', 'danger');
        },
      });
    } catch {
      this.uploadingItems.update(s => { const n = new Set(s); n.delete(itemId); return n; });
      this.toast('Error al leer el archivo', 'danger');
    }
  }

  // ── Completar revisión ───────────────────────────────────────────────────────

  async completar() {
    const alert = await this.alertCtrl.create({
      header: 'Completar revisión',
      message: 'Una vez marcada como terminada no podrás modificar los ítems. ¿Continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Completar', handler: () => this.doCompletar() },
      ],
    });
    await alert.present();
  }

  private doCompletar() {
    this.completando.set(true);
    this.revSvc.update(this.revision()!.id, {
      estado: 'terminado',
      observacion_general: this.obsGeneral() || null,
      estado_calidad: this.calidadLocal(),
    }).subscribe({
      next: rev => {
        this.completando.set(false);
        this.revision.set(rev);
        this.toast('Revisión completada');
      },
      error: err => {
        this.completando.set(false);
        this.toast(err?.error?.error ?? 'Error al completar revisión', 'danger');
      },
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
    return c ? (map[c] ?? c) : 'Sin evaluar';
  }

  calidadColor(c: CalidadRevision | null | string): string {
    const map: Record<string, string> = { ok: 'success', observacion: 'warning', problema: 'danger' };
    return c ? (map[c] ?? 'medium') : 'medium';
  }

  // ── Helper ───────────────────────────────────────────────────────────────────

  private updateItemInSignal(itemId: number, patch: Partial<ItemRevision>) {
    this.revision.update(r => {
      if (!r) return r;
      return { ...r, items: r.items.map(i => i.id === itemId ? { ...i, ...patch } : i) };
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
