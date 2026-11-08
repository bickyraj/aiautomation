import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-chip-showcase',
  imports: [],
  templateUrl: './chip-showcase.html',
  styleUrl: './chip-showcase.scss',
  standalone: true
})
export class ChipShowcase implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer')
  canvasContainer!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId = 0;

  private chip!: THREE.Group;
  private floatAnimation?: gsap.core.Tween;

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.loadChip();
    this.animate();
  }

  private initThreeJS(): void {
    const container = this.canvasContainer.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#FFF4D6');

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });

    this.renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-3, 5, 5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1);
    fillLight.position.set(4, 1, 3);
    this.scene.add(fillLight);
  }

  private loadChip(): void {
    const loader = new GLTFLoader();

    loader.load(
      '/assets/models/new-potato-chip.glb',
      (gltf) => {
        this.chip = gltf.scene;

        this.chip.position.set(0, 0, 0);
        this.scene.add(this.chip);

        // Gentle floating animation
        this.floatAnimation = gsap.to(this.chip.position, {
          y: '+=0.2',
          duration: 2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });

        gsap.timeline({
          scrollTrigger: {
            trigger: '.chip-showcase-section',
            start: 'top top',
            end: '+=1000',
            scrub: 1,
            pin: true,
            pinSpacing: true
          }
        })
          .to(this.chip.position, {
            x: 0.5,
            duration: 1
          })
          .to(this.chip.scale, {
            x: 1.25,
            y: 1.25,
            z: 1.25,
            duration: 1
          }, 0);

        console.log('Potato chip loaded successfully!');
      },
      undefined,
      (error) => {
        console.error('Error loading potato chip:', error);
      }
    );
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.chip) {
      this.chip.rotation.z += 0.003;
      this.chip.rotation.x += 0.002;
    }

    this.renderer.render(this.scene, this.camera);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);

    this.floatAnimation?.kill();

    this.renderer?.dispose();
  }
}
