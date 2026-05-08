import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tecnico, TecnicoForm } from '../../../core/models/models';
import { TecnicosService } from '../../../core/services/otros.services';

@Component({
  selector: 'app-tecnicos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-7 max-w-3xl">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-gray-800">Técnicos</h1>
          <p class="text-sm text-gray-400 mt-1">Gestiona los técnicos que realizan las revisiones</p>
        </div>
        <button (click)="mostrarModal.set(true)" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">+ Agregar técnico</button>
      </div>

      <div *ngIf="cargando()" class="text-center py-12 text-gray-400 text-sm">Cargando...</div>

      <div *ngIf="!cargando() && tecnicos().length === 0" class="text-center py-16 text-gray-400">
        <div class="text-5xl mb-4">👥</div>
        <h3 class="text-base font-medium text-gray-500 mb-1">Sin técnicos</h3>
        <p class="text-sm">Agrega los técnicos que realizan revisiones</p>
      </div>

      <div class="space-y-3" *ngIf="!cargando()">
        <div *ngFor="let t of tecnicos()" class="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4">
          <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
            {{ t.nombre | slice:0:2 | uppercase }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-800 text-sm">{{ t.nombre }}</div>
            <div *ngIf="t.email" class="text-xs text-gray-400 truncate">{{ t.email }}</div>
          </div>
          <button (click)="eliminar(t.id)" class="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">🗑️ Eliminar</button>
        </div>
      </div>
    </div>

    <div *ngIf="mostrarModal()" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" (click)="mostrarModal.set(false)">
      <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 class="text-base font-semibold text-gray-800">Nuevo técnico</h2>
          <button (click)="mostrarModal.set(false)" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">Nombre completo *</label>
            <input type="text" [(ngModel)]="form.nombre" placeholder="Ej: Carlos Martínez"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input type="email" [(ngModel)]="form.email" placeholder="correo@empresa.com"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button (click)="mostrarModal.set(false)" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
          <button (click)="guardar()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Agregar</button>
        </div>
      </div>
    </div>
  `
})
export class TecnicosListComponent implements OnInit {
  tecnicos = signal<Tecnico[]>([]);
  cargando = signal(true);
  mostrarModal = signal(false);
  form: TecnicoForm = { nombre: '', email: '' };

  constructor(private svc: TecnicosService) {}
  ngOnInit() { this.cargar(); }
  cargar() { this.cargando.set(true); this.svc.getAll().subscribe({ next: d => { this.tecnicos.set(d); this.cargando.set(false); } }); }
  guardar() { if (!this.form.nombre.trim()) return; this.svc.create(this.form).subscribe({ next: () => { this.mostrarModal.set(false); this.form = { nombre: '', email: '' }; this.cargar(); } }); }
  eliminar(id: string) { if (!confirm('¿Eliminar este técnico?')) return; this.svc.delete(id).subscribe({ next: () => this.cargar() }); }
}