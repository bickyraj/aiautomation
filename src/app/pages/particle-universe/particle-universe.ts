
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild
} from '@angular/core';

import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ParticleEngine } from '../../services/particle-engine';
import { ParticleModel } from '../../models/particle-model.model';
import { GlowDecorator } from '../../services/glow-decorator';
import { CarRenderer } from '../../services/car-renderer';
import { ParticleColorGenerator } from '../../services/particle-color-generator';

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

  private particleColorGenerator: ParticleColorGenerator =
    inject(ParticleColorGenerator);

  // ==========================================
  // SPHERE → WOLF SPIRAL FLOW SETTINGS
  // ==========================================

  private readonly spiralRotations = 0.2;

  // Controls how much the outer particles
  // rotate differently from the inner particles.
  private readonly spiralTwist = 0.1;

  // Subtle 3D movement, not an explosion.
  private readonly spiralDepth = 0.01;

  // Point where the wolf begins to take shape.
  private readonly wolfConvergenceStart = 0.38;

  // ==========================================
  // PARTICLE SYSTEM IDS
  // ==========================================

  private universeId = '';
  private wolfId = '';

  // ==========================================
  // GLOW DECORATOR
  // ==========================================

  private readonly glowDecorator = new GlowDecorator();

  private universeGlowId?: string;
  private wolfGlowId?: string;

  private readonly universeGlowOpacity = 0.5;
  private readonly wolfGlowOpacity = 0.1;

  // ==========================================
  // CAR RENDERER
  // ==========================================

  private readonly carRenderer = new CarRenderer();

  // ==========================================
  // CAR TRANSITION
  // ==========================================

  private carProgress = 0;
  private wireframeProgress = 0;
  private particleFadeProgress = 0;

  private carParticlePositions?: Float32Array;

  private wolfToCarStartPositions?: Float32Array;
  private wolfToCarPositions?: Float32Array;

  private carMorphStarted = false;

  // ==========================================
  // ENERGY TRANSITION
  // ==========================================

  private energyDirections?: Float32Array;
  private energySwirl?: Float32Array;

  private readonly energyBurstDistance = 2.2;
  private readonly energySwirlStrength = 1.4;

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

  private sectionTweens: gsap.core.Tween[] = [];

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
    '/assets/particles/car_wireframe-new.json';

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

      const data = await this.carRenderer.load(this.carUrl);

      this.carRenderer.create(
        this.particleEngine.getScene(),
        data
      );

      const particleCount =
        this.originalPositions!.length / 3;

      this.carParticlePositions =
        this.carRenderer.sampleEdgePositions(
          data,
          particleCount
        );

      this.wolfToCarPositions =
        new Float32Array(this.carParticlePositions.length);

      this.carRenderer.setOpacity(0);
      this.carRenderer.setWireframeProgress(0);

      console.log(
        'Car loaded:',
        data.vertexCount,
        'vertices,',
        data.edgeCount,
        'edges,',
        particleCount,
        'edge particle destinations'
      );

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
        throw new Error(
          `Sphere file returned ${response.status}`
        );
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

      const colors =
        this.particleColorGenerator.generateGalaxyColors(
          this.originalPositions
        );

      const universeModel = new ParticleModel({
        positions: this.animatedPositions,
        color: 0xffffff,
        particleSize: 0.03,
        opacity: 0.9,
        colors
      });

      this.universeId =
        this.particleEngine.createParticles(universeModel);

      this.universeGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.universeId),
        {
          color: 0x7655ff,
          size: 0.3,
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
        throw new Error(
          `Wolf file returned ${response.status}`
        );
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

      const sphereCount =
        this.originalPositions.length / 3;

      this.matchedWolfFrames = this.wolfFrames.map(frame =>
        this.resamplePositions(frame, sphereCount)
      );

      this.interpolatedWolfFrame = new Float32Array(
        this.matchedWolfFrames[0].length
      );

      this.prepareEnergyMotion();

      const wolfColors =
        this.particleColorGenerator.generateWolfColors(
          this.matchedWolfFrames[0]
        );

      const wolfModel = new ParticleModel({
        positions: new Float32Array(this.originalPositions.length),
        color: 0x852cff,
        particleSize: 0.05,
        opacity: 1,
        colors: wolfColors
      });

      this.wolfId =
        this.particleEngine.createParticles(wolfModel);

      this.wolfGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.wolfId),
        {
          color: 0x168bff,
          size: 0.6,
          opacity: 0.9
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
  // PREPARE ENERGY PARTICLE MOTION
  // ==========================================

  private prepareEnergyMotion(): void {

    if (!this.originalPositions) return;

    const particleCount =
      this.originalPositions.length / 3;

    this.energyDirections =
      new Float32Array(particleCount * 3);

    this.energySwirl =
      new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {

      const randomA = Math.sin(i * 127.1) * 43758.5453;
      const randomB = Math.sin(i * 269.5) * 24634.6345;
      const randomC = Math.sin(i * 183.3) * 56445.234;

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

    const experience =
      this.canvasContainer.nativeElement.closest(
        '.particle-experience'
      );

    const universeSection =
      experience?.querySelector('.section-universe');

    const wolfSection =
      experience?.querySelector('.section-wolf');

    const carSection =
      experience?.querySelector('.section-car');

    if (
      !experience ||
      !universeSection ||
      !wolfSection ||
      !carSection
    ) {
      console.error(
        'One or more sections could not be found.'
      );
      return;
    }

    this.morphProgress = 0;
    this.carProgress = 0;
    this.wireframeProgress = 0;
    this.particleFadeProgress = 0;
    this.carMorphStarted = false;

    gsap.set(universeSection, {
      yPercent: 0,
      scale: 1,
      opacity: 1
    });

    gsap.set(wolfSection, {
      yPercent: 0,
      scale: 1,
      opacity: 1
    });

    gsap.set(carSection, {
      yPercent: 0,
      scale: 1,
      opacity: 1
    });

    // =====================================
    // 1. UNIVERSE → WOLF SECTION
    // =====================================

    const universeTransition = gsap.to(
      universeSection,
      {
        yPercent: -18,
        scale: 1,
        opacity: 0.01,
        ease: 'none',
        scrollTrigger: {
          trigger: wolfSection,
          start: 'top bottom',
          end: 'top top',
          scrub: 2,
          invalidateOnRefresh: true
        }
      }
    );

    this.sectionTweens.push(universeTransition);

    // =====================================
    // 2. WOLF → CAR SECTION
    // =====================================

    const wolfTransition = gsap.to(
      wolfSection,
      {
        yPercent: -18,
        scale: 1,
        opacity: 0.01,
        ease: 'none',

        scrollTrigger: {
          trigger: carSection,
          start: 'top bottom',
          end: 'top top',
          scrub: 2,
          invalidateOnRefresh: true
        }
      }
    );

    this.sectionTweens.push(wolfTransition);

    // =====================================
    // 3. MASTER MORPH TIMELINE
    // =====================================

    const timeline = gsap.timeline({

      scrollTrigger: {
        trigger: experience,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 5,
        invalidateOnRefresh: true
      }

    });

    timeline

      // Hold sphere
      .to({}, {
        duration: 0.05
      })

      // Sphere → Wolf
      .to(this, {
        morphProgress: 1,
        duration: 10,
        ease: 'none'
      })

      // Hold wolf
      .to({}, {
        duration: 1.5
      })

      // Wolf → Car
      .to(this, {
        carProgress: 1,
        wireframeProgress: 1,
        duration: 6,
        ease: 'none'
      })

      // Hold car
      .to({}, {
        duration: 1.5
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

    const currentIndex =
      Math.floor(this.wolfFrameProgress);

    const nextIndex =
      (currentIndex + 1) % count;

    const blend =
      this.wolfFrameProgress - currentIndex;

    const frameA =
      this.matchedWolfFrames[currentIndex];

    const frameB =
      this.matchedWolfFrames[nextIndex];

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
  // SPHERE → WOLF
  // CONTINUOUS SPIRAL FLOW
  // ==========================================

  private updateSphereToWolf(
    progress: number,
    wolfFrame: Float32Array
  ): void {

    if (
      !this.originalPositions ||
      !this.animatedPositions
    ) {
      return;
    }

    const t = THREE.MathUtils.clamp(progress, 0, 1);

    // ======================================
    // FLOW PROGRESS
    // ======================================

    // Spiral rotation develops gradually.
    const spiralProgress =
      t * t * (3 - 2 * t);

    const totalRotation =
      spiralProgress *
      Math.PI * 2 *
      this.spiralRotations;

    // Wolf formation starts later.
    const convergence = THREE.MathUtils.smoothstep(
      t,
      this.wolfConvergenceStart,
      1
    );

    // Smooth 3D wave envelope.
    // Zero at the beginning and destination.
    const depthEnvelope =
      Math.sin(Math.PI * t);

    const count = this.animatedPositions.length;

    // ======================================
    // PROCESS EVERY PARTICLE
    // ======================================

    for (let i = 0; i < count; i += 3) {

      const x =
        this.originalPositions[i] * this.universeScale;

      const y =
        this.originalPositions[i + 1] * this.universeScale;

      const z =
        this.originalPositions[i + 2] * this.universeScale;

      // ----------------------------------
      // PARTICLE POLAR COORDINATES
      // ----------------------------------

      const originalAngle =
        Math.atan2(y, x);

      const originalRadius =
        Math.sqrt(x * x + y * y);

      // Normalize radius for a coherent
      // spiral twist across the sphere.
      const normalizedRadius =
        THREE.MathUtils.clamp(
          originalRadius / this.universeScale,
          0,
          1.5
        );

      // ----------------------------------
      // SHARED SPIRAL FLOW
      // ----------------------------------

      // Every particle follows the same
      // rotational flow field.

      // Outer particles rotate slightly
      // differently from inner particles.
      const radialTwist =
        normalizedRadius *
        totalRotation *
        this.spiralTwist;

      const particleAngle =
        originalAngle +
        this.universeRotation +
        totalRotation +
        radialTwist;

      const cos = Math.cos(particleAngle);
      const sin = Math.sin(particleAngle);

      // ----------------------------------
      // FLOWING POSITION
      // ----------------------------------

      const flowX =
        originalRadius * cos;

      const flowY =
        originalRadius * sin;

      // A subtle wave travels through the
      // depth of the particle cloud.
      // This avoids a flat 2D rotation.
      const wavePhase =
        originalAngle +
        totalRotation * 1.5 +
        normalizedRadius * 2.0;

      const flowZ =
        z +
        Math.sin(wavePhase) *
        this.spiralDepth *
        depthEnvelope;

      // ----------------------------------
      // WOLF DESTINATION
      // ----------------------------------

      const wolfX =
        wolfFrame[i] * this.wolfScale;

      const wolfY =
        wolfFrame[i + 1] * this.wolfScale;

      const wolfZ =
        wolfFrame[i + 2] * this.wolfScale;

      // ----------------------------------
      // GRADUAL CONVERGENCE
      // ----------------------------------

      // The sphere first flows and twists.
      // Then the particles progressively
      // settle into their wolf positions.

      this.animatedPositions[i] =
        THREE.MathUtils.lerp(
          flowX,
          wolfX,
          convergence
        );

      this.animatedPositions[i + 1] =
        THREE.MathUtils.lerp(
          flowY,
          wolfY,
          convergence
        );

      this.animatedPositions[i + 2] =
        THREE.MathUtils.lerp(
          flowZ,
          wolfZ,
          convergence
        );
    }

    this.particleEngine.updateParticles(
      this.universeId,
      this.animatedPositions
    );
  }

  // ==========================================
  // MORPH SPHERE → WOLF → CAR
  // ==========================================

  private updateMorph(): void {

    if (
      !this.originalPositions ||
      !this.animatedPositions ||
      !this.carParticlePositions ||
      !this.wolfToCarPositions ||
      !this.energyDirections ||
      !this.energySwirl
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

    const carProgress = THREE.MathUtils.clamp(
      this.carProgress,
      0,
      1
    );

    const smoothCarProgress =
      (1 - Math.cos(Math.PI * carProgress)) / 2;

    const wireframeProgress = THREE.MathUtils.clamp(
      this.wireframeProgress,
      0,
      1
    );

    const particleFadeProgress = THREE.MathUtils.clamp(
      this.particleFadeProgress,
      0,
      1
    );

    // ======================================
    // 1. UNIVERSE → WOLF
    // ======================================

    const smoothMorphProgress =
      (1 - Math.cos(Math.PI * progress)) / 2;

    // IMPORTANT:
    // This is the ONLY place where the
    // sphere-to-wolf positions are updated.
    //
    // Do not add the old linear interpolation
    // loop after this call. It would overwrite
    // the spiral positions.

    this.updateSphereToWolf(
      smoothMorphProgress,
      wolfFrame
    );

    // ======================================
    // 2. CAPTURE INITIAL WOLF POSE
    // ======================================

    if (carProgress > 0 && !this.carMorphStarted) {

      this.wolfToCarStartPositions =
        this.animatedPositions.slice();

      this.carMorphStarted = true;
    }

    // ======================================
    // 3. WOLF PARTICLES → CAR EDGES
    // ======================================

    if (
      carProgress > 0 &&
      this.carMorphStarted &&
      this.wolfToCarStartPositions
    ) {

      const burstEnvelope = Math.sin(
        Math.PI * carProgress
      );

      const swirlWave =
        Math.sin(carProgress * Math.PI * 2) *
        burstEnvelope;

      const animationWeight =
        1 - smoothCarProgress;

      for (
        let i = 0;
        i < this.wolfToCarPositions.length;
        i += 3
      ) {

        const particleIndex = i / 3;

        const startX =
          this.wolfToCarStartPositions[i];

        const startY =
          this.wolfToCarStartPositions[i + 1];

        const startZ =
          this.wolfToCarStartPositions[i + 2];

        const animationOffsetX =
          this.animatedPositions[i] - startX;

        const animationOffsetY =
          this.animatedPositions[i + 1] - startY;

        const animationOffsetZ =
          this.animatedPositions[i + 2] - startZ;

        const targetX =
          this.carParticlePositions[i];

        const targetY =
          this.carParticlePositions[i + 1];

        const targetZ =
          this.carParticlePositions[i + 2];

        const baseX = THREE.MathUtils.lerp(
          startX,
          targetX,
          smoothCarProgress
        );

        const baseY = THREE.MathUtils.lerp(
          startY,
          targetY,
          smoothCarProgress
        );

        const baseZ = THREE.MathUtils.lerp(
          startZ,
          targetZ,
          smoothCarProgress
        );

        const directionX =
          this.energyDirections[i];

        const directionY =
          this.energyDirections[i + 1];

        const directionZ =
          this.energyDirections[i + 2];

        const swirl =
          this.energySwirl[particleIndex];

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

        this.wolfToCarPositions[i] =
          baseX +
          animationOffsetX * animationWeight +
          burstX +
          swirlX;

        this.wolfToCarPositions[i + 1] =
          baseY +
          animationOffsetY * animationWeight +
          burstY +
          swirlY;

        this.wolfToCarPositions[i + 2] =
          baseZ +
          animationOffsetZ * animationWeight +
          burstZ;
      }

      this.particleEngine.updateParticles(
        this.wolfId,
        this.wolfToCarPositions
      );

    } else {

      this.particleEngine.updateParticles(
        this.wolfId,
        this.animatedPositions
      );

    }

    // ======================================
    // 4. RESET WHEN SCROLLING BACK
    // ======================================

    if (carProgress === 0) {

      this.carMorphStarted = false;
      this.wolfToCarStartPositions = undefined;

    }

    // ======================================
    // 5. VISIBILITY CROSSFADE
    // ======================================

    const wolfMorphVisibility =
      THREE.MathUtils.smoothstep(
        progress,
        0.55,
        0.9
      );

    const universeVisibility =
      1 - wolfMorphVisibility;

    const wolfToCarFade =
      THREE.MathUtils.smoothstep(
        carProgress,
        0.35,
        0.9
      );

    const wolfVisibility =
      wolfMorphVisibility *
      (1 - wolfToCarFade) *
      (1 - particleFadeProgress);

    const networkVisibility =
      THREE.MathUtils.smoothstep(
        wireframeProgress,
        0.02,
        0.65
      );

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

    this.carRenderer.setWireframeProgress(
      wireframeProgress
    );

    this.carRenderer.setOpacity(
      networkVisibility
    );
  }

  // ==========================================
  // MAIN ANIMATION LOOP
  // ==========================================

  private animate = (): void => {

    this.animationId =
      requestAnimationFrame(this.animate);

    const delta = Math.min(
      this.clock.getDelta(),
      0.05
    );

    if (this.morphProgress < 1) {

      this.universeRotation +=
        this.universeRotationSpeed * delta;

    }

    this.updateWolfAnimation(delta);
    this.updateMorph();

    this.carRenderer.update(delta);

    this.particleEngine.render();
  };

  // ==========================================
  // RESIZE
  // ==========================================

  private onResize = (): void => {

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

    cancelAnimationFrame(this.animationId);

    window.removeEventListener(
      'resize',
      this.onResize
    );

    // Kill master morph timeline
    this.morphTween?.scrollTrigger?.kill();
    this.morphTween?.kill();

    // Kill section transition tweens
    this.sectionTweens.forEach(tween => {
      tween.scrollTrigger?.kill();
      tween.kill();
    });

    this.sectionTweens = [];

    this.carRenderer.dispose();
    this.glowDecorator.dispose();
    this.particleEngine.dispose();

    this.clock.stop();
  }
}
