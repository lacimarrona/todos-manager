import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  // Login
  username = '';
  password = '';

  // Setup
  setupNombre   = '';
  setupUsername = '';
  setupPassword = '';
  setupConfirm  = '';

  modo = signal<'login' | 'setup' | 'verificando'>('verificando');
  cargando = signal(false);
  error    = signal('');

  constructor(public theme: ThemeService, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.auth.checkSetupNeeded().subscribe({
      next: (needsSetup) => this.modo.set(needsSetup ? 'setup' : 'login'),
      error: () => this.modo.set('login'),
    });
  }

  submitLogin() {
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

  submitSetup() {
    this.error.set('');
    if (!this.setupNombre || !this.setupUsername || !this.setupPassword) {
      this.error.set('Todos los campos son requeridos');
      return;
    }
    if (this.setupPassword.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.setupPassword !== this.setupConfirm) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.cargando.set(true);
    this.auth.setup({
      nombre:   this.setupNombre,
      username: this.setupUsername,
      password: this.setupPassword,
    }).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(err?.error?.message || 'Error al crear el administrador');
        this.cargando.set(false);
      },
    });
  }
}
