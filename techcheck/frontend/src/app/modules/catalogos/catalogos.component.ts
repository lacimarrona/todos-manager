import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GrupoElemento, ElementoGrupo } from '../../core/models/models';
import { CatalogosService } from '../../core/services/otros.services';

interface GrupoForm { nombre: string; descripcion: string; }
interface ElementoForm { valor: string; descripcion: string; }

@Component({
  selector: 'app-catalogos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogos.component.html',
})
export class CatalogosComponent implements OnInit {
  grupos = signal<GrupoElemento[]>([]);
  cargando = signal(true);

  // Navegación: null = lista de grupos, non-null = detalle de grupo
  grupoActivo = signal<GrupoElemento | null>(null);

  // Modal grupo
  modalGrupo = signal(false);
  editandoGrupoId = signal<string | null>(null);
  formGrupo: GrupoForm = { nombre: '', descripcion: '' };

  // Modal elemento
  modalElemento = signal(false);
  editandoElementoId = signal<string | null>(null);
  formElemento: ElementoForm = { valor: '', descripcion: '' };

  guardando = signal(false);
  errorMsg = signal('');

  constructor(private svc: CatalogosService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.svc.getAll().subscribe({
      next: data => {
        this.grupos.set(data);
        // Si hay un grupo activo, actualizar su instancia
        const activo = this.grupoActivo();
        if (activo) {
          const actualizado = data.find(g => g.id === activo.id);
          this.grupoActivo.set(actualizado ?? null);
        }
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // ── Grupos ──────────────────────────────────────────────────────────────

  verGrupo(g: GrupoElemento) { this.grupoActivo.set(g); }
  volverAGrupos() { this.grupoActivo.set(null); this.cargar(); }

  abrirNuevoGrupo() {
    this.editandoGrupoId.set(null);
    this.formGrupo = { nombre: '', descripcion: '' };
    this.errorMsg.set('');
    this.modalGrupo.set(true);
  }

  abrirEditarGrupo(g: GrupoElemento) {
    this.editandoGrupoId.set(g.id);
    this.formGrupo = { nombre: g.nombre, descripcion: g.descripcion };
    this.errorMsg.set('');
    this.modalGrupo.set(true);
  }

  guardarGrupo() {
    if (!this.formGrupo.nombre.trim()) { this.errorMsg.set('El nombre es requerido'); return; }
    this.guardando.set(true);
    const id = this.editandoGrupoId();
    const obs = id
      ? this.svc.updateGrupo(id, this.formGrupo)
      : this.svc.createGrupo(this.formGrupo);
    obs.subscribe({
      next: () => { this.modalGrupo.set(false); this.guardando.set(false); this.cargar(); },
      error: () => { this.errorMsg.set('Error al guardar'); this.guardando.set(false); },
    });
  }

  eliminarGrupo(g: GrupoElemento) {
    if (!confirm(`¿Eliminar el grupo "${g.nombre}" y todos sus elementos?`)) return;
    this.svc.deleteGrupo(g.id).subscribe({ next: () => this.cargar() });
  }

  // ── Elementos ────────────────────────────────────────────────────────────

  abrirNuevoElemento() {
    this.editandoElementoId.set(null);
    this.formElemento = { valor: '', descripcion: '' };
    this.errorMsg.set('');
    this.modalElemento.set(true);
  }

  abrirEditarElemento(e: ElementoGrupo) {
    this.editandoElementoId.set(e.id);
    this.formElemento = { valor: e.valor, descripcion: e.descripcion };
    this.errorMsg.set('');
    this.modalElemento.set(true);
  }

  guardarElemento() {
    const g = this.grupoActivo();
    if (!g) return;
    if (!this.formElemento.valor.trim()) { this.errorMsg.set('El valor es requerido'); return; }
    this.guardando.set(true);
    const id = this.editandoElementoId();
    const obs = id
      ? this.svc.updateElemento(g.id, id, this.formElemento)
      : this.svc.createElemento(g.id, this.formElemento);
    obs.subscribe({
      next: () => { this.modalElemento.set(false); this.guardando.set(false); this.cargar(); },
      error: () => { this.errorMsg.set('Error al guardar'); this.guardando.set(false); },
    });
  }

  eliminarElemento(e: ElementoGrupo) {
    const g = this.grupoActivo();
    if (!g) return;
    if (!confirm(`¿Eliminar el elemento "${e.valor}"?`)) return;
    this.svc.deleteElemento(g.id, e.id).subscribe({ next: () => this.cargar() });
  }

  cerrarModalGrupo() { this.modalGrupo.set(false); }
  cerrarModalElemento() { this.modalElemento.set(false); }
}
