import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonTextarea, IonToggle, IonLabel,
  IonSpinner, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { WorkspaceService } from '../../../../core/services/workspace.service';
import { Workspace } from '../../../../core/models/workspace.model';

@Component({
  selector: 'app-workspace-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonTextarea, IonToggle, IonLabel,
    IonSpinner, IonText,
  ],
  templateUrl: './workspace-form-modal.component.html',
})
export class WorkspaceFormModalComponent implements OnInit {
  @Input() workspace?: Workspace;

  private readonly wsSvc     = inject(WorkspaceService);
  private readonly modalCtrl = inject(ModalController);

  readonly loading     = signal(false);
  readonly error       = signal<string | null>(null);
  readonly nombre      = signal('');
  readonly descripcion = signal('');
  readonly activo      = signal(true);

  readonly isValid = computed(() => this.nombre().trim().length > 0);

  get isEdit() { return !!this.workspace; }

  ngOnInit() {
    if (this.workspace) {
      this.nombre.set(this.workspace.nombre);
      this.descripcion.set(this.workspace.descripcion ?? '');
      this.activo.set(this.workspace.activo);
    }
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const req$ = this.isEdit
      ? this.wsSvc.update(this.workspace!.id, {
          nombre:      this.nombre(),
          descripcion: this.descripcion() || undefined,
          activo:      this.activo(),
        })
      : this.wsSvc.create({
          nombre:      this.nombre(),
          descripcion: this.descripcion() || undefined,
        });

    req$.subscribe({
      next: () => {
        this.loading.set(false);
        this.modalCtrl.dismiss(null, 'saved');
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Error al guardar');
      },
    });
  }
}
