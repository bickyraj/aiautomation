
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ParticleEngine } from '../../services/particle-engine';
import { ParticleModel } from '../../models/particle-model.model';
import { GlowDecorator } from '../../services/glow-decorator';
import { CarRenderer } from '../../services/car-renderer';

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

  // ==========================================
  // PARTICLE ENGINE
  // ==========================================

  constructor(private particleEngine: ParticleEngine) {}

  private universeId = '';
  private wolfId = '';

  // ==========================================
  // GLOW DECORATOR
  // ==========================================

  private readonly glowDecorator = new GlowDecorator();

  private universeGlowId?: string;
  private wolfGlowId?: string;

  private readonly universeGlowOpacity = 0.4;
  private readonly wolfGlowOpacity = 0.5;

  // ==========================================
  // CAR RENDERER
  // ==========================================

  private readonly carRenderer = new CarRenderer();

  private carProgress = 0;

  // ==========================================
  // PARTICLE DATA
  // ==========================================

  private originalPositions?: Float32Array;
  private animatedPositions?: Float32Array;

  private wolfFrames: Float32Array[] = [];
  private matchedWolfFrames: Float32Array[] = [];

  private interpolatedWolfFrame?: Float32Array;

  // ==========================================
  // MORPH SETTINGS
  // ==========================================

  private morphProgress = 0;

  private readonly universeScale = 1.5;
  private readonly wolfScale = 5;

  private morphTween?: gsap.core.Timeline;

  // ==========================================
  // WOLF ANIMATION SETTINGS
  // ==========================================

  private wolfFrameProgress = 0;

  private readonly wolfFramesPerSecond = 12;

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

  // ==========================================
  // JSON URLS
  // ==========================================

  private readonly sphereUrl =
    '/assets/particles/particles.json';

  private readonly wolfUrl =
    '/assets/particles/wolf_particles.json';

  private readonly carUrl =
    '/assets/particles/car_wireframe.json';

  // ==========================================
  // INITIALIZE
  // ==========================================

  async ngAfterViewInit(): Promise<void> {

    gsap.registerPlugin(ScrollTrigger);

    this.particleEngine.initialize(
      this.canvasContainer.nativeElement
    );

    window.addEventListener('resize', this.onResize);

    const sphereLoaded = await this.loadSphereParticles();

    if (!sphereLoaded) return;

    const wolfLoaded = await this.loadWolfParticles();

    if (!wolfLoaded) return;

    const carLoaded = await this.loadCar();

    if (!carLoaded) return;

    this.setupScrollAnimation();

    this.animate();
  }

  // ==========================================
  // LOAD CAR
  // ==========================================


  private async loadCar(): Promise<boolean> {
    try {
      const data = await this.carRenderer.load(
        '/assets/particles/car_wireframe.json'
      );

      this.carRenderer.create(
        this.particleEngine.getScene(),
        data
      );

      this.carRenderer.setOpacity(0);

      return true;
    } catch (error) {
      console.error('Failed to load car:', error);
      return false;
    }
  }


  // ==========================================
  // LOAD SPHERE PARTICLES
  // ==========================================

  private async loadSphereParticles(): Promise<boolean> {

    try {

      const response = await fetch(this.sphereUrl);

      if (!response.ok) {
        throw new Error(`Sphere file returned ${response.status}`);
      }

      const positions: number[] = await response.json();

      if (
        !Array.isArray(positions) ||
        positions.length === 0 ||
        positions.length % 3 !== 0 ||
        !positions.every(Number.isFinite)
      ) {
        throw new Error('Invalid sphere particle positions.');
      }

      this.originalPositions = new Float32Array(positions);
      this.animatedPositions = new Float32Array(positions);

      const universeModel = new ParticleModel({
        positions: this.animatedPositions,
        color: 0xffffff,
        particleSize: 0.06,
        opacity: 0.8
      });

      this.universeId = this.particleEngine.createParticles(
        universeModel
      );

      this.universeGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.universeId),
        {
          color: 0xffc400,
          size: 0.5,
          opacity: this.universeGlowOpacity
        }
      );

      console.log(
        'Sphere loaded:',
        positions.length / 3,
        'particles'
      );

      return true;

    } catch (error) {

      console.error('Could not load sphere particles:', error);

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
        !Number.isInteger(data.particleCount) ||
        data.particleCount <= 0 ||
        !Array.isArray(data.frames) ||
        data.frames.length === 0
      ) {
        throw new Error('Invalid wolf animation data.');
      }

      const validFrames = data.frames.every(frame =>
        Array.isArray(frame.positions) &&
        frame.positions.length === data.particleCount * 3 &&
        frame.positions.every(Number.isFinite)
      );

      if (!validFrames) {
        throw new Error('One or more wolf frames are invalid.');
      }

      if (!this.originalPositions) {
        throw new Error('Sphere particles are not loaded.');
      }

      const sortedFrames = [...data.frames].sort(
        (a, b) => a.frame - b.frame
      );

      this.wolfFrames = sortedFrames.map(
        frame => new Float32Array(frame.positions)
      );

      const sphereCount = this.originalPositions.length / 3;

      this.matchedWolfFrames = this.wolfFrames.map(frame =>
        this.resamplePositions(frame, sphereCount)
      );

      this.interpolatedWolfFrame = new Float32Array(
        this.matchedWolfFrames[0].length
      );

      const wolfModel = new ParticleModel({
        positions: new Float32Array(this.originalPositions.length),
        color: 0x00A3FF,
        particleSize: 0.065,
        opacity: 1
      });

      this.wolfId = this.particleEngine.createParticles(
        wolfModel
      );

      this.wolfGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.wolfId),
        {
          color: 0x00A3FF,
          size: 0.25,
          opacity: 0.1
        }
      );

      this.particleEngine.setVisibility(this.wolfId, 0);

      console.log(
        'Wolf animation loaded:',
        this.matchedWolfFrames.length,
        'frames'
      );

      return true;

    } catch (error) {

      console.error('Could not load wolf particles:', error);

      return false;
    }
  }

  // ==========================================
  // MATCH PARTICLE COUNTS
  // ==========================================

  private resamplePositions(
    positions: Float32Array,
    targetCount: number
  ): Float32Array {

    const sourceCount = positions.length / 3;

    const result = new Float32Array(targetCount * 3);

    for (let i = 0; i < targetCount; i++) {

      const sourceIndex = Math.min(
        Math.floor((i / targetCount) * sourceCount),
        sourceCount - 1
      );

      const sourceOffset = sourceIndex * 3;
      const targetOffset = i * 3;

      result[targetOffset] = positions[sourceOffset];
      result[targetOffset + 1] = positions[sourceOffset + 1];
      result[targetOffset + 2] = positions[sourceOffset + 2];
    }

    return result;
  }

  // ==========================================
  // SCROLL-BASED ANIMATION
  // ==========================================

  private setupScrollAnimation(): void {

    const section = this.canvasContainer.nativeElement
      .closest('.particle-universe-section');

    if (!section) {
      console.error('Particle section not found.');
      return;
    }

    this.morphProgress = 0;
    this.carProgress = 0;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=600%',
        scrub: 1,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      // Universe settles before transforming.
      .to({}, {
        duration: 1
      })

      // Universe transforms into the running wolf.
      .to(this, {
        morphProgress: 1,
        duration: 10,
        ease: 'power1.inOut'
      })

      // Wolf remains visible briefly.
      .to({}, {
        duration: 2
      })

      // Wolf fades out and car fades in.
      .to(this, {
        carProgress: 1,
        duration: 6,
        ease: 'power1.inOut'
      });

    this.morphTween = timeline;

    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  }

  // ==========================================
  // RUNNING WOLF FRAME ANIMATION
  // ==========================================

  private updateWolfAnimation(delta: number): void {

    if (this.matchedWolfFrames.length < 2) return;

    this.wolfFrameProgress +=
      delta * this.wolfFramesPerSecond;

    this.wolfFrameProgress %=
      this.matchedWolfFrames.length;
  }

  // ==========================================
  // GET INTERPOLATED WOLF FRAME
  // ==========================================

  private getWolfFrame(): Float32Array | undefined {

    if (
      this.matchedWolfFrames.length === 0 ||
      !this.interpolatedWolfFrame
    ) {
      return undefined;
    }

    const count = this.matchedWolfFrames.length;

    const currentIndex = Math.floor(this.wolfFrameProgress);
    const nextIndex = (currentIndex + 1) % count;

    const blend = this.wolfFrameProgress - currentIndex;

    const frameA = this.matchedWolfFrames[currentIndex];
    const frameB = this.matchedWolfFrames[nextIndex];

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
  // MORPH SPHERE INTO WOLF
  // ==========================================

  private updateMorph(): void {

    if (
      !this.originalPositions ||
      !this.animatedPositions
    ) {
      return;
    }

    const wolfFrame = this.getWolfFrame();

    if (!wolfFrame) return;

    const progress = THREE.MathUtils.clamp(
      this.morphProgress,
      0,
      1
    );

    const carVisibility = THREE.MathUtils.smoothstep(
      this.carProgress,
      0,
      1
    );

    // Rotate universe around Z axis.
    const cos = Math.cos(this.universeRotation);
    const sin = Math.sin(this.universeRotation);

    for (let i = 0; i < this.animatedPositions.length; i += 3) {

      const x = this.originalPositions[i];
      const y = this.originalPositions[i + 1];
      const z = this.originalPositions[i + 2];

      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;

      const sphereX = rotatedX * this.universeScale;
      const sphereY = rotatedY * this.universeScale;
      const sphereZ = z * this.universeScale;

      const wolfX = wolfFrame[i] * this.wolfScale;
      const wolfY = wolfFrame[i + 1] * this.wolfScale;
      const wolfZ = wolfFrame[i + 2] * this.wolfScale;

      this.animatedPositions[i] = THREE.MathUtils.lerp(
        sphereX,
        wolfX,
        progress
      );

      this.animatedPositions[i + 1] = THREE.MathUtils.lerp(
        sphereY,
        wolfY,
        progress
      );

      this.animatedPositions[i + 2] = THREE.MathUtils.lerp(
        sphereZ,
        wolfZ,
        progress
      );
    }

    this.particleEngine.updateParticles(
      this.universeId,
      this.animatedPositions
    );

    this.particleEngine.updateParticles(
      this.wolfId,
      this.animatedPositions
    );

    // Original universe/wolf crossfade.
    const wolfMorphVisibility = THREE.MathUtils.smoothstep(
      progress,
      0.55,
      0.9
    );

    const universeVisibility = 1 - wolfMorphVisibility;

    // Fade the wolf out as the car appears.
    const wolfVisibility =
      wolfMorphVisibility * (1 - carVisibility);

    this.particleEngine.setVisibility(
      this.universeId,
      universeVisibility
    );

    this.particleEngine.setVisibility(
      this.wolfId,
      wolfVisibility
    );

    if (this.universeGlowId) {
      this.glowDecorator.setOpacity(
        this.universeGlowId,
        this.universeGlowOpacity * universeVisibility
      );
    }

    if (this.wolfGlowId) {
      this.glowDecorator.setOpacity(
        this.wolfGlowId,
        this.wolfGlowOpacity * wolfVisibility
      );
    }

    // Fade the car surface and wireframe in.
    this.carRenderer.setOpacity(carVisibility);
  }

  // ==========================================
  // MAIN ANIMATION LOOP
  // ==========================================

  private animate = (): void => {

    this.animationId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.morphProgress < 1) {
      this.universeRotation +=
        this.universeRotationSpeed * delta;
    }

    this.updateWolfAnimation(delta);

    this.updateMorph();

    this.particleEngine.render();
  };

  // ==========================================
  // RESIZE
  // ==========================================

  private onResize = (): void => {

    const container = this.canvasContainer.nativeElement;

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

    cancelAnimationFrame(this.animationId);

    window.removeEventListener('resize', this.onResize);

    this.morphTween?.scrollTrigger?.kill();
    this.morphTween?.kill();

    this.carRenderer.dispose();

    this.glowDecorator.dispose();

    this.particleEngine.dispose();
  }
}
