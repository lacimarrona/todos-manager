import { Component, ChangeDetectionStrategy, Input, signal, computed, inject, OnInit } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonIcon, IonSpinner, IonText,
  IonSegment, IonSegmentButton, IonLabel, IonRadioGroup, IonRadio,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAddOutline, personOutline } from 'ionicons/icons';
import { WorkspaceService } from '../../../../core/services/workspace.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-assign-admin-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonInputPasswordToggle, IonIcon, IonSpinner, IonText,
    IonSegment, IonSegmentButton, IonLabel, IonRadioGroup, IonRadio,
  ],
  templateUrl: './assign-admin-modal.component.html',
})
export class AssignAdminModalComponent implements OnInit {
  @Input() workspaceId!: number;
  @Input() workspaceName!: string;

  private readonly wsSvc     = inject(WorkspaceService);
  private readonly modalCtrl = inject(ModalController);

  readonly modo      = signal<'nuevo' | 'existente'>('nuevo');
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);
  // Modo nuevo
  readonly nombre    = signal('');
  readonly email     = signal('');
  readonly password  = signal('');

  // Modo existente
  readonly disponibles   = signal<User[]>([]);
  readonly loadingLista  = signal(false);
  readonly selectedId    = signal<number | null>(null);

  readonly isValidNuevo = computed(() =>
    this.nombre().trim().length > 0 &&
    this.email().includes('@') &&
    this.password().length >= 6
  );

  readonly isValidExistente = computed(() => this.selectedId() !== null);

  constructor() {
    addIcons({ personAddOutline, personOutline });
  }

  ngOnInit() {
    this.cargarDisponibles();
  }

  cargarDisponibles() {
    this.loadingLista.set(true);
    this.wsSvc.listDisponibles().subscribe({
      next: users => { this.disponibles.set(users); this.loadingLista.set(false); },
      error: ()    => { this.loadingLista.set(false); },
    });
  }

  cambiarModo(ev: CustomEvent) {
    this.modo.set(ev.detail.value);
    this.error.set(null);
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  seleccionar(id: number) { this.selectedId.set(id); }

  submit() {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    if (this.modo() === 'nuevo') {
      if (!this.isValidNuevo()) { this.loading.set(false); return; }
      this.wsSvc.assignAdmin(this.workspaceId, {
        nombre:   this.nombre(),
        email:    this.email(),
        password: this.password(),
      }).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al crear admin'); },
      });
    } else {
      if (!this.isValidExistente()) { this.loading.set(false); return; }
      this.wsSvc.assignExisting(this.workspaceId, this.selectedId()!).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al asignar admin'); },
      });
    }
  }
}
