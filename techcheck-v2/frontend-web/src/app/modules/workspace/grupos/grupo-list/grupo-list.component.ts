import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonSpinner, IonMenuButton, IonModal, IonInput, IonTextarea, IonToggle,
  IonBadge,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, pencilOutline, trashOutline, chevronForwardOutline, listOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';
import { GrupoElementoService, GrupoElemento, ElementoGrupo } from '../../../../core/services/grupo-elemento.service';

@Component({
  selector: 'app-grupo-list',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonSpinner, IonMenuButton, IonModal, IonInput, IonTextarea, IonToggle, IonBadge,
  ],
  templateUrl: './grupo-list.component.html',
  styleUrls: ['./grupo-list.component.scss'],
})
export class GrupoListComponent implements OnInit {
  private readonly svc       = inject(GrupoElementoService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly grupos   = signal<GrupoElemento[]>([]);
  readonly loading  = signal(true);

  // Grupo seleccionado para ver/editar sus elementos
  readonly grupoActivo = signal<GrupoElemento | null>(null);

  // Modales
  showGrupoModal    = false;
  showElementoModal = false;
  editingGrupo:    Partial<GrupoElemento>   = {};
  editingElemento: Partial<ElementoGrupo>   = {};
  editingGrupoId: number | null = null;
  editingElementoId: number | null = null;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listGrupos().subscribe({
      next: data => { this.grupos.set(data); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  // ── Grupos ─────────────────────────────────────────────────────────────
  openNuevoGrupo() {
    this.editingGrupoId = null;
    this.editingGrupo = { nombre: '', descripcion: '' };
    this.showGrupoModal = true;
  }

  openEditarGrupo(g: GrupoElemento) {
    this.editingGrupoId = g.id;
    this.editingGrupo = { nombre: g.nombre, descripcion: g.descripcion, activo: g.activo };
    this.showGrupoModal = true;
  }

  saveGrupo() {
    if (!this.editingGrupo.nombre?.trim()) return;
    const obs = this.editingGrupoId
      ? this.svc.updateGrupo(this.editingGrupoId, this.editingGrupo)
      : this.svc.createGrupo(this.editingGrupo);
    obs.subscribe({
      next: () => { this.showGrupoModal = false; this.load(); this.toast('Grupo guardado'); },
      error: () => this.toast('Error al guardar', 'danger'),
    });
  }

  async deleteGrupo(g: GrupoElemento) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar grupo',
      message: `¿Eliminar "${g.nombre}" y todos sus elementos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => {
          this.svc.deleteGrupo(g.id).subscribe({
            next: () => { this.load(); this.toast('Grupo eliminado'); },
            error: () => this.toast('Error al eliminar', 'danger'),
          });
        }},
      ],
    });
    await alert.present();
  }

  // ── Elementos ───────────────────────────────────────────────────────────
  verElementos(g: GrupoElemento) {
    this.grupoActivo.set(g);
  }

  volverAGrupos() {
    this.grupoActivo.set(null);
    this.load();
  }

  openNuevoElemento() {
    this.editingElementoId = null;
    this.editingElemento = { valor: '', descripcion: '' };
    this.showElementoModal = true;
  }

  openEditarElemento(e: ElementoGrupo) {
    this.editingElementoId = e.id;
    this.editingElemento = { valor: e.valor, descripcion: e.descripcion, activo: e.activo };
    this.showElementoModal = true;
  }

  saveElemento() {
    const g = this.grupoActivo();
    if (!g || !this.editingElemento.valor?.trim()) return;
    const obs = this.editingElementoId
      ? this.svc.updateElemento(g.id, this.editingElementoId, this.editingElemento)
      : this.svc.createElemento(g.id, this.editingElemento);
    obs.subscribe({
      next: () => {
        this.showElementoModal = false;
        this.svc.getGrupo(g.id).subscribe(updated => this.grupoActivo.set(updated));
        this.toast('Elemento guardado');
      },
      error: () => this.toast('Error al guardar', 'danger'),
    });
  }

  async deleteElemento(e: ElementoGrupo) {
    const g = this.grupoActivo();
    if (!g) return;
    const alert = await this.alertCtrl.create({
      header: 'Eliminar elemento',
      message: `¿Eliminar "${e.valor}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => {
          this.svc.deleteElemento(g.id, e.id).subscribe({
            next: () => {
              this.svc.getGrupo(g.id).subscribe(updated => this.grupoActivo.set(updated));
              this.toast('Elemento eliminado');
            },
            error: () => this.toast('Error al eliminar', 'danger'),
          });
        }},
      ],
    });
    await alert.present();
  }

  private async toast(message: string, color = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 2000, color, position: 'bottom' });
    await t.present();
  }

  constructor() {
    addIcons({ add, pencilOutline, trashOutline, chevronForwardOutline, listOutline, checkmarkOutline, closeOutline });
  }
}
