import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption,
  IonSpinner, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { UserService } from '../../../../core/services/user.service';
import { User, UserRole } from '../../../../core/models/user.model';
import { Workspace } from '../../../../core/models/workspace.model';

@Component({
  selector: 'app-superadmin-user-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption,
    IonSpinner, IonText,
  ],
  templateUrl: './user-form-modal.component.html',
})
export class SuperadminUserFormModalComponent implements OnInit {
  @Input() user?: User;
  @Input() workspaces: Workspace[] = [];

  private readonly userSvc   = inject(UserService);
  private readonly modalCtrl = inject(ModalController);

  readonly loading      = signal(false);
  readonly error        = signal<string | null>(null);
  readonly nombre       = signal('');
  readonly email        = signal('');
  readonly password     = signal('');
  readonly rol          = signal<string>('usuario');
  readonly workspaceId  = signal<number | null>(null);

  readonly isValid = computed(() => {
    const basicOk = this.nombre().trim().length > 0 && this.email().includes('@');
    if (this.isEdit) return basicOk;
    const needsWorkspace = this.rol() !== 'superadmin';
    return basicOk && this.password().length >= 6 && (!needsWorkspace || this.workspaceId() !== null);
  });

  get isEdit() { return !!this.user; }

  ngOnInit() {
    if (this.user) {
      this.nombre.set(this.user.nombre);
      this.email.set(this.user.email);
      this.rol.set(this.user.rol);
    }
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    if (this.isEdit) {
      const dto: Record<string, unknown> = {
        nombre: this.nombre(),
        email:  this.email(),
        rol:    this.rol(),
      };
      if (this.password()) dto['password'] = this.password();

      this.userSvc.update(this.user!.id, dto).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al guardar'); },
      });
    } else {
      this.userSvc.create({
        nombre:       this.nombre(),
        email:        this.email(),
        password:     this.password(),
        rol:          this.rol() as UserRole,
        workspace_id: this.rol() === 'superadmin' ? null : this.workspaceId()!,
      }).subscribe({
        next:  () => { this.loading.set(false); this.modalCtrl.dismiss(null, 'saved'); },
        error: err => { this.loading.set(false); this.error.set(err?.error?.error ?? 'Error al crear usuario'); },
      });
    }
  }
}
