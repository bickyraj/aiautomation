
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-smoothie-showcase',
  standalone: true,
  imports: [],
  templateUrl: './smoothie-showcase.html',
  styleUrl: './smoothie-showcase.scss'
})
export class SmoothieShowcase implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer')
  canvasContainer!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private animationId = 0;

  private glass?: THREE.Group;

  private waterFrames: THREE.Object3D[] = [];
  private currentWaterFrame = 0;

  private scrollAnimation?: gsap.core.Tween;
  private textAnimations: gsap.core.Tween[] = [];

  private smoothieGroup = new THREE.Group();
  private waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeafaff,
    metalness: 0,
    roughness: 0.035,
    transmission: 0.98,
    thickness: 1.2,
    ior: 1.333,
    transparent: false,
    side: THREE.DoubleSide
  });

  ngAfterViewInit(): void {
    this.initScene();
    this.loadGlass();
    this.loadWater();
    this.animate();
    this.setupTextAnimation();
  }

  // -----------------------------
  // INITIALIZE THREE.JS
  // -----------------------------

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#fff4d6');
    this.scene.add(this.smoothieGroup);

    const width = this.canvasContainer.nativeElement.clientWidth;
    const height = this.canvasContainer.nativeElement.clientHeight;

    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100
    );

    this.camera.position.set(0, 0, 7);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.canvasContainer.nativeElement.appendChild(
      this.renderer.domElement
    );

    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(-3, 5, 5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(4, 1, 3);
    this.scene.add(fillLight);
  }

  // -----------------------------
  // LOAD GLASS
  // -----------------------------

  private loadGlass(): void {
    const loader = new GLTFLoader();

    loader.load(
      '/assets/models/water-glass.glb',
      (gltf) => {
        this.glass = new THREE.Group();

// Put the glass model inside the group
        this.glass.add(gltf.scene);

// Add the group to the scene
        this.smoothieGroup.add(this.glass);
        this.glass.rotation.set(0, 0, 0);

        console.log('Glass loaded:', this.glass);
      },
      undefined,
      (error) => {
        console.error('Glass loading failed:', error);
      }
    );
  }

  // -----------------------------
  // LOAD WATER FRAMES
  // -----------------------------

  private async loadWater(): Promise<void> {
    const loader = new GLTFLoader();

    try {
      for (let i = 1; i <= 100; i++) {

        const filename =
          `water_${String(i).padStart(4, '0')}.glb`;

        const gltf = await loader.loadAsync(
          `/assets/models/water-sequence/${filename}`
        );

        const frame = gltf.scene;
        frame.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = this.waterMaterial;
          }
        });

        frame.visible = i === 1;

        this.waterFrames.push(frame);
        this.smoothieGroup.add(frame);
      }

      console.log('All water frames loaded!');

      this.setupScrollAnimation();
      ScrollTrigger.refresh();

    } catch (error) {
      console.error('Water sequence loading failed:', error);
    }
  }

  // -----------------------------
  // SCROLL-CONTROLLED ANIMATION
  // -----------------------------

  private setupScrollAnimation(): void {

    this.scrollAnimation = gsap.to({}, {
      scrollTrigger: {
        trigger: '.smoothie-section',
        start: 'top top',
        end: '+=2000',
        scrub: 1,
        pin: true,
        invalidateOnRefresh: true,

        onUpdate: (self) => {

          const progress = self.progress;
          // this.smoothieGroup.rotation.z =
          //   THREE.MathUtils.degToRad(60) * progress;

          this.smoothieGroup.rotation.y =
            THREE.MathUtils.degToRad(20) * progress;

          const frameIndex = Math.min(
            Math.floor(
              progress * (this.waterFrames.length - 1)
            ),
            this.waterFrames.length - 1
          );

          if (frameIndex !== this.currentWaterFrame) {

            this.waterFrames[this.currentWaterFrame].visible = false;
            this.waterFrames[frameIndex].visible = true;

            this.currentWaterFrame = frameIndex;
          }

          if (this.glass) {
            const tiltProgress = THREE.MathUtils.clamp(
              progress / 0.35,
              0,
              1
            );
            this.glass.rotation.z =
              -THREE.MathUtils.degToRad(-105) * tiltProgress;
          }
        }
      }
    });
  }

  // -----------------------------
  // TEXT ANIMATIONS
  // -----------------------------

  private setupTextAnimation(): void {

    this.textAnimations.push(
      gsap.from('.smoothie-text .eyebrow', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.smoothie-section',
          start: 'top 75%',
          once: true
        }
      })
    );

    this.textAnimations.push(
      gsap.from('.smoothie-text h2', {
        opacity: 0,
        y: 60,
        duration: 1,
        delay: 0.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.smoothie-section',
          start: 'top 75%',
          once: true
        }
      })
    );

    this.textAnimations.push(
      gsap.from('.smoothie-text > p:last-child', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        delay: 0.4,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.smoothie-section',
          start: 'top 75%',
          once: true
        }
      })
    );
  }

  // -----------------------------
  // RENDER LOOP
  // -----------------------------

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    this.renderer.render(this.scene, this.camera);
  };

  // -----------------------------
  // CLEANUP
  // -----------------------------

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);

    this.scrollAnimation?.scrollTrigger?.kill();
    this.scrollAnimation?.kill();

    this.textAnimations.forEach(animation => {
      animation.scrollTrigger?.kill();
      animation.kill();
    });

    this.waterFrames.forEach(frame => {
      frame.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    });

    this.renderer?.dispose();
  }
}
