import { Component } from '@angular/core';
import {ParticleUniverse} from '../particle-universe/particle-universe';

@Component({
  selector: 'app-parallax',
  imports: [
    ParticleUniverse
  ],
  templateUrl: './parallax.html',
  styleUrl: './parallax.scss',
})
export class Parallax {

}
