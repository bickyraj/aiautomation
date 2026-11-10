
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Topbar } from './layout/topbar/topbar';
import {ParticleUniverse} from './pages/particle-universe/particle-universe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Topbar, ParticleUniverse],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
