
import { Routes } from '@angular/router';
import { Overview } from './pages/overview/overview';
import {Home} from './pages/home/home';
import {Handicrafts} from './pages/handicrafts/handicrafts';
import {Parallax} from './pages/parallax/parallax';
import {Jewels} from './pages/jewels/jewels';

export const routes: Routes = [
  {
    path: '',
    component: Home
  },
  {
    path: 'jewels',
    component: Jewels
  },
  {
    path: 'parallax',
    component: Parallax
  },
  {
    path: 'handicrafts',
    component: Handicrafts
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
