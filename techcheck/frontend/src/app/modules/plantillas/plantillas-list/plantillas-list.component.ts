import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Plantilla, PlantillaForm } from '../../../core/models/models';
import { PlantillasService } from '../../../core/services/plantillas.service';

@Component({
  selector: 'app-plantillas-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plantillas-list.component.html'
})
export class PlantillasListComponent implements OnInit {
  plantillas = signal<Plantilla[]>([]);
  cargando = signal(true);
  error = signal('');
  mostrarModal = signal(false);
  modoEdicion = signal(false);
  plantillaEditandoId = '';
  nuevoItem = '';
  form: PlantillaForm = { nombre: '', descripcion: '', items: [] };

  constructor(private svc: PlantillasService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.svc.getAll().subscribe({ next: d => { this.plantillas.set(d); this.cargando.set(false); } });
  }

  abrirModalNueva() {
    this.form = { nombre: '', descripcion: '', items: [] };
    this.modoEdicion.set(false);
    this.plantillaEditandoId = '';
    this.nuevoItem = '';
    this.mostrarModal.set(true);
  }

  abrirModalEditar(p: Plantilla) {
    this.form = { nombre: p.nombre, descripcion: p.descripcion, items: [...p.items] };
    this.modoEdicion.set(true);
    this.plantillaEditandoId = p.id;
    this.nuevoItem = '';
    this.mostrarModal.set(true);
  }

  cerrarModal() { this.mostrarModal.set(false); }

  agregarItem() {
    const t = this.nuevoItem.trim();
    if (!t) return;
    this.form.items = [...this.form.items, t];
    this.nuevoItem = '';
  }

  quitarItem(i: number) { this.form.items = this.form.items.filter((_, idx) => idx !== i); }

  guardar() {
    if (!this.form.nombre || !this.form.items.length) return;
    if (this.modoEdicion()) {
      this.svc.update(this.plantillaEditandoId, this.form).subscribe({
        next: () => { this.cerrarModal(); this.cargar(); }
      });
    } else {
      this.svc.create(this.form).subscribe({
        next: () => { this.cerrarModal(); this.cargar(); }
      });
    }
  }

  eliminar(id: string) {
    if (!confirm('Eliminar esta plantilla?')) return;
    this.svc.delete(id).subscribe({ next: () => this.cargar() });
  }
}