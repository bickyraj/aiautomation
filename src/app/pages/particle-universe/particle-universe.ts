
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ParticleEngine } from '../../services/particle-engine';
import { ParticleModel } from '../../models/particle-model.model';
import { GlowDecorator } from '../../services/glow-decorator';

// ==========================================
// WOLF DATA INTERFACES
// ==========================================

interface WolfFrame {
  frame: number;
  positions: number[];
}

interface WolfParticleData {
  particleCount: number;
  startFrame: number;
  endFrame: number;
  frames: WolfFrame[];
}

@Component({
  selector: 'app-particle-universe',
  standalone: true,
  imports: [],
  providers: [ParticleEngine],
  templateUrl: './particle-universe.html',
  styleUrl: './particle-universe.scss'
})
export class ParticleUniverse implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer')
  canvasContainer!: ElementRef<HTMLDivElement>;

  constructor(private particleEngine: ParticleEngine) {}

  // ==========================================
  // PARTICLE SYSTEM
  // ==========================================

  // ONE particle system for sphere, wolf and car.
  private universeId = '';

  private readonly PARTICLE_COUNT = 2000;

  // ==========================================
  // GLOW
  // ==========================================

  private readonly glowDecorator = new GlowDecorator();

  private universeGlowId?: string;

  private readonly universeGlowOpacity = 0.4;
  private readonly wolfGlowOpacity = 0.1;

  private readonly universeGlowColor = new THREE.Color(0xffc400);
  private readonly wolfGlowColor = new THREE.Color(0x00a3ff);

  private currentGlowColor = new THREE.Color(0xffc400);

  // ==========================================
  // PARTICLE POSITIONS
  // ==========================================

  // All arrays contain exactly 2000 XYZ positions.
  private originalPositions?: Float32Array;
  private animatedPositions?: Float32Array;

  private carParticlePositions?: Float32Array;

  // Capture the exact current positions when car morph begins.
  private wolfToCarStartPositions?: Float32Array;

  // ==========================================
  // WOLF ANIMATION
  // ==========================================

  // Every frame has exactly 2000 particles.
  private wolfFrames: Float32Array[] = [];

  // Reusable interpolated wolf frame.
  private interpolatedWolfFrame?: Float32Array;

  private wolfFrameProgress = 0;

  private readonly wolfFramesPerSecond = 12;

  // ==========================================
  // MORPH PROGRESS
  // ==========================================

  private morphProgress = 0;
  private carProgress = 0;

  private carMorphStarted = false;

  private morphTween?: gsap.core.Timeline;

  // ==========================================
  // OBJECT SCALE
  // ==========================================

  private readonly universeScale = 1.5;
  private readonly wolfScale = 5;
  private readonly carScale = 0.1;

  // ==========================================
  // ENERGY TRANSITION
  // ==========================================

  private energyDirections?: Float32Array;
  private energySwirl?: Float32Array;

  private readonly energyBurstDistance = 2.2;
  private readonly energySwirlStrength = 1.4;

  // ==========================================
  // UNIVERSE ROTATION
  // ==========================================

  private universeRotation = 0;

  private readonly universeRotationSpeed = 0.15;

  // ==========================================
  // ANIMATION LOOP
  // ==========================================

  private animationId = 0;

  private clock = new THREE.Clock();

  private destroyed = false;

  // ==========================================
  // JSON URLS
  // ==========================================

  private readonly sphereUrl =
    '/assets/particles/particles.json';

  private readonly wolfUrl =
    '/assets/particles/wolf_particles.json';

  private readonly carUrl =
    '/assets/particles/car_particles.json';

  // ==========================================
  // INITIALIZE
  // ==========================================

  async ngAfterViewInit(): Promise<void> {

    gsap.registerPlugin(ScrollTrigger);

    this.particleEngine.initialize(
      this.canvasContainer.nativeElement
    );

    window.addEventListener('resize', this.onResize);

    try {

      const sphereLoaded = await this.loadSphereParticles();

      if (!sphereLoaded || this.destroyed) return;

      const wolfLoaded = await this.loadWolfParticles();

      if (!wolfLoaded || this.destroyed) return;

      const carLoaded = await this.loadCarParticles();

      if (!carLoaded || this.destroyed) return;

      this.prepareEnergyMotion();

      this.setupScrollAnimation();

      this.animate();

    } catch (error) {

      console.error('Particle initialization failed:', error);
    }
  }

  // ==========================================
  // VALIDATE PARTICLE ARRAY
  // ==========================================

  private validateParticleArray(
    positions: number[],
    name: string
  ): Float32Array {

    if (
      !Array.isArray(positions) ||
      positions.length !== this.PARTICLE_COUNT * 3 ||
      !positions.every(Number.isFinite)
    ) {
      throw new Error(
        `${name} must contain exactly ${this.PARTICLE_COUNT} particles (6000 coordinates).`
      );
    }

    return new Float32Array(positions);
  }

  // ==========================================
  // LOAD SPHERE
  // ==========================================

  private async loadSphereParticles(): Promise<boolean> {

    try {

      const response = await fetch(this.sphereUrl);

      if (!response.ok) {
        throw new Error(`Sphere file returned ${response.status}`);
      }

      const positions: number[] = await response.json();
      console.log('SPHERE JSON DEBUG:', {
        isArray: Array.isArray(positions),
        length: positions?.length,
        particleCount: positions?.length / 3,
        firstValues: positions?.slice(0, 12)
      });

      this.originalPositions =
        this.validateParticleArray(positions, 'Sphere');

      this.animatedPositions =
        this.originalPositions.slice();

      const universeModel = new ParticleModel({
        positions: this.animatedPositions,
        color: 0xffffff,
        particleSize: 0.02,
        opacity: 0.9
      });

      this.universeId =
        this.particleEngine.createParticles(universeModel);

      this.universeGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.universeId),
        {
          color: 0xffc400,
          size: 0.2,
          opacity: this.universeGlowOpacity
        }
      );

      console.log(
        'Sphere loaded:',
        this.PARTICLE_COUNT,
        'particles'
      );

      return true;

    } catch (error) {

      console.error('Could not load sphere:', error);

      return false;
    }
  }

  // ==========================================
  // LOAD WOLF ANIMATION
  // ==========================================

  private async loadWolfParticles(): Promise<boolean> {

    try {

      const response = await fetch(this.wolfUrl);

      if (!response.ok) {
        throw new Error(`Wolf file returned ${response.status}`);
      }

      const data: WolfParticleData = await response.json();

      if (
        !data ||
        data.particleCount !== this.PARTICLE_COUNT ||
        !Array.isArray(data.frames) ||
        data.frames.length === 0
      ) {
        throw new Error(
          'Wolf must have exactly 2000 particles and valid animation frames.'
        );
      }

      const sortedFrames = [...data.frames].sort(
        (a, b) => a.frame - b.frame
      );

      // Validate and store all wolf frames.
      this.wolfFrames = sortedFrames.map((frame, index) => {

        if (
          !Array.isArray(frame.positions) ||
          frame.positions.length !== this.PARTICLE_COUNT * 3 ||
          !frame.positions.every(Number.isFinite)
        ) {
          throw new Error(`Invalid wolf frame at index ${index}.`);
        }

        return new Float32Array(frame.positions);
      });

      // Reusable frame buffer.
      this.interpolatedWolfFrame = new Float32Array(
        this.PARTICLE_COUNT * 3
      );

      console.log('Wolf animation loaded:', {
        particleCount: this.PARTICLE_COUNT,
        frameCount: this.wolfFrames.length
      });

      return true;

    } catch (error) {

      console.error('Could not load wolf:', error);

      return false;
    }
  }

  // ==========================================
  // LOAD CAR
  // ==========================================

  private async loadCarParticles(): Promise<boolean> {

    try {

      const response = await fetch(this.carUrl);

      if (!response.ok) {
        throw new Error(`Car file returned ${response.status}`);
      }

      const positions: number[] = await response.json();

      this.carParticlePositions =
        this.validateParticleArray(positions, 'Car');

      console.log(
        'Car loaded:',
        this.PARTICLE_COUNT,
        'particles'
      );

      return true;

    } catch (error) {

      console.error('Could not load car:', error);

      return false;
    }
  }

  // ==========================================
  // PREPARE ENERGY MOTION
  // ==========================================

  private prepareEnergyMotion(): void {

    this.energyDirections =
      new Float32Array(this.PARTICLE_COUNT * 3);

    this.energySwirl =
      new Float32Array(this.PARTICLE_COUNT);

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {

      const randomA =
        Math.sin(i * 127.1) * 43758.5453;

      const randomB =
        Math.sin(i * 269.5) * 24634.6345;

      const randomC =
        Math.sin(i * 183.3) * 56445.234;

      const a = randomA - Math.floor(randomA);
      const b = randomB - Math.floor(randomB);
      const c = randomC - Math.floor(randomC);

      const z = 2 * a - 1;
      const angle = 2 * Math.PI * b;
      const radius = Math.sqrt(1 - z * z);

      const offset = i * 3;

      this.energyDirections[offset] =
        radius * Math.cos(angle);

      this.energyDirections[offset + 1] =
        radius * Math.sin(angle);

      this.energyDirections[offset + 2] = z;

      this.energySwirl[i] = (c - 0.5) * 2;
    }
  }

  // ==========================================
  // SCROLL ANIMATION
  // ==========================================

  private setupScrollAnimation(): void {

    const section = this.canvasContainer.nativeElement
      .closest('.particle-universe-section');

    if (!section) {
      console.error('Particle section not found.');
      return;
    }

    const timeline = gsap.timeline({

      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=650%',
        scrub: 1,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline

      // 1. Show the universe.
      .to({}, {
        duration: 1
      })

      // 2. Universe → Wolf.
      .to(this, {
        morphProgress: 1,
        duration: 10,
        ease: 'power1.inOut'
      })

      // 3. Show the animated wolf.
      .to({}, {
        duration: 2
      })

      // 4. Wolf → Car.
      .to(this, {
        carProgress: 1,
        duration: 9,
        ease: 'power1.inOut'
      })

      // 5. Hold the car.
      .to({}, {
        duration: 0.5
      });

    this.morphTween = timeline;

    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  }

  // ==========================================
  // WOLF FRAME ANIMATION
  // ==========================================

  private updateWolfAnimation(delta: number): void {

    if (
      this.carProgress > 0 ||
      this.wolfFrames.length < 2
    ) {
      return;
    }

    // Animate only after the wolf starts appearing.
    if (this.morphProgress < 0.01) return;

    this.wolfFrameProgress +=
      delta * this.wolfFramesPerSecond;

    this.wolfFrameProgress %=
      this.wolfFrames.length;
  }

  // ==========================================
  // INTERPOLATE WOLF FRAMES
  // ==========================================

  private getWolfFrame(): Float32Array | undefined {

    if (
      this.wolfFrames.length === 0 ||
      !this.interpolatedWolfFrame
    ) {
      return undefined;
    }

    const count = this.wolfFrames.length;

    const currentIndex =
      Math.floor(this.wolfFrameProgress);

    const nextIndex =
      (currentIndex + 1) % count;

    const blend =
      this.wolfFrameProgress - currentIndex;

    const frameA =
      this.wolfFrames[currentIndex];

    const frameB =
      this.wolfFrames[nextIndex];

    this.interpolateFrames(
      frameA,
      frameB,
      blend,
      this.interpolatedWolfFrame
    );

    return this.interpolatedWolfFrame;
  }

  private interpolateFrames(
    frameA: Float32Array,
    frameB: Float32Array,
    blend: number,
    result: Float32Array
  ): void {

    for (let i = 0; i < result.length; i++) {

      result[i] = THREE.MathUtils.lerp(
        frameA[i],
        frameB[i],
        blend
      );
    }
  }

  // ==========================================
  // SMOOTH MORPH FUNCTION
  // ==========================================

  private smoothProgress(value: number): number {

    const t = THREE.MathUtils.clamp(value, 0, 1);

    return t * t * (3 - 2 * t);
  }

  // ==========================================
  // UPDATE GLOW
  // ==========================================

  private updateGlow(progress: number): void {

    if (!this.universeGlowId) return;

    this.currentGlowColor.copy(this.universeGlowColor);

    this.currentGlowColor.lerp(
      this.wolfGlowColor,
      progress
    );

    this.glowDecorator.setColor(
      this.universeGlowId,
      this.currentGlowColor.getHex()
    );

    const opacity = THREE.MathUtils.lerp(
      this.universeGlowOpacity,
      this.wolfGlowOpacity,
      progress
    );

    this.glowDecorator.setOpacity(
      this.universeGlowId,
      opacity
    );
  }

  // ==========================================
  // MORPH UNIVERSE → WOLF
  // ==========================================

  private updateUniverseToWolf(
    wolfFrame: Float32Array
  ): void {

    if (
      !this.originalPositions ||
      !this.animatedPositions
    ) {
      return;
    }

    const progress = this.smoothProgress(
      this.morphProgress
    );

    const cos = Math.cos(this.universeRotation);
    const sin = Math.sin(this.universeRotation);

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {

      const offset = i * 3;

      const x = this.originalPositions[offset];
      const y = this.originalPositions[offset + 1];
      const z = this.originalPositions[offset + 2];

      // Rotate the original universe sphere.
      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;

      const sphereX = rotatedX * this.universeScale;
      const sphereY = rotatedY * this.universeScale;
      const sphereZ = z * this.universeScale;

      // The SAME particle index maps to the wolf.
      const wolfX = wolfFrame[offset] * this.wolfScale;
      const wolfY = wolfFrame[offset + 1] * this.wolfScale;
      const wolfZ = wolfFrame[offset + 2] * this.wolfScale;

      this.animatedPositions[offset] =
        THREE.MathUtils.lerp(
          sphereX,
          wolfX,
          progress
        );

      this.animatedPositions[offset + 1] =
        THREE.MathUtils.lerp(
          sphereY,
          wolfY,
          progress
        );

      this.animatedPositions[offset + 2] =
        THREE.MathUtils.lerp(
          sphereZ,
          wolfZ,
          progress
        );
    }

    this.updateGlow(progress);
  }

  // ==========================================
  // CAPTURE CURRENT WOLF POSITION
  // ==========================================

  private captureWolfPositions(): void {

    if (!this.animatedPositions) return;

    // Copy the exact positions currently displayed.
    this.wolfToCarStartPositions =
      this.animatedPositions.slice();

    this.carMorphStarted = true;
  }

  // ==========================================
  // MORPH WOLF → CAR
  // ==========================================

  private updateWolfToCar(): void {

    if (
      !this.carParticlePositions ||
      !this.animatedPositions ||
      !this.energyDirections ||
      !this.energySwirl
    ) {
      return;
    }

    // Capture the wolf exactly once.
    if (!this.carMorphStarted) {
      this.captureWolfPositions();
    }

    if (!this.wolfToCarStartPositions) return;

    const progress = this.smoothProgress(
      this.carProgress
    );

    // Burst peaks halfway through the transition.
    const burstEnvelope = Math.sin(
      Math.PI * progress
    );

    const swirlWave =
      Math.sin(progress * Math.PI * 2) *
      burstEnvelope;

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {

      const offset = i * 3;

      const startX =
        this.wolfToCarStartPositions[offset];

      const startY =
        this.wolfToCarStartPositions[offset + 1];

      const startZ =
        this.wolfToCarStartPositions[offset + 2];

      const targetX =
        this.carParticlePositions[offset] * this.carScale;

      const targetY =
        this.carParticlePositions[offset + 1] * this.carScale;

      const targetZ =
        this.carParticlePositions[offset + 2] * this.carScale;

      // Base interpolation between wolf and car.
      const baseX = THREE.MathUtils.lerp(
        startX,
        targetX,
        progress
      );

      const baseY = THREE.MathUtils.lerp(
        startY,
        targetY,
        progress
      );

      const baseZ = THREE.MathUtils.lerp(
        startZ,
        targetZ,
        progress
      );

      const directionX =
        this.energyDirections[offset];

      const directionY =
        this.energyDirections[offset + 1];

      const directionZ =
        this.energyDirections[offset + 2];

      const swirl =
        this.energySwirl[i];

      // Radial particle burst.
      const burstX =
        directionX *
        this.energyBurstDistance *
        burstEnvelope;

      const burstY =
        directionY *
        this.energyBurstDistance *
        burstEnvelope;

      const burstZ =
        directionZ *
        this.energyBurstDistance *
        burstEnvelope;

      // Circular swirl.
      const swirlX =
        -directionY *
        this.energySwirlStrength *
        swirl *
        swirlWave;

      const swirlY =
        directionX *
        this.energySwirlStrength *
        swirl *
        swirlWave;

      this.animatedPositions[offset] =
        baseX + burstX + swirlX;

      this.animatedPositions[offset + 1] =
        baseY + burstY + swirlY;

      this.animatedPositions[offset + 2] =
        baseZ + burstZ;
    }

    // Gradually change the glow to the wolf/car color.
    this.updateGlow(1);
  }

  // ==========================================
  // MAIN MORPH UPDATE
  // ==========================================

  private updateMorph(): void {

    if (!this.animatedPositions) return;

    // Reset the car capture when scrolling back.
    if (this.carProgress <= 0) {

      this.carMorphStarted = false;
      this.wolfToCarStartPositions = undefined;
    }

    // Get the current animated wolf pose.
    const wolfFrame = this.getWolfFrame();

    if (!wolfFrame) return;

    if (this.carProgress > 0) {

      // Wolf → Car.
      this.updateWolfToCar();

    } else {

      // Universe → Wolf.
      this.updateUniverseToWolf(wolfFrame);
    }

    // Only ONE particle system is updated.
    this.particleEngine.updateParticles(
      this.universeId,
      this.animatedPositions
    );
  }

  // ==========================================
  // MAIN ANIMATION LOOP
  // ==========================================

  private animate = (): void => {

    if (this.destroyed) return;

    this.animationId =
      requestAnimationFrame(this.animate);

    const delta = Math.min(
      this.clock.getDelta(),
      0.05
    );

    // Rotate the universe before it becomes the wolf.
    if (this.morphProgress < 1) {

      this.universeRotation +=
        this.universeRotationSpeed * delta;
    }

    // Animate wolf frames.
    this.updateWolfAnimation(delta);

    // Update the single shared particle system.
    this.updateMorph();

    this.particleEngine.render();
  };

  // ==========================================
  // RESIZE
  // ==========================================

  private onResize = (): void => {

    if (this.destroyed) return;

    const container =
      this.canvasContainer.nativeElement;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) return;

    this.particleEngine.resize(width, height);

    ScrollTrigger.refresh();
  };

  // ==========================================
  // CLEANUP
  // ==========================================

  ngOnDestroy(): void {

    this.destroyed = true;

    cancelAnimationFrame(this.animationId);

    window.removeEventListener(
      'resize',
      this.onResize
    );

    this.morphTween?.scrollTrigger?.kill();
    this.morphTween?.kill();

    this.glowDecorator.dispose();

    this.particleEngine.dispose();
  }
}
