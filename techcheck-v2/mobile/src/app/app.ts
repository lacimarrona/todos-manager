import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { OfflineSyncService } from './core/services/offline-sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class App implements OnInit {
  private readonly offlineSync = inject(OfflineSyncService);

  ngOnInit() {
    this.offlineSync.init();
  }
}
