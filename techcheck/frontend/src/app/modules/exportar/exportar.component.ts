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

  // Importar backup
  importando = signal(false);
  modoImport: 'agregar' | 'reemplazar' = 'agregar';
  importResult = signal<Record<string, number> | null>(null);
  importError = signal('');
  confirmarReemplazar = signal(false);

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

  exportarBackup() {
    this.exportarSvc.exportarJSON();
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.modoImport === 'reemplazar' && !this.confirmarReemplazar()) {
      alert('Confirma primero que deseas sobreescribir los datos existentes.');
      input.value = '';
      return;
    }

    this.importando.set(true);
    this.importResult.set(null);
    this.importError.set('');

    this.exportarSvc.importarJSON(file, this.modoImport).subscribe({
      next: result => {
        this.importResult.set(result);
        this.importando.set(false);
        this.confirmarReemplazar.set(false);
        input.value = '';
      },
      error: err => {
        this.importError.set(err.message || 'Error al importar el backup');
        this.importando.set(false);
        input.value = '';
      }
    });
  }

  totalImportado(): number {
    const r = this.importResult();
    if (!r) return 0;
    return Object.values(r).reduce((a, b) => a + b, 0);
  }
}
