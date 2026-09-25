import { Injectable, signal } from '@angular/core';

export interface ConfirmOpciones {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligro?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly actual = signal<ConfirmOpciones | null>(null);
  private resolver: ((ok: boolean) => void) | null = null;

  confirmar(opciones: ConfirmOpciones): Promise<boolean> {
    this.resolver?.(false);
    this.actual.set(opciones);
    return new Promise(resolve => (this.resolver = resolve));
  }

  confirmarSalida(): Promise<boolean> {
    return this.confirmar({
      titulo: '¿Salir sin guardar?',
      mensaje: 'Tienes cambios sin guardar. Si sales ahora, se perderán.',
      textoConfirmar: 'Salir sin guardar',
      textoCancelar: 'Seguir editando',
      peligro: true,
    });
  }

  responder(ok: boolean) {
    this.actual.set(null);
    const r = this.resolver;
    this.resolver = null;
    r?.(ok);
  }
}
