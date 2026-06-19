import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Proyecto, ProyectoForm, Equipo, EquipoForm, ItemEquipo, Plantilla, Tecnico, RevisionForm, ItemRevision, EstadoRevision, ArchivoAdjunto } from '../../../core/models/models';
import { ProyectosService } from '../../../core/services/proyectos.service';
import { EquiposService } from '../../../core/services/equipos.service';
import { PlantillasService } from '../../../core/services/plantillas.service';
import { TecnicosService, RevisionesService } from '../../../core/services/otros.services';
import { ArchivosService } from '../../../core/services/archivos.service';

type FiltroEstado = 'pendiente' | 'en_proceso' | 'terminado' | 'archivado';

@Component({
  selector: 'app-equipos-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipos-list.component.html'
})
export class EquiposListComponent implements OnInit {
  vista = signal<'proyectos' | 'equipos'>('proyectos');

  proyectos = signal<Proyecto[]>([]);
  proyectoActual = signal<Proyecto | null>(null);
  equipos = signal<Equipo[]>([]);
  plantillas = signal<Plantilla[]>([]);
  tecnicos = signal<Tecnico[]>([]);
  cargando = signal(true);
  error = signal('');
  importandoProyecto = signal(false);
  exitoImport = signal('');

  mostrarModalImportarEquipos = signal(false);
  importEquiposData: { nombre: string; descripcion: string }[] = [];
  importEquiposTecnicoId = '';
  importEquiposPlantillaId = '';
  importandoEquipos = signal(false);
  importEquiposExito = signal('');
  importEquiposError = signal('');

  filtroActivo = signal<FiltroEstado>('pendiente');

  mostrarModalProyecto = signal(false);
  modoEdicionProyecto = signal(false);
  proyectoEditandoId = '';
  formProyecto: ProyectoForm = { nombre: '', descripcion: '' };

  mostrarModalEquipo = signal(false);
  modoEdicionEquipo = signal(false);
  equipoEditandoId = '';
  nuevoItem = '';
  formEquipo: EquipoForm = { nombre: '', descripcion: '', items: [], plantillaId: '', proyectoIds: [], tecnicoAsignadoId: '' };

  mostrarModalRevision = signal(false);
  equipoRevisando = signal<Equipo | null>(null);
  guardandoRevision = signal(false);
  tecnicoId = '';
  estado: EstadoRevision = 'ok';
  observacionGeneral = '';
  itemsRevision = signal<ItemRevision[]>([]);
  fotosBase64: (ArchivoAdjunto | string)[] = [];
  revisionRetomadaId = '';

  mostrarModalExportarEquipo = signal(false);
  equipoExportando: Equipo | null = null;

  mostrarModalExportarProyecto = signal(false);
  proyectoExportando: Proyecto | null = null;

  constructor(
    private proyectosSvc: ProyectosService,
    private equiposSvc: EquiposService,
    private plantillasSvc: PlantillasService,
    private tecnicosSvc: TecnicosService,
    private revisionesSvc: RevisionesService,
    private archivosSvc: ArchivosService,
  ) {}

  ngOnInit() {
    this.cargarProyectos();
    this.plantillasSvc.getAll().subscribe({ next: d => this.plantillas.set(d) });
    this.tecnicosSvc.getAll().subscribe({ next: d => this.tecnicos.set(d) });
  }

  cargarProyectos() {
    this.cargando.set(true);
    this.proyectosSvc.getAll().subscribe({
      next: d => { this.proyectos.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar proyectos'); this.cargando.set(false); }
    });
  }

  entrarProyecto(proyecto: Proyecto) {
    this.proyectoActual.set(proyecto);
    this.vista.set('equipos');
    this.filtroActivo.set('pendiente');
    this.cargarEquiposFiltrados('pendiente');
  }

  volverAProyectos() {
    this.vista.set('proyectos');
    this.proyectoActual.set(null);
    this.equipos.set([]);
    this.cargarProyectos();
  }

  cambiarFiltro(filtro: FiltroEstado) {
    this.filtroActivo.set(filtro);
    this.cargarEquiposFiltrados(filtro);
  }

  cargarEquiposFiltrados(filtro: FiltroEstado) {
    this.cargando.set(true);
    const proyectoId = this.proyectoActual()!.id;
    this.proyectosSvc.getEquiposFiltrados(proyectoId, filtro).subscribe({
      next: d => { this.equipos.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar equipos'); this.cargando.set(false); }
    });
  }

  abrirModalNuevoProyecto() {
    this.formProyecto = { nombre: '', descripcion: '' };
    this.modoEdicionProyecto.set(false);
    this.proyectoEditandoId = '';
    this.mostrarModalProyecto.set(true);
  }

  abrirModalEditarProyecto(p: Proyecto, event: Event) {
    event.stopPropagation();
    this.formProyecto = { nombre: p.nombre, descripcion: p.descripcion };
    this.proyectoEditandoId = p.id;
    this.modoEdicionProyecto.set(true);
    this.mostrarModalProyecto.set(true);
  }

  guardarProyecto() {
    if (!this.formProyecto.nombre.trim()) return;
    if (this.modoEdicionProyecto()) {
      this.proyectosSvc.update(this.proyectoEditandoId, this.formProyecto).subscribe({
        next: () => { this.mostrarModalProyecto.set(false); this.cargarProyectos(); }
      });
    } else {
      this.proyectosSvc.create(this.formProyecto).subscribe({
        next: () => { this.mostrarModalProyecto.set(false); this.cargarProyectos(); }
      });
    }
  }

  eliminarProyecto(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Eliminar este proyecto? Los equipos asociados no se eliminaran.')) return;
    this.proyectosSvc.delete(id).subscribe({ next: () => this.cargarProyectos() });
  }

  abrirModalNuevoEquipo() {
    this.formEquipo = { nombre: '', descripcion: '', items: [], plantillaId: '', proyectoIds: [this.proyectoActual()!.id], tecnicoAsignadoId: '' };
    this.modoEdicionEquipo.set(false);
    this.equipoEditandoId = '';
    this.nuevoItem = '';
    this.mostrarModalEquipo.set(true);
  }

  abrirModalEditarEquipo(equipo: Equipo) {
    this.formEquipo = {
      nombre: equipo.nombre,
      descripcion: equipo.descripcion,
      items: equipo.items.map(i => typeof i === 'string'
        ? { label: i, observacionGuia: '', archivosGuia: [] }
        : { ...i, archivosGuia: i.archivosGuia || [] }),
      plantillaId: equipo.plantillaId || '',
      proyectoIds: equipo.proyectoIds || [],
      tecnicoAsignadoId: equipo.tecnicoAsignadoId || ''
    };
    this.equipoEditandoId = equipo.id;
    this.modoEdicionEquipo.set(true);
    this.nuevoItem = '';
    this.mostrarModalEquipo.set(true);
  }

  onPlantillaChange() {
    if (!this.formEquipo.plantillaId) return;
    const p = this.plantillas().find(x => x.id === this.formEquipo.plantillaId);
    if (p) this.formEquipo.items = p.items.map((i: any) => ({
      label: typeof i === 'string' ? i : i.label,
      observacionGuia: typeof i === 'string' ? '' : (i.observacionGuia || ''),
      archivosGuia: typeof i === 'string' ? [] : [...(i.archivosGuia || [])]
    }));
  }

  agregarItem() {
    const t = this.nuevoItem.trim();
    if (!t) return;
    this.formEquipo.items = [...this.formEquipo.items, { label: t, observacionGuia: '', archivosGuia: [] }];
    this.nuevoItem = '';
  }

  quitarItem(idx: number) {
    this.formEquipo.items = this.formEquipo.items.filter((_, i) => i !== idx);
  }

  updateObservacionGuia(idx: number, valor: string) {
    const updated = [...this.formEquipo.items];
    updated[idx] = { ...updated[idx], observacionGuia: valor };
    this.formEquipo.items = [...updated];
  }

  onArchivoGuiaChange(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => this.leerArchivoGuiaEquipo(idx, file));
  }

  eliminarArchivoGuia(idx: number, archivoIdx: number) {
    const updated = [...this.formEquipo.items];
    updated[idx] = { ...updated[idx], archivosGuia: updated[idx].archivosGuia.filter((_, i) => i !== archivoIdx) };
    this.formEquipo.items = [...updated];
  }

  guardarEquipo() {
    if (!this.formEquipo.nombre.trim()) return;
    if (this.modoEdicionEquipo()) {
      this.equiposSvc.update(this.equipoEditandoId, this.formEquipo).subscribe({
        next: () => { this.mostrarModalEquipo.set(false); this.cargarEquiposFiltrados(this.filtroActivo()); }
      });
    } else {
      this.equiposSvc.create(this.formEquipo).subscribe({
        next: () => { this.mostrarModalEquipo.set(false); this.cargarEquiposFiltrados(this.filtroActivo()); }
      });
    }
  }

  eliminarEquipo(id: string) {
    if (!confirm('Eliminar este equipo?')) return;
    this.equiposSvc.delete(id).subscribe({
      next: () => this.cargarEquiposFiltrados(this.filtroActivo())
    });
  }

  archivarEquipo(id: string) {
    if (!confirm('¿Archivar este equipo? Ya no podrás modificarlo.')) return;
    this.equiposSvc.archivar(id).subscribe({
      next: () => this.cargarEquiposFiltrados(this.filtroActivo())
    });
  }

  abrirModalRevision(equipo: Equipo) {
    this.equipoRevisando.set(equipo);
    this.tecnicoId = '';
    this.estado = 'ok';
    this.observacionGeneral = '';
    this.fotosBase64 = [];
    if (equipo.ultimaRevision) {
      const ultima = equipo.ultimaRevision;
      const completados = ultima.items.filter(i => i.checked).length;
      const total = ultima.items.length;
      if (total > 0) {
        this.itemsRevision.set(ultima.items.map(i => ({
          ...i,
          nota: i.nota || '',
          archivos: i.archivos || [],
          observacionGuia: i.observacionGuia || '',
          archivosGuia: i.archivosGuia || []
        })));
        this.tecnicoId = ultima.tecnicoId || '';
        this.estado = ultima.estado;
        this.observacionGeneral = ultima.observacionGeneral || '';
        this.fotosBase64 = [...(ultima.fotos || [])];
        this.revisionRetomadaId = ultima.id;
      } else {
        this.itemsRevision.set(equipo.items.map(i => ({
          label: typeof i === 'string' ? i : i.label,
          checked: false,
          nota: '',
          archivos: [],
          observacionGuia: typeof i === 'string' ? '' : i.observacionGuia,
          archivosGuia: typeof i === 'string' ? [] : (i.archivosGuia || [])
        })));
        this.revisionRetomadaId = '';
      }
    } else {
      this.itemsRevision.set(equipo.items.map(i => ({
        label: typeof i === 'string' ? i : i.label,
        checked: false,
        nota: '',
        archivos: [],
        observacionGuia: typeof i === 'string' ? '' : i.observacionGuia,
        archivosGuia: typeof i === 'string' ? [] : (i.archivosGuia || [])
      })));
      this.revisionRetomadaId = '';
    }
    this.mostrarModalRevision.set(true);
  }

  cerrarModalRevision() {
    if (confirm('¿Estás seguro de salir? Los cambios no guardados se perderán.')) {
      this.mostrarModalRevision.set(false);
    }
  }

  cerrarModalEquipo() {
    if (confirm('¿Estás seguro de salir? Los cambios no guardados se perderán.')) {
      this.mostrarModalEquipo.set(false);
    }
  }

  cerrarModalProyecto() {
    if (confirm('¿Estás seguro de salir? Los cambios no guardados se perderán.')) {
      this.mostrarModalProyecto.set(false);
    }
  }

  toggleItem(idx: number) {
    const updated = [...this.itemsRevision()];
    updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
    this.itemsRevision.set(updated);
  }

  updateNota(idx: number, nota: string) {
    const updated = [...this.itemsRevision()];
    updated[idx] = { ...updated[idx], nota };
    this.itemsRevision.set(updated);
  }

  onFotoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => this.leerFotoRevision(file));
  }

  onArchivoItemChange(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => this.leerArchivoRevisionItem(idx, file));
  }

  eliminarArchivoItem(idx: number, archivoIdx: number) {
    const updated = [...this.itemsRevision()];
    updated[idx] = { ...updated[idx], archivos: updated[idx].archivos.filter((_, i) => i !== archivoIdx) };
    this.itemsRevision.set(updated);
  }

  // ── Paste / Drop — ítems del formulario de equipo ─────────────
  draggingEquipoItemIdx: number | null = null;

  onPasteEquipoItem(idx: number, event: ClipboardEvent) {
    const clipItems = event.clipboardData?.items;
    if (!clipItems) return;
    for (let i = 0; i < clipItems.length; i++) {
      if (clipItems[i].type.startsWith('image/')) {
        event.preventDefault();
        const file = clipItems[i].getAsFile();
        if (file) this.leerArchivoGuiaEquipo(idx, file);
      }
    }
  }

  onDragOverEquipoItem(idx: number, event: DragEvent) {
    event.preventDefault();
    this.draggingEquipoItemIdx = idx;
  }

  onDragLeaveEquipoItem(event: DragEvent) {
    if (!event.relatedTarget || !(event.currentTarget as Element).contains(event.relatedTarget as Element)) {
      this.draggingEquipoItemIdx = null;
    }
  }

  onDropEquipoItem(idx: number, event: DragEvent) {
    event.preventDefault();
    this.draggingEquipoItemIdx = null;
    const files = event.dataTransfer?.files;
    if (!files) return;
    Array.from(files).forEach(f => this.leerArchivoGuiaEquipo(idx, f));
  }

  private leerArchivoGuiaEquipo(idx: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.archivosSvc.subir(file.name, file.type, e.target!.result as string).subscribe({
        next: (ref) => {
          const updated = [...this.formEquipo.items];
          updated[idx] = { ...updated[idx], archivosGuia: [...(updated[idx].archivosGuia || []), ref] };
          this.formEquipo.items = [...updated];
        }
      });
    };
    reader.readAsDataURL(file);
  }

  // ── Paste / Drop — notas de ítems de revisión ─────────────────
  draggingRevisionItemIdx: number | null = null;

  onPasteRevisionItem(idx: number, event: ClipboardEvent) {
    const clipItems = event.clipboardData?.items;
    if (!clipItems) return;
    for (let i = 0; i < clipItems.length; i++) {
      if (clipItems[i].type.startsWith('image/')) {
        event.preventDefault();
        const file = clipItems[i].getAsFile();
        if (file) this.leerArchivoRevisionItem(idx, file);
      }
    }
  }

  onDragOverRevisionItem(idx: number, event: DragEvent) {
    event.preventDefault();
    this.draggingRevisionItemIdx = idx;
  }

  onDragLeaveRevisionItem(event: DragEvent) {
    if (!event.relatedTarget || !(event.currentTarget as Element).contains(event.relatedTarget as Element)) {
      this.draggingRevisionItemIdx = null;
    }
  }

  onDropRevisionItem(idx: number, event: DragEvent) {
    event.preventDefault();
    this.draggingRevisionItemIdx = null;
    const files = event.dataTransfer?.files;
    if (!files) return;
    Array.from(files).forEach(f => this.leerArchivoRevisionItem(idx, f));
  }

  private leerArchivoRevisionItem(idx: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.archivosSvc.subir(file.name, file.type, e.target!.result as string).subscribe({
        next: (ref) => {
          const updated = [...this.itemsRevision()];
          updated[idx] = { ...updated[idx], archivos: [...(updated[idx].archivos || []), ref] };
          this.itemsRevision.set([...updated]);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  // ── Paste / Drop — observación general de revisión ────────────
  draggingObsGeneral = false;

  onPasteObsGeneral(event: ClipboardEvent) {
    const clipItems = event.clipboardData?.items;
    if (!clipItems) return;
    for (let i = 0; i < clipItems.length; i++) {
      if (clipItems[i].type.startsWith('image/')) {
        event.preventDefault();
        const file = clipItems[i].getAsFile();
        if (file) this.leerFotoRevision(file);
      }
    }
  }

  onDragOverObsGeneral(event: DragEvent) {
    event.preventDefault();
    this.draggingObsGeneral = true;
  }

  onDragLeaveObsGeneral(event: DragEvent) {
    if (!event.relatedTarget || !(event.currentTarget as Element).contains(event.relatedTarget as Element)) {
      this.draggingObsGeneral = false;
    }
  }

  onDropObsGeneral(event: DragEvent) {
    event.preventDefault();
    this.draggingObsGeneral = false;
    const files = event.dataTransfer?.files;
    if (!files) return;
    Array.from(files).forEach(f => this.leerFotoRevision(f));
  }

  eliminarFotoRevision(idx: number) {
    this.fotosBase64 = this.fotosBase64.filter((_, i) => i !== idx);
  }

  private leerFotoRevision(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.archivosSvc.subir(file.name, file.type, e.target!.result as string).subscribe({
        next: (ref) => { this.fotosBase64 = [...this.fotosBase64, ref]; }
      });
    };
    reader.readAsDataURL(file);
  }

  get itemsCompletados(): number { return this.itemsRevision().filter(i => i.checked).length; }
  get totalItemsRevision(): number { return this.itemsRevision().length; }
  get revisionCompleta(): boolean { return this.totalItemsRevision > 0 && this.itemsCompletados === this.totalItemsRevision; }

  guardarRevision() {
    const equipo = this.equipoRevisando();
    if (!equipo) return;
    const tecnico = this.tecnicos().find(t => t.id === this.tecnicoId);
    const form: RevisionForm = {
      equipoId: equipo.id,
      tecnicoId: this.tecnicoId || undefined,
      tecnicoNombre: tecnico?.nombre || '',
      estado: this.estado,
      items: this.itemsRevision(),
      observacionGeneral: this.observacionGeneral,
      fotos: this.fotosBase64
    };
    this.guardandoRevision.set(true);

    const alTerminar = () => {
      this.guardandoRevision.set(false);
      this.mostrarModalRevision.set(false);
      this.revisionRetomadaId = '';
      this.cargarEquiposFiltrados(this.filtroActivo());
    };

    if (this.revisionRetomadaId) {
      this.revisionesSvc.update(this.revisionRetomadaId, form).subscribe({
        next: () => alTerminar(),
        error: () => { this.guardandoRevision.set(false); }
      });
    } else {
      this.revisionesSvc.create(form).subscribe({
        next: () => alTerminar(),
        error: () => { this.guardandoRevision.set(false); }
      });
    }
  }

  progreso(equipo: Equipo): number {
    if (!equipo.ultimaRevision || !equipo.items.length) return 0;
    const ok = equipo.ultimaRevision.items.filter(i => i.checked).length;
    return Math.round((ok / equipo.items.length) * 100);
  }

  estadoBadge(equipo: Equipo): string {
    if (!equipo.ultimaRevision) return 'sin-revision';
    return equipo.ultimaRevision.estado;
  }

  estadoLabel(equipo: Equipo): string {
    if (!equipo.ultimaRevision) return 'Sin revisiones';
    const map: any = { ok: 'OK', observacion: 'Observaciones', problema: 'Problemas' };
    return map[equipo.ultimaRevision.estado] || equipo.ultimaRevision.estado;
  }

  trackById(_: number, e: any) { return e.id; }

  abrirModalImportarEquipos() {
    this.importEquiposData = [];
    this.importEquiposTecnicoId = '';
    this.importEquiposPlantillaId = '';
    this.importEquiposExito.set('');
    this.importEquiposError.set('');
    this.mostrarModalImportarEquipos.set(true);
  }

  onExcelEquiposChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.importEquiposError.set('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const result: { nombre: string; descripcion: string }[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const nombre = String(row[0]).trim();
          const descripcion = row[1] ? String(row[1]).trim() : '';
          if (nombre) result.push({ nombre, descripcion });
        }
        this.importEquiposData = result;
        if (result.length === 0) this.importEquiposError.set('No se encontraron equipos en el archivo.');
      } catch {
        this.importEquiposError.set('Error al leer el archivo. Verifica que sea un Excel valido.');
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
  }

  confirmarImportarEquipos() {
    if (!this.importEquiposData.length) return;
    this.importandoEquipos.set(true);
    this.importEquiposExito.set('');
    this.importEquiposError.set('');

    const plantilla = this.plantillas().find(p => p.id === this.importEquiposPlantillaId);
    const items = plantilla
      ? plantilla.items.map((i: any) => ({
          label: typeof i === 'string' ? i : i.label,
          observacionGuia: typeof i === 'string' ? '' : (i.observacionGuia || ''),
          archivosGuia: typeof i === 'string' ? [] : [...(i.archivosGuia || [])]
        }))
      : [];

    let creados = 0;
    const total = this.importEquiposData.length;
    this.importEquiposData.forEach(row => {
      const form: EquipoForm = {
        nombre: row.nombre,
        descripcion: row.descripcion,
        items: items.map((i: any) => ({ ...i })),
        plantillaId: this.importEquiposPlantillaId || '',
        proyectoIds: [this.proyectoActual()!.id],
        tecnicoAsignadoId: this.importEquiposTecnicoId || ''
      };
      this.equiposSvc.create(form).subscribe({
        next: () => {
          creados++;
          if (creados === total) {
            this.importandoEquipos.set(false);
            this.importEquiposExito.set(`${creados} equipo(s) importados correctamente`);
            this.importEquiposData = [];
            this.cargarEquiposFiltrados(this.filtroActivo());
            setTimeout(() => {
              this.mostrarModalImportarEquipos.set(false);
              this.importEquiposExito.set('');
            }, 2000);
          }
        },
        error: () => {
          this.importandoEquipos.set(false);
          this.importEquiposError.set('Error al importar algunos equipos.');
        }
      });
    });
  }

  archivoData(a: ArchivoAdjunto | string): string {
    if (typeof a === 'string') return a;
    return a.url || a.data || '';
  }

  esImagenArchivo(a: ArchivoAdjunto | string): boolean {
    if (typeof a === 'string') return a.startsWith('data:image');
    return a.tipo.startsWith('image/');
  }

  puedeVerEnNavegador(a: ArchivoAdjunto | string): boolean {
    if (typeof a === 'string') {
      return a.startsWith('data:image') || a.startsWith('data:application/pdf') || a.startsWith('data:text/');
    }
    return a.tipo.startsWith('image/') || a.tipo === 'application/pdf' || a.tipo.startsWith('text/');
  }

  descargarArchivo(a: ArchivoAdjunto | string) {
    const data = this.archivoData(a);
    const nombre = typeof a === 'string' ? 'archivo_adjunto' : a.nombre;
    const link = document.createElement('a');
    link.href = data;
    link.download = nombre;
    link.click();
  }

  abrirArchivoAdjunto(a: ArchivoAdjunto | string) {
    const data = this.archivoData(a);
    const win = window.open();
    if (win) {
      if (this.esImagenArchivo(a)) {
        win.document.write(`<img src="${data}" style="max-width:100%;display:block">`);
      } else {
        win.document.write(`<embed src="${data}" style="width:100%;height:100vh">`);
      }
      win.document.close();
    }
  }

  abrirArchivo(archivo: string) {
    const win = window.open();
    if (win) {
      win.document.write(`<img src="${archivo}" style="max-width:100%;display:block">`);
      win.document.close();
    }
  }

  abrirModalExportarProyecto(proyecto: Proyecto, event: Event) {
    event.stopPropagation();
    this.proyectoExportando = proyecto;
    this.mostrarModalExportarProyecto.set(true);
  }

  exportarProyectoJSON(proyecto: Proyecto) {
    this.proyectosSvc.exportarProyecto(proyecto.id).subscribe({
      next: datos => {
        this.descargar(
          new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }),
          `${proyecto.nombre.replace(/\s+/g, '_')}_proyecto_techcheck.json`
        );
        this.mostrarModalExportarProyecto.set(false);
      }
    });
  }

  exportarProyectoCSV(proyecto: Proyecto) {
    this.proyectosSvc.exportarProyecto(proyecto.id).subscribe({
      next: datos => {
        const { equipos, revisiones, tecnicos } = datos;
        const encabezado = ['Proyecto', 'Equipo', 'Descripcion', 'Tecnico Asignado', 'Fecha Revision', 'Tecnico que Reviso', 'Estado General', 'Item', 'Completado', 'Observacion', 'Tiene Archivos'];
        const estadoMap: Record<string, string> = { ok: 'OK', observacion: 'Con observaciones', problema: 'Con problemas' };
        const filas: string[][] = [];

        equipos.forEach((equipo: any) => {
          const tecnicoNombre = (tecnicos as any[]).find(t => t.id === equipo.tecnicoAsignadoId)?.nombre || '';
          const revsEquipo = (revisiones as any[]).filter(r => r.equipoId === equipo.id);

          if (revsEquipo.length === 0) {
            const items = equipo.items.length > 0 ? equipo.items : [null];
            items.forEach((item: any) => {
              const label = !item ? '' : (typeof item === 'string' ? item : item.label);
              filas.push([proyecto.nombre, equipo.nombre, equipo.descripcion || '', tecnicoNombre, '', '', '', label, '', '', '']);
            });
          } else {
            revsEquipo.forEach((rev: any) => {
              const fecha = new Date(rev.creadoEn).toLocaleString('es-ES');
              const estado = estadoMap[rev.estado] || rev.estado;
              rev.items.forEach((item: any) => {
                filas.push([
                  proyecto.nombre,
                  equipo.nombre,
                  equipo.descripcion || '',
                  tecnicoNombre,
                  fecha,
                  rev.tecnicoNombre || '',
                  estado,
                  item.label,
                  item.checked ? 'Si' : 'No',
                  item.nota || '',
                  (item.archivos && item.archivos.length > 0) ? 'Si' : 'No'
                ]);
              });
            });
          }
        });

        const csv = this.generarCSV(encabezado, filas);
        this.descargar(
          new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
          `${proyecto.nombre.replace(/\s+/g, '_')}_proyecto_techcheck.csv`
        );
        this.mostrarModalExportarProyecto.set(false);
      }
    });
  }

  abrirModalExportarEquipo(equipo: Equipo, event: Event) {
    event.stopPropagation();
    this.equipoExportando = equipo;
    this.mostrarModalExportarEquipo.set(true);
  }

  exportarEquipoJSON(equipo: Equipo) {
    this.revisionesSvc.getAll({ equipoId: equipo.id }).subscribe({
      next: revisiones => {
        this.descargar(
          new Blob([JSON.stringify({ equipo, revisiones }, null, 2)], { type: 'application/json' }),
          `${equipo.nombre.replace(/\s+/g, '_')}_equipo_techcheck.json`
        );
        this.mostrarModalExportarEquipo.set(false);
      }
    });
  }

  exportarEquipoCSV(equipo: Equipo) {
    this.revisionesSvc.getAll({ equipoId: equipo.id }).subscribe({
      next: revisiones => {
        const encabezado = ['Equipo', 'Descripcion', 'Tecnico Asignado', 'Fecha Revision', 'Tecnico que Reviso', 'Estado General', 'Item', 'Completado', 'Observacion', 'Tiene Archivos'];
        const estadoMap: Record<string, string> = { ok: 'OK', observacion: 'Con observaciones', problema: 'Con problemas' };
        const filas: string[][] = [];

        if (revisiones.length === 0) {
          const items = equipo.items.length > 0 ? equipo.items : [null as any];
          items.forEach((item: any) => {
            const label = !item ? '' : (typeof item === 'string' ? item : item.label);
            filas.push([equipo.nombre, equipo.descripcion || '', equipo.tecnicoAsignadoNombre || '', '', '', '', label, '', '', '']);
          });
        } else {
          revisiones.forEach(rev => {
            const fecha = new Date(rev.creadoEn).toLocaleString('es-ES');
            const estado = estadoMap[rev.estado] || rev.estado;
            rev.items.forEach(item => {
              filas.push([
                equipo.nombre,
                equipo.descripcion || '',
                equipo.tecnicoAsignadoNombre || '',
                fecha,
                rev.tecnicoNombre || '',
                estado,
                item.label,
                item.checked ? 'Si' : 'No',
                item.nota || '',
                (item.archivos && item.archivos.length > 0) ? 'Si' : 'No'
              ]);
            });
          });
        }

        const csv = this.generarCSV(encabezado, filas);
        this.descargar(
          new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
          `${equipo.nombre.replace(/\s+/g, '_')}_equipo_techcheck.csv`
        );
        this.mostrarModalExportarEquipo.set(false);
      }
    });
  }

  descargarPlantillaEquiposExcel() {
    const XLSX = (window as any).XLSX;
    const data = [
      ['nombre', 'descripcion'],
      ['PC-Recepcion-01', 'Dell OptiPlex, i5, 8GB RAM']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    XLSX.writeFile(wb, 'plantilla_importar_equipos.xlsx');
  }

  private generarCSV(encabezado: string[], filas: string[][]): string {
    const escapar = (v: string) => {
      const s = String(v ?? '');
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [encabezado, ...filas].map(fila => fila.map(escapar).join(',')).join('\r\n');
  }

  private descargar(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

onImportarProyecto(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  this.importandoProyecto.set(true);
  this.exitoImport.set('');
  this.error.set('');
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target!.result as string);
      this.proyectosSvc.importarProyecto(datos).subscribe({
        next: () => {
          this.importandoProyecto.set(false);
          this.exitoImport.set('Proyecto importado correctamente');
          this.cargarProyectos();
          setTimeout(() => this.exitoImport.set(''), 3000);
        },
        error: () => {
          this.importandoProyecto.set(false);
          this.error.set('Error al importar el proyecto');
        }
      });
    } catch {
      this.importandoProyecto.set(false);
      this.error.set('El archivo no es un JSON valido');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

}