import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonTextarea, IonSpinner, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { ProyectoService } from '../../../../core/services/proyecto.service';
import { Proyecto } from '../../../../core/models/proyecto.model';

@Component({
  selector: 'app-proyecto-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonTextarea, IonSpinner, IonText,
  ],
  templateUrl: './proyecto-form-modal.component.html',
})
export class ProyectoFormModalComponent implements OnInit {
  @Input() proyecto?: Proyecto;

  private readonly proyectoSvc = inject(ProyectoService);
  private readonly modalCtrl   = inject(ModalController);

  readonly loading     = signal(false);
  readonly error       = signal<string | null>(null);
  readonly nombre      = signal('');
  readonly descripcion = signal('');

  readonly isValid = computed(() => this.nombre().trim().length > 0);

  get isEdit() { return !!this.proyecto; }

  ngOnInit() {
    if (this.proyecto) {
      this.nombre.set(this.proyecto.nombre);
      this.descripcion.set(this.proyecto.descripcion ?? '');
    }
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const dto = { nombre: this.nombre(), descripcion: this.descripcion() || undefined };
    const req$ = this.isEdit
      ? this.proyectoSvc.update(this.proyecto!.id, dto)
      : this.proyectoSvc.create(dto);

    req$.subscribe({
      next: () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
      error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
    });
  }
}
