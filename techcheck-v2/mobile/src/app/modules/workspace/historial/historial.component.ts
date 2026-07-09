import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
  IonList, IonItem, IonLabel, IonSpinner, IonBadge, IonBackButton,
  IonSearchbar, IonModal, IonChip, IonText, IonButton,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, personOutline, calendarOutline, chevronBackOutline,
  trashOutline, eyeOutline, closeOutline, checkmarkOutline,
} from 'ionicons/icons';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { EquipoService } from '../../../core/services/equipo.service';
import { RevisionService } from '../../../core/services/revision.service';
import { AuthService } from '../../../core/services/auth.service';
import { Equipo } from '../../../core/models/equipo.model';
import { Revision, RevisionResumen } from '../../../core/models/revision.model';

interface EquipoHistorial {
  equipo: Equipo;
  revisiones: RevisionResumen[];
}

type RevisionFlat = RevisionResumen & { equipoNombre: string };

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
    IonList, IonItem, IonLabel, IonSpinner, IonBadge, IonBackButton,
    IonSearchbar, IonModal, IonChip, IonText, IonButton,
  ],
  templateUrl: './historial.component.html',
})
export class HistorialComponent implements OnInit {
  private readonly proyectoSvc = inject(ProyectoService);
  private readonly equipoSvc   = inject(EquipoService);
  private readonly revSvc      = inject(RevisionService);
  private readonly auth        = inject(AuthService);
  private readonly toastCtrl   = inject(ToastController);
  private readonly alertCtrl   = inject(AlertController);
  private readonly route       = inject(ActivatedRoute);

  readonly proyectoId     = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
  readonly proyectoNombre = signal('Proyecto');
  readonly historial      = signal<EquipoHistorial[]>([]);
  readonly loading        = signal(true);
  readonly isAdmin        = this.auth.isAdmin;

  readonly filtroTexto   = signal('');
  readonly filtroCalidad = signal<string>('todos');
  readonly revisionDetalle = signal<Revision | null>(null);

  readonly revisionesFiltradas = computed(() => {
    const texto   = this.filtroTexto().toLowerCase();
    const calidad = this.filtroCalidad();

    return this.historial().map(grupo => ({
      ...grupo,
      revisiones: grupo.revisiones.filter(rev => {
        const matchTexto = !texto ||
          `revisión #${rev.id}`.includes(texto) ||
          (rev.tecnico?.nombre?.toLowerCase().includes(texto) ?? false) ||
          grupo.equipo.nombre.toLowerCase().includes(texto);

        const matchCalidad = calidad === 'todos' ||
          (calidad === 'sin_evaluar' ? !rev.estado_calidad : rev.estado_calidad === calidad);

        return matchTexto && matchCalidad;
      }),
    })).filter(g => g.revisiones.length > 0);
  });

  readonly revisionesFlat = computed<RevisionFlat[]>(() =>
    this.revisionesFiltradas().flatMap(g =>
      g.revisiones.map(r => ({ ...r, equipoNombre: g.equipo.nombre }))
    )
  );

  constructor() {
    addIcons({
      checkmarkCircleOutline, personOutline, calendarOutline, chevronBackOutline,
      trashOutline, eyeOutline, closeOutline, checkmarkOutline,
    });
  }

  ngOnInit() {
    this.proyectoSvc.getOne(this.proyectoId).subscribe({
      next: p => this.proyectoNombre.set(p.nombre),
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.proyectoSvc.listEquipos(this.proyectoId).pipe(
      switchMap(equipos => {
        if (!equipos.length) return of([] as EquipoHistorial[]);
        return forkJoin(
          equipos.map(eq =>
            this.equipoSvc.listRevisiones(eq.id).pipe(
              map(revs => ({
                equipo: eq,
                revisiones: revs.filter(r => r.estado === 'terminado'),
              }))
            )
          )
        );
      }),
      map(results => results.filter(r => r.revisiones.length > 0))
    ).subscribe({
      next: data => { this.historial.set(data); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.toast('Error al cargar historial', 'danger');
      },
    });
  }

  verDetalle(rev: RevisionResumen) {
    this.revSvc.getOne(rev.id).subscribe({
      next: r => this.revisionDetalle.set(r),
      error: () => this.toast('Error al cargar detalle', 'danger'),
    });
  }

  cerrarDetalle() {
    this.revisionDetalle.set(null);
  }

  async eliminarRevision(rev: RevisionResumen) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar revisión',
      message: `¿Eliminar la Revisión #${rev.id}? Esta acción no se puede deshacer.`,
      backdropDismiss: false,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.revSvc.remove(rev.id).subscribe({
              next: () => { this.toast('Revisión eliminada'); this.load(); },
              error: () => this.toast('Error al eliminar', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  labelCalidad(c: string | null): string {
    const map: Record<string, string> = {
      ok: 'OK',
      observacion: 'Con obs.',
      problema: 'Con prob.',
    };
    return c ? (map[c] ?? c) : 'Sin evaluar';
  }

  colorCalidad(c: string | null): string {
    const map: Record<string, string> = { ok: 'success', observacion: 'warning', problema: 'danger' };
    return c ? (map[c] ?? 'medium') : 'medium';
  }

  totalRevisiones(): number {
    return this.historial().reduce((acc, h) => acc + h.revisiones.length, 0);
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
