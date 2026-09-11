import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportarService } from '../../core/services/otros.services';
import { ProyectosService } from '../../core/services/proyectos.service';
import { Proyecto } from '../../core/models/models';

@Component({
  selector: 'app-exportar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exportar.component.html',
})
export class ExportarComponent implements OnInit {
  proyectos = signal<Proyecto[]>([]);
  proyectoSeleccionado = signal('');

  importando = signal(false);
  importResult = signal<{ proyectos: number; equipos: number; plantillas: number; tecnicos: number; revisiones: number; tareas: number } | null>(null);
  importError = signal('');

  constructor(
    private exportarSvc: ExportarService,
    private proyectosSvc: ProyectosService,
  ) {}

  ngOnInit() {
    this.proyectosSvc.getAll().subscribe(p => this.proyectos.set(p));
  }

  exportarCSV() {
    this.exportarSvc.exportarCSV(this.proyectoSeleccionado() || undefined);
  }

  exportarJSON() {
    this.exportarSvc.exportarJSON();
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importando.set(true);
    this.importResult.set(null);
    this.importError.set('');

    this.exportarSvc.importarJSON(file).subscribe({
      next: result => {
        this.importResult.set(result);
        this.importando.set(false);
        input.value = '';
      },
      error: err => {
        this.importError.set(err.message || 'Error al importar');
        this.importando.set(false);
        input.value = '';
      }
    });
  }
}
