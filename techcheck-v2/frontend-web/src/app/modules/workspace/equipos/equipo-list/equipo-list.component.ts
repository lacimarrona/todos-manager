import { Component, OnInit, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle,
  IonCardContent, IonSpinner, IonBackButton, IonFab, IonFabButton,
  IonModal, IonSelect, IonSelectOption,
  ModalController, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  clipboardOutline, personOutline, timeOutline, chevronForwardOutline,
  add, pencilOutline, trashOutline, archiveOutline, downloadOutline,
  calendarOutline, checkmarkCircleOutline,
} from 'ionicons/icons';
import { ProyectoService, TareaVencida } from '../../../../core/services/proyecto.service';
import { EquipoService } from '../../../../core/services/equipo.service';
import { RevisionService } from '../../../../core/services/revision.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PlantillaService } from '../../../../core/services/plantilla.service';
import { Equipo, RevisionEstado } from '../../../../core/models/equipo.model';
import { Plantilla } from '../../../../core/models/plantilla.model';
import { DatePipe } from '@angular/common';
import { RevisionModalComponent } from '../../revisiones/revision-modal/revision-modal.component';
import { EquipoFormModalComponent } from '../equipo-form-modal/equipo-form-modal.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-equipo-list',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonSpinner, IonBackButton, IonFab, IonFabButton,
    IonModal, IonSelect, IonSelectOption,
    FormsModule, DatePipe,
  ],
  templateUrl: './equipo-list.component.html',
})
export class EquipoListComponent implements OnInit {
  private readonly proyectoSvc  = inject(ProyectoService);
  private readonly equipoSvc    = inject(EquipoService);
  private readonly revSvc       = inject(RevisionService);
  private readonly auth         = inject(AuthService);
  private readonly plantillaSvc = inject(PlantillaService);
  private readonly modalCtrl    = inject(ModalController);
  private readonly alertCtrl    = inject(AlertController);
  private readonly toastCtrl    = inject(ToastController);
  private readonly route        = inject(ActivatedRoute);

  readonly proyectoId     = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
  readonly proyectoNombre = signal('Proyecto');
  readonly equipos        = signal<Equipo[]>([]);
  readonly loading        = signal(false);
  readonly abriendo       = signal<number | null>(null);
  readonly filtro         = signal<'pendiente' | 'en_proceso' | 'terminado' | 'archivado' | 'perdidas'>('pendiente');
  readonly vencidas       = signal<TareaVencida[]>([]);
  readonly isAdmin        = this.auth.isAdmin;

  // Import signals
  readonly mostrarImport     = signal(false);
  readonly importNombre      = signal<{ nombre: string }[]>([]);
  readonly importPlantillaId = signal<number | null>(null);
  readonly importandoMasivo  = signal(false);
  readonly importError       = signal<string | null>(null);
  readonly importExito       = signal<string | null>(null);

  // Plantillas para el select de importar
  readonly plantillas = signal<Plantilla[]>([]);

  constructor() {
    addIcons({
      clipboardOutline, personOutline, timeOutline, chevronForwardOutline,
      add, pencilOutline, trashOutline, archiveOutline, downloadOutline,
      calendarOutline, checkmarkCircleOutline,
    });
  }

  ngOnInit() {
    this.proyectoSvc.getOne(this.proyectoId).subscribe({
      next: p => this.proyectoNombre.set(p.nombre),
    });
    if (this.isAdmin()) {
      this.plantillaSvc.list().subscribe({
        next: ps => this.plantillas.set(ps),
        error: () => {},
      });
    }
    this.loadEquipos();
  }

  loadEquipos() {
    if (this.filtro() === 'perdidas') { this.loadVencidas(); return; }
    this.loading.set(true);
    const f = this.filtro();

    if (f === 'archivado') {
      this.proyectoSvc.listEquipos(this.proyectoId, undefined, true).subscribe({
        next: resp => {
          this.equipos.set(resp.data.filter(e => e.archivado === true));
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.toast('Error al cargar equipos', 'danger'); },
      });
    } else {
      this.proyectoSvc.listEquipos(this.proyectoId, f).subscribe({
        next: resp => { this.equipos.set(resp.data); this.loading.set(false); },
        error: () => { this.loading.set(false); this.toast('Error al cargar equipos', 'danger'); },
      });
    }
  }

  loadVencidas() {
    this.loading.set(true);
    this.proyectoSvc.getTareasVencidas(this.proyectoId).subscribe({
      next: v => { this.vencidas.set(v); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast('Error al cargar tareas perdidas', 'danger'); },
    });
  }

  onFiltroChange(event: CustomEvent) {
    this.filtro.set((event as CustomEvent<{ value: 'pendiente' | 'en_proceso' | 'terminado' | 'archivado' | 'perdidas' }>).detail.value);
    this.loadEquipos();
  }

  readonly DIAS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  diasLabel(dias: number[]): string {
    return (dias ?? []).map(d => this.DIAS_LABELS[d]).join(', ');
  }

  async openRevision(equipo: Equipo) {
    if (this.abriendo()) return;
    this.abriendo.set(equipo.id);

    try {
      const { data: revisiones } = await firstValueFrom(this.equipoSvc.listRevisiones(equipo.id));
      const equipoTieneItems = (equipo.items?.length ?? 0) > 0;
      const activa = revisiones?.find(
        r => r.estado !== 'terminado' && !(equipoTieneItems && r.item_count === 0)
      );
      let revisionId: number;

      if (activa) {
        revisionId = activa.id;
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

  async openCreate() {
    try {
      const modal = await this.modalCtrl.create({
        component: EquipoFormModalComponent,
        componentProps: { proyectoId: this.proyectoId },
        cssClass: 'form-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'saved') this.loadEquipos();
    } catch (err) {
      this.toast('Error al abrir el formulario', 'danger');
    }
  }

  async openEdit(eq: Equipo, event: Event) {
    event.stopPropagation();
    try {
      const modal = await this.modalCtrl.create({
        component: EquipoFormModalComponent,
        componentProps: { equipo: eq, proyectoId: this.proyectoId },
        cssClass: 'form-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'saved') this.loadEquipos();
    } catch (err) {
      this.toast('Error al abrir el formulario', 'danger');
    }
  }

  async confirmDelete(eq: Equipo, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Eliminar equipo',
      message: `¿Eliminar "${eq.nombre}"? Se eliminarán todas sus revisiones.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete(eq) },
      ],
    });
    await alert.present();
  }

  private delete(eq: Equipo) {
    this.equipoSvc.remove(eq.id).subscribe({
      next:  () => { this.equipos.update(list => list.filter(e => e.id !== eq.id)); this.toast(`"${eq.nombre}" eliminado`); },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  async archivar(eq: Equipo, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Archivar equipo',
      message: `¿Archivar "${eq.nombre}"? El equipo pasará al estado archivado y no aparecerá en la lista activa.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Archivar',
          handler: () => {
            this.equipoSvc.archivar(eq.id).subscribe({
              next:  () => { this.loadEquipos(); this.toast(`"${eq.nombre}" archivado`); },
              error: err => this.toast(err?.error?.error ?? 'Error al archivar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async exportar(eq: Equipo, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Exportar equipo',
      message: `Selecciona el formato de exportación para "${eq.nombre}"`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'JSON',
          handler: () => {
            this.equipoSvc.exportarJSON(eq.id).subscribe({
              next: (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                this.descargar(blob, `equipo-${eq.nombre}-${eq.id}.json`);
              },
              error: () => this.toast('Error al exportar JSON', 'danger'),
            });
          },
        },
        {
          text: 'CSV',
          handler: () => {
            this.equipoSvc.exportarCSV(eq.id).subscribe({
              next: (blob) => {
                this.descargar(blob, `equipo-${eq.nombre}-${eq.id}.csv`);
              },
              error: () => this.toast('Error al exportar CSV', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  private descargar(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Importar equipos masivo ---

  abrirImport() {
    this.importNombre.set([]);
    this.importPlantillaId.set(null);
    this.importError.set(null);
    this.importExito.set(null);
    this.mostrarImport.set(true);
  }

  cerrarImport() {
    this.mostrarImport.set(false);
  }

  onImportFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.importError.set(null);
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      this.equipoSvc.importarExcelNombres(file).subscribe({
        next: ({ equipos }) => {
          if (!equipos.length) {
            this.importError.set('No se encontraron equipos. Asegúrate de que la columna A tenga los nombres.');
            return;
          }
          this.importNombre.set(equipos);
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
        const equipos = lineas.slice(inicio).map(l => ({ nombre: l.split(',')[0].trim() })).filter(e => e.nombre);
        if (!equipos.length) { this.importError.set('No se encontraron equipos en el archivo.'); return; }
        this.importNombre.set(equipos);
      };
      reader.onerror = () => this.importError.set('Error al leer el archivo.');
      reader.readAsText(file);
    }
  }

  descargarPlantillaExcel() {
    this.equipoSvc.descargarPlantillaExcel().subscribe({
      next: blob => this.descargar(blob, 'plantilla_importar_equipos.xlsx'),
      error: () => this.toast('Error al generar la plantilla Excel', 'danger'),
    });
  }

  confirmarImport() {
    const equipos = this.importNombre();
    if (equipos.length === 0) {
      this.importError.set('No hay equipos para importar.');
      return;
    }
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
        this.importExito.set(`Se importaron ${res.ids.length} equipos correctamente.`);
        this.loadEquipos();
      },
      error: (err) => {
        this.importandoMasivo.set(false);
        this.importError.set(err?.error?.error ?? 'Error al importar equipos.');
      },
    });
  }

  // --- Helpers de visualización ---

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
