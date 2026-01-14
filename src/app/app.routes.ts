import { Routes } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { DemoComponent } from './demo/demo';

export const routes: Routes = [
  {
    path: '',
    component: DemoComponent,
  },
  {
    path: 'page-scroll',
    loadComponent: () =>
      import('./page-scroll-demo/page-scroll-demo').then((m) => m.PageScrollDemoComponent),
    providers: [provideIonicAngular()],
  },
];
