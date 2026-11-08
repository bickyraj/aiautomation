import {Component, ElementRef, ViewChild} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-chips-scene',
  imports: [],
  templateUrl: './chips-scene.html',
  styleUrl: './chips-scene.scss',
  standalone: true
})
export class ChipsScene {
  @ViewChild('canvasContainer')
  canvasContainer!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private bag!: THREE.Group;
  private bagFloatGroup!: THREE.Group;
  private potato!: THREE.Group;
  private potatoInteractionGroup!: THREE.Group;

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.animate();
  }

  private loadPotato(): void {
    const loader = new GLTFLoader();

    loader.load(
      '/assets/models/raw-potato.glb',
      (gltf) => {
        this.potato = gltf.scene;

// Create a parent group for mouse interaction
        this.potatoInteractionGroup = new THREE.Group();
        this.potatoInteractionGroup.add(this.potato);

// Add the group to the scene
        this.scene.add(this.potatoInteractionGroup);

// Position the group
        this.potatoInteractionGroup.position.set(-1.5, -1, 0);

// Keep the potato centered inside the group
        this.potato.position.set(0, 0, 0);

// Set potato size
        this.potato.scale.set(20, 20, 20);
        this.setupPotatoMouseInteraction();

        gsap.to(this.potato.position, {
          y: '+=0.12',
          duration: 2.5,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });

        gsap.to(this.potato.rotation, {
          z: 0.2,
          duration: 3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });

        console.log('Raw potato loaded!');
      },
      undefined,
      (error) => console.error('Error loading potato:', error)
    );
  }

  private setupPotatoMouseInteraction(): void {
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = this.renderer.domElement.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Get potato's screen position
      const potatoPosition = new THREE.Vector3();
      this.potatoInteractionGroup.getWorldPosition(potatoPosition);

      const potatoScreenPosition = potatoPosition.clone().project(this.camera);

      // Calculate mouse distance
      const dx = mouse.x - potatoScreenPosition.x;
      const dy = mouse.y - potatoScreenPosition.y;

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 0.9) {
        const strength = Math.pow((0.9 - distance) / 0.9, 1.5);

        // Push potato away from cursor
        gsap.to(this.potatoInteractionGroup.position, {
          x: -1.5 - (dx * strength * 4),
          y: -1 - (dy * strength * 4),
          duration: 0.5,
          ease: 'power3.out',
          overwrite: 'auto'
        });

      } else {
        // Smoothly return to original position
        gsap.to(this.potatoInteractionGroup.position, {
          x: -1.5,
          y: -1,
          duration: 1,
          ease: 'elastic.out(1, 0.5)',
          overwrite: 'auto'
        });
      }
    };

    this.renderer.domElement.addEventListener('mousemove', onMouseMove);
  }

  private initThreeJS(): void {

    // 1. Create the scene
    this.scene = new THREE.Scene();

    this.scene.background = new THREE.Color('#F5D21A');

    // 2. Create the camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.camera.position.set(0, 0, 7);

    // 3. Create the renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    this.canvasContainer.nativeElement.appendChild(
      this.renderer.domElement
    );

    // 4. Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

// Main studio light
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-3, 5, 5);
    this.scene.add(keyLight);

// Soft fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 1);
    fillLight.position.set(4, 1, 3);
    this.scene.add(fillLight);

// Rim light from behind
    const rimLight = new THREE.DirectionalLight(0xffffff, 2);
    rimLight.position.set(0, 4, -4);
    this.scene.add(rimLight);

    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      3
    );

    directionalLight.position.set(3, 5, 5);

    this.scene.add(directionalLight);
    this.loadChipsBag();
    this.loadPotato();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    this.renderer.render(this.scene, this.camera);
  }

  private loadChipsBag(): void {
    const loader = new GLTFLoader();

    loader.load(
      '/assets/models/chips-bag-new3.glb',
      (gltf) => {
        this.bag = gltf.scene;

        this.bagFloatGroup = new THREE.Group();
        this.bagFloatGroup.add(this.bag);

        // Add the parent group to the scene
        this.scene.add(this.bagFloatGroup);
        this.bagFloatGroup.position.set(1, 0, 0);

        // Bag entrance animation
        gsap.from(this.bagFloatGroup.scale, {
          x: 0.7,
          y: 0.7,
          z: 0.7,
          duration: 1.4,
          ease: 'back.out(1.4)'
        });

        // Floating animation on the parent group
        gsap.to(this.bagFloatGroup.position, {
          y: '+=0.2',
          duration: 2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });

        // Gentle rotation on the parent group
        gsap.to(this.bagFloatGroup.rotation, {
          z: 0.04,
          duration: 2.5,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        });

        // Scroll-controlled animation
        gsap.timeline({
          scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',
            end: '+=1200',
            scrub: 1,
            pin: true,
            pinSpacing: true
          }
        })
          .to(this.bag.position, {
            x: 1.2,
            duration: 1
          })
          .to(this.bag.rotation, {
            z: -0.2,
            duration: 1
          }, 0)
          .to(this.bag.scale, {
            x: 0.8,
            y: 0.8,
            z: 0.8,
            duration: 1
          }, 0);

        console.log('Chips bag loaded!');
      },
      undefined,
      (error) => {
        console.error('Error loading chips bag:', error);
      }
    );
  }

  ngOnDestroy(): void {
    this.renderer?.dispose();
  }
}
