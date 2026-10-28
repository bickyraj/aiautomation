
import { Routes } from '@angular/router';
import { Overview } from './pages/overview/overview';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full'
  },
  {
    path: 'overview',
    component: Overview
  },
  {
    path: '**',
    redirectTo: 'overview'
  }
];
