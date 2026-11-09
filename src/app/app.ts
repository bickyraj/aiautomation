
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Topbar } from './layout/topbar/topbar';
import {Hero} from './pages/hero/hero';
import {About} from './pages/about/about';
import {Ingredients} from './pages/ingredients/ingredients';
import {ChipShowcase} from './pages/chip-showcase/chip-showcase';
import {SmoothieShowcase} from './pages/smoothie-showcase/smoothie-showcase';
import {ParticleUniverse} from './pages/particle-universe/particle-universe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Topbar, Hero, About, Ingredients, ChipShowcase, SmoothieShowcase, ParticleUniverse],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
