import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonSpinner, IonMenuButton, IonModal, IonInput,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, pencilOutline, trashOutline, personOutline, mailOutline } from 'ionicons/icons';
import { TecnicoService } from '../../../../core/services/tecnico.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Tecnico } from '../../../../core/models/tecnico.model';

@Component({
  selector: 'app-tecnico-list',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonSpinner, IonMenuButton, IonModal, IonInput,
  ],
  templateUrl: './tecnico-list.component.html',
})
export class TecnicoListComponent implements OnInit {
  private readonly tecnicoSvc = inject(TecnicoService);
  private readonly auth       = inject(AuthService);
  private readonly alertCtrl  = inject(AlertController);
  private readonly toastCtrl  = inject(ToastController);

  readonly tecnicos  = signal<Tecnico[]>([]);
  readonly loading   = signal(false);
  readonly isAdmin   = this.auth.isAdmin;

  readonly modalAbierto = signal(false);
  readonly editando     = signal<Tecnico | null>(null);
  readonly formNombre   = signal('');
  readonly formEmail    = signal('');
  readonly guardando    = signal(false);

  constructor() {
    addIcons({ add, pencilOutline, trashOutline, personOutline, mailOutline });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.tecnicoSvc.list().subscribe({
      next:  ts => { this.tecnicos.set(ts); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.toast('Error al cargar técnicos', 'danger'); },
    });
  }

  abrirCrear() {
    this.editando.set(null);
    this.formNombre.set('');
    this.formEmail.set('');
    this.modalAbierto.set(true);
  }

  abrirEditar(t: Tecnico) {
    this.editando.set(t);
    this.formNombre.set(t.nombre);
    this.formEmail.set(t.email ?? '');
    this.modalAbierto.set(true);
  }

  cerrarModal() { this.modalAbierto.set(false); }

  guardar() {
    if (!this.formNombre().trim()) { this.toast('El nombre es requerido', 'danger'); return; }
    this.guardando.set(true);
    const data = { nombre: this.formNombre().trim(), email: this.formEmail().trim() || undefined };
    const op = this.editando()
      ? this.tecnicoSvc.update(this.editando()!.id, data)
      : this.tecnicoSvc.create(data);

    op.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModal();
        this.load();
        this.toast(this.editando() ? 'Técnico actualizado' : 'Técnico creado');
      },
      error: err => {
        this.guardando.set(false);
        this.toast(err?.error?.error ?? 'Error al guardar', 'danger');
      },
    });
  }

  async confirmarEliminar(t: Tecnico) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar técnico',
      message: `¿Eliminar a "${t.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.eliminar(t) },
      ],
    });
    await alert.present();
  }

  private eliminar(t: Tecnico) {
    this.tecnicoSvc.remove(t.id).subscribe({
      next:  () => { this.tecnicos.update(l => l.filter(x => x.id !== t.id)); this.toast(`"${t.nombre}" eliminado`); },
      error: err => this.toast(err?.error?.error ?? 'Error al eliminar', 'danger'),
    });
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
