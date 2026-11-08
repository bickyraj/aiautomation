import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-ingredients',
  imports: [],
  templateUrl: './ingredients.html',
  styleUrl: './ingredients.scss',
  standalone: true
})
export class Ingredients implements AfterViewInit, OnDestroy {

  @ViewChild('ingredientsSection')
  ingredientsSection!: ElementRef<HTMLElement>;

  private animationContext?: gsap.Context;

  ngAfterViewInit(): void {
    this.animationContext = gsap.context(() => {

      gsap.from('.ingredient-card', {
        y: 80,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.ingredient-grid',
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        }
      });

    }, this.ingredientsSection.nativeElement);
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
  }
}
