
import { Routes } from '@angular/router';
import { Overview } from './pages/overview/overview';
import {Home} from './pages/home/home';

export const routes: Routes = [
  {
    path: '',
    component: Home
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
