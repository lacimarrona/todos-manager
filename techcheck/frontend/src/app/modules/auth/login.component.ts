import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  username = '';
  password = '';
  cargando = signal(false);
  error    = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.error.set('');
    if (!this.username || !this.password) {
      this.error.set('Nombre de usuario y contraseña son requeridos');
      return;
    }
    this.cargando.set(true);
    this.auth.login({ username: this.username, password: this.password }).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(err?.error?.message || 'Credenciales inválidas');
        this.cargando.set(false);
      },
    });
  }
}
