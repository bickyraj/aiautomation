import {AfterViewInit, Component} from '@angular/core';
import {ChipsScene} from '../chips-scene/chips-scene';
import gsap from 'gsap';

@Component({
  selector: 'app-hero',
  imports: [ChipsScene],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
  standalone: true
})
export class Hero implements AfterViewInit {

  ngAfterViewInit(): void {
    const tl = gsap.timeline();

    tl.from('.hero-text h1', {
      y: 100,
      opacity: 0,
      duration: 1.2,
      ease: 'power4.out'
    })
      .from('.hero-text p', {
        y: 40,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out'
      }, '-=0.6');
  }

}
