import { Routes } from '@angular/router';
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
  },
  {
    path: 'dynamic-height',
    loadComponent: () =>
      import('./dynamic-height-demo/dynamic-height-demo').then((m) => m.DynamicHeightDemoComponent),
  },
];
