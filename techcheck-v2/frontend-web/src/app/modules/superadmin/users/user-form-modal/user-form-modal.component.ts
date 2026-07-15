import { Component, ChangeDetectionStrategy, Input, OnInit, signal, computed, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption,
  IonSpinner, IonText, IonBadge, IonIcon,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeCircle, addCircleOutline } from 'ionicons/icons';
import { UserService } from '../../../../core/services/user.service';
import { User, UserRole, WorkspaceSummary } from '../../../../core/models/user.model';
import { Workspace } from '../../../../core/models/workspace.model';

@Component({
  selector: 'app-superadmin-user-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonList, IonItem, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption,
    IonSpinner, IonText, IonBadge, IonIcon,
  ],
  templateUrl: './user-form-modal.component.html',
})
export class SuperadminUserFormModalComponent implements OnInit {
  @Input() user?: User;
  @Input() workspaces: Workspace[] = [];

  private readonly userSvc   = inject(UserService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);

  readonly loading         = signal(false);
  readonly error           = signal<string | null>(null);
  readonly nombre          = signal('');
  readonly email           = signal('');
  readonly password        = signal('');
  readonly rol             = signal<string>('usuario');
  readonly workspaceId     = signal<number | null>(null);
  readonly userWorkspaces  = signal<WorkspaceSummary[]>([]);
  readonly wsParaAgregar      = signal<number | null>(null);
  readonly wsRolParaAgregar   = signal<'admin' | 'usuario'>('usuario');
  readonly addingWs           = signal(false);

  readonly workspacesDisponibles = computed(() => {
    const asignados = this.userWorkspaces().map(w => w.id);
    return this.workspaces.filter(w => !asignados.includes(w.id));
  });

  readonly isValid = computed(() => {
    const basicOk = this.nombre().trim().length > 0 && this.email().includes('@');
    if (this.isEdit) return basicOk;
    const needsWorkspace = this.rol() !== 'superadmin';
    return basicOk && this.password().length >= 12 && (!needsWorkspace || this.workspaceId() !== null);
  });

  get isEdit() { return !!this.user; }

  constructor() { addIcons({ closeCircle, addCircleOutline }); }

  ngOnInit() {
    if (this.user) {
      this.nombre.set(this.user.nombre);
      this.email.set(this.user.email);
      this.rol.set(this.user.rol);
      // Cargar workspaces del usuario
      this.userWorkspaces.set(this.user.workspaces ?? []);
      if (!this.user.workspaces?.length) {
        this.userSvc.listWorkspaces(this.user.id).subscribe({
          next: ws => this.userWorkspaces.set(ws),
          error: () => {},
        });
      }
    }
  }

  dismiss() { this.modalCtrl.dismiss(null, 'cancel'); }

  submit() {
    if (!this.isValid() || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    if (this.isEdit) {
      const dto: Record<string, unknown> = { nombre: this.nombre(), email: this.email(), rol: this.rol() };
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

  addWorkspace() {
    const wsId   = this.wsParaAgregar();
    const wsRol  = this.wsRolParaAgregar();
    if (!wsId || this.addingWs()) return;
    this.addingWs.set(true);
    this.userSvc.addWorkspace(this.user!.id, wsId, wsRol).subscribe({
      next: async () => {
        const ws = this.workspaces.find(w => w.id === wsId);
        if (ws) this.userWorkspaces.update(list => [...list, { id: ws.id, nombre: ws.nombre }]);
        this.wsParaAgregar.set(null);
        this.wsRolParaAgregar.set('usuario');
        this.addingWs.set(false);
        const t = await this.toastCtrl.create({ message: 'Workspace agregado', duration: 2000, color: 'success' });
        await t.present();
      },
      error: async err => {
        this.addingWs.set(false);
        const t = await this.toastCtrl.create({ message: err?.error?.error ?? 'Error al agregar', duration: 2500, color: 'danger' });
        await t.present();
      },
    });
  }

  removeWorkspace(wsId: number) {
    this.userSvc.removeWorkspace(this.user!.id, wsId).subscribe({
      next: async () => {
        this.userWorkspaces.update(list => list.filter(w => w.id !== wsId));
        const t = await this.toastCtrl.create({ message: 'Workspace eliminado', duration: 2000, color: 'success' });
        await t.present();
      },
      error: async err => {
        const t = await this.toastCtrl.create({ message: err?.error?.error ?? 'Error al eliminar', duration: 2500, color: 'danger' });
        await t.present();
      },
    });
  }
}
