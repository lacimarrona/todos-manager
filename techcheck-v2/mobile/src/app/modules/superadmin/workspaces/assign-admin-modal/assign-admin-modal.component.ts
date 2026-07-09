import { Component, Input, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonSpinner, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { WorkspaceService } from '../../../../core/services/workspace.service';

@Component({
  selector: 'app-assign-admin-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonInputPasswordToggle, IonSpinner, IonText,
  ],
  templateUrl: './assign-admin-modal.component.html',
})
export class AssignAdminModalComponent {
  @Input() workspaceId!: number;
  @Input() workspaceName!: string;

  private readonly wsSvc     = inject(WorkspaceService);
  private readonly modalCtrl = inject(ModalController);
  private readonly fb        = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  dismiss()   { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    this.wsSvc.assignAdmin(this.workspaceId, this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.modalCtrl.dismiss(null, 'saved');
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Error al crear admin');
      },
    });
  }
}
