import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Plantilla, PlantillaForm } from '../../../core/models/models';
import { PlantillasService } from '../../../core/services/plantillas.service';

@Component({
  selector: 'app-plantillas-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-7 max-w-6xl">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-gray-800">Plantillas de checklist</h1>
          <p class="text-sm text-gray-400 mt-1">Crea plantillas reutilizables para distintos tipos de equipos</p>
        </div>
        <button (click)="abrirModal()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">+ Nueva plantilla</button>
      </div>

      <div *ngIf="cargando()" class="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      <div *ngIf="error()" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{{ error() }}</div>

      <div *ngIf="!cargando() && plantillas().length === 0" class="text-center py-16 text-gray-400">
        <div class="text-5xl mb-4">📄</div>
        <h3 class="text-base font-medium text-gray-500 mb-1">Sin plantillas</h3>
        <p class="text-sm mb-4">Crea plantillas de checklist para reutilizarlas en múltiples equipos</p>
        <button (click)="abrirModal()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">+ Crear plantilla</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" *ngIf="!cargando()">
        <div *ngFor="let p of plantillas()" class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-semibold text-gray-800 text-sm">{{ p.nombre }}</h3>
            <button (click)="eliminar(p.id)" class="px-2 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">🗑️</button>
          </div>
          <p *ngIf="p.descripcion" class="text-xs text-gray-400 mb-3">{{ p.descripcion }}</p>
          <div class="space-y-1 max-h-36 overflow-y-auto mb-3">
            <div *ngFor="let item of p.items" class="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
              <span class="text-blue-500 text-xs mt-0.5">•</span>
              <span class="text-xs text-gray-600">{{ item }}</span>
            </div>
          </div>
          <p class="text-xs text-gray-400">{{ p.items.length }} ítems</p>
        </div>
      </div>
    </div>

    <div *ngIf="mostrarModal()" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="cerrarModal()">
      <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 class="text-base font-semibold text-gray-800">Nueva plantilla</h2>
          <button (click)="cerrarModal()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">Nombre de la plantilla *</label>
            <input type="text" [(ngModel)]="form.nombre" placeholder="Ej: Mantenimiento PC, Revisión de red"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">Descripción</label>
            <input type="text" [(ngModel)]="form.descripcion" placeholder="Descripción opcional"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">Ítems del checklist</label>
            <div class="border border-gray-200 rounded-lg mb-2 max-h-48 overflow-y-auto divide-y divide-gray-100">
              <div *ngFor="let item of form.items; let i = index" class="flex items-center justify-between px-3 py-2">
                <span class="text-sm text-gray-700">{{ item }}</span>
                <button (click)="quitarItem(i)" class="text-gray-300 hover:text-red-500 transition-colors">✕</button>
              </div>
              <div *ngIf="form.items.length === 0" class="px-3 py-3 text-xs text-gray-400 text-center">No hay ítems aún</div>
            </div>
            <div class="flex gap-2">
              <input type="text" [(ngModel)]="nuevoItem" placeholder="Agregar ítem..." (keydown.enter)="agregarItem()"
                class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <button (click)="agregarItem()" class="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">+ Agregar</button>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button (click)="cerrarModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
          <button (click)="guardar()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Crear plantilla</button>
        </div>
      </div>
    </div>
  `
})
export class PlantillasListComponent implements OnInit {
  plantillas = signal<Plantilla[]>([]);
  cargando = signal(true);
  error = signal('');
  mostrarModal = signal(false);
  nuevoItem = '';
  form: PlantillaForm = { nombre: '', descripcion: '', items: [] };

  constructor(private svc: PlantillasService) {}
  ngOnInit() { this.cargar(); }
  cargar() { this.cargando.set(true); this.svc.getAll().subscribe({ next: d => { this.plantillas.set(d); this.cargando.set(false); } }); }
  abrirModal() { this.form = { nombre: '', descripcion: '', items: [] }; this.mostrarModal.set(true); }
  cerrarModal() { this.mostrarModal.set(false); }
  agregarItem() { const t = this.nuevoItem.trim(); if (!t) return; this.form.items = [...this.form.items, t]; this.nuevoItem = ''; }
  quitarItem(i: number) { this.form.items = this.form.items.filter((_, idx) => idx !== i); }
  guardar() { if (!this.form.nombre || !this.form.items.length) return; this.svc.create(this.form).subscribe({ next: () => { this.cerrarModal(); this.cargar(); } }); }
  eliminar(id: string) { if (!confirm('¿Eliminar esta plantilla?')) return; this.svc.delete(id).subscribe({ next: () => this.cargar() }); }
}