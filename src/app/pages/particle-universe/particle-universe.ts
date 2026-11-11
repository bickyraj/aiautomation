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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
  // SPHERE → WOLF DOWNWARD DROP
  // ==========================================

  // How far the particles fall while flowing
  // from the sphere into the wolf.
  private readonly sphereDropDistance = 3;

  // Drop happens on the Z axis only, and Z is the
  // vertical axis in this scene: (0, 0, -1) = down.
  // Set sphereDropDistance to 0 if you want the morphing
  // particles to simply stay in place while the sphere
  // object goes up.
  private readonly sphereDropDirection =
    new THREE.Vector3(0, 0, -1);

  // How far the sphere object moves up while scrolling.
  private readonly sphereScrollUpDistance = 2;

  // ==========================================
  // SPHERE TOP-DOWN BURST
  // ==========================================

  // Which axis is "up" in the particle data: 0 = X, 1 = Y, 2 = Z.
  private readonly sphereTopAxis = 2;

  // 1 = particles with the highest value on that axis are the top.
  // Set to -1 if "up" and "down" are swapped.
  private readonly sphereTopSign = 1;

  // Where the burst starts, as a height on the sphere:
  // 0 = bottom, 0.5 = middle, 1 = top.
  // The release spreads out from this height both up and down.
  private readonly sphereBurstOrigin = 0.5;

  // How much of the transition is used to spread the start
  // from the top of the sphere to the bottom (0 = all at once,
  // 0.6 = a long top-to-bottom cascade).
  private readonly sphereBurstSpread = 0.5;

  // Outward scatter at the moment each particle is released.
  // Set to 0 for no scatter, only the top-down cascade.
  private readonly sphereBurstDistance = 1.5;

  // ==========================================
  // WOLF LEFT → RIGHT FORMATION
  // ==========================================

  // Which axis runs left to right in the wolf data: 0 = X, 1 = Y, 2 = Z.
  private readonly wolfSweepAxis = 0;

  // 1 = lower values on that axis are the left side.
  // Set to -1 if the wolf forms from right to left.
  private readonly wolfSweepSign = 1;

  // When the sweep starts, as a fraction of the sphere → wolf transition.
  private readonly wolfSweepStart = 0.35;

  // How much of the transition is used to spread the start from the
  // left side to the right side. Each particle's own settle time is
  // 1 - start - spread, so a bigger spread means a slower, clearer sweep.
  private readonly wolfSweepSpread = 0.4;

  // 0 for the left side of the wolf, 1 for the right side.
  private wolfSweepDelay?: Float32Array;

  // Particle objects that are lifted together on scroll.
  private sphereObject?: THREE.Object3D;
  private wolfObject?: THREE.Object3D;
  private wolfBaseZ = 0;

  // 0 for the particles at the burst origin, 1 for the farthest ones.
  private sphereTopDelay?: Float32Array;

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

  // Moves the finished wolf along the vertical (Z) axis.
  // Negative = lower, positive = higher. 0 = original position.
  private readonly wolfOffsetZ = -2;

  private morphTween?: gsap.core.Timeline;

  private sectionTweens: gsap.core.Animation[] = [];

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

    this.loadEarth();

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

      this.prepareSphereTopDelay();

      const colors =
        this.particleColorGenerator.generateGalaxyColors(
          this.originalPositions
        );

      const universeModel = new ParticleModel({
        positions: this.animatedPositions,
        color: 0xffffff,
        particleSize: 0.02,
        opacity: 0,
        colors
      });

      this.universeId =
        this.particleEngine.createParticles(universeModel);

      this.universeGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.universeId),
        {
          color: 0xffffff,
          size: 0,
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
  // PREPARE TOP-DOWN BURST ORDER
  // ==========================================

  private prepareSphereTopDelay(): void {

    if (!this.originalPositions) return;

    const count = this.originalPositions.length / 3;
    const axis = this.sphereTopAxis;

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < count; i++) {
      const v = this.originalPositions[i * 3 + axis] * this.sphereTopSign;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }

    const range = Math.max(max - min, 0.0001);

    const origin = THREE.MathUtils.clamp(
      this.sphereBurstOrigin,
      0,
      1
    );

    // Distance to the farthest end of the sphere.
    const farthest = Math.max(origin, 1 - origin, 0.0001);

    this.sphereTopDelay = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const v = this.originalPositions[i * 3 + axis] * this.sphereTopSign;

      // Height on the sphere: 0 = bottom, 1 = top.
      const height = (v - min) / range;

      // 0 at the burst origin, 1 at the farthest end.
      this.sphereTopDelay[i] = Math.abs(height - origin) / farthest;
    }
  }

  // ==========================================
  // PREPARE LEFT → RIGHT FORMATION ORDER
  // ==========================================

  private prepareWolfSweepDelay(): void {

    if (this.matchedWolfFrames.length === 0) return;

    const frameCount = this.matchedWolfFrames.length;
    const count = this.matchedWolfFrames[0].length / 3;
    const axis = this.wolfSweepAxis;

    // Average position over all frames, so the order stays
    // stable while the wolf is running.
    const average = new Float32Array(count);

    for (const frame of this.matchedWolfFrames) {
      for (let i = 0; i < count; i++) {
        average[i] += frame[i * 3 + axis] * this.wolfSweepSign;
      }
    }

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < count; i++) {
      average[i] /= frameCount;
      min = Math.min(min, average[i]);
      max = Math.max(max, average[i]);
    }

    const range = Math.max(max - min, 0.0001);

    this.wolfSweepDelay = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Left side = 0, right side = 1.
      this.wolfSweepDelay[i] = (average[i] - min) / range;
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
      this.prepareWolfSweepDelay();

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
          size: 0.5,
          opacity: 1
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

    const sphere = this.particleEngine.getParticleObject(this.universeId);
    const wolfObject = this.particleEngine.getParticleObject(this.wolfId);

    this.sphereObject = sphere;
    this.wolfObject = wolfObject;
    this.wolfBaseZ = wolfObject.position.z;

    const universeTransition = gsap.timeline({
      scrollTrigger: {
        trigger: wolfSection,
        start: 'top bottom',
        end: 'top top',
        scrub: 2,
        invalidateOnRefresh: true
      }
    });

    universeTransition
      .to(universeSection, {
        yPercent: -18,
        scale: 1,
        opacity: 0,
        ease: 'none'
      }, 0)

      // Sphere moves UP while scrolling.
      // In this scene Z is the vertical axis.
      .to(sphere.position, {
        z: sphere.position.z + this.sphereScrollUpDistance,
        ease: 'none'
      }, 0)

      // The wolf object moves up by exactly the same amount,
      // so the two wolves overlap during the crossfade
      // instead of showing up as two separate wolves.
      .to(wolfObject.position, {
        z: wolfObject.position.z + this.sphereScrollUpDistance,
        ease: 'none'
      }, 0);

    this.sectionTweens.push(universeTransition);

    // =====================================
    // 2. WOLF → CAR SECTION
    // =====================================

    const wolfTransition = gsap.to(
      wolfSection,
      {
        yPercent: -18,
        scale: 1,
        opacity: 0.0,
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
  // CONTINUOUS SPIRAL FLOW + DOWNWARD DROP
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

    // Cascade from the burst origin: every particle has its
    // own local progress. Particles at the origin height are
    // released first, the farthest ones last, and all of
    // them reach the wolf when t = 1.
    const spread = THREE.MathUtils.clamp(
      this.sphereBurstSpread,
      0,
      0.95
    );

    const count = this.animatedPositions.length;

    // ======================================
    // PROCESS EVERY PARTICLE
    // ======================================

    for (let i = 0; i < count; i += 3) {

      const particleIndex = i / 3;

      const delay =
        this.sphereTopDelay?.[particleIndex] ?? 0;

      const localT = THREE.MathUtils.clamp(
        (t - delay * spread) / (1 - spread),
        0,
        1
      );

      // Wolf formation starts later for each particle.
      const releaseConvergence = THREE.MathUtils.smoothstep(
        localT,
        this.wolfConvergenceStart,
        1
      );

      // Left → right sweep: particles on the left side of the
      // wolf settle first, the right side last. Every particle
      // is fully settled when t = 1.
      const sweepDelay =
        this.wolfSweepDelay?.[particleIndex] ?? 0;

      const sweepWindow = Math.max(
        1 - this.wolfSweepStart - this.wolfSweepSpread,
        0.0001
      );

      const sweep = THREE.MathUtils.smoothstep(
        (t - this.wolfSweepStart - sweepDelay * this.wolfSweepSpread) /
        sweepWindow,
        0,
        1
      );

      const convergence = releaseConvergence * sweep;

      // Zero when the particle is released and
      // zero when it reaches the wolf.
      const depthEnvelope =
        Math.sin(Math.PI * localT);

      // Downward drop on the Z axis.
      const drop =
        this.sphereDropDistance * depthEnvelope;

      const dropX = this.sphereDropDirection.x * drop;
      const dropY = this.sphereDropDirection.y * drop;
      const dropZ = this.sphereDropDirection.z * drop;

      // Outward scatter when the particle is released.
      // X and Y spread out, Z always goes down.
      let burstX = 0;
      let burstY = 0;
      let burstZ = 0;

      if (this.energyDirections && this.sphereBurstDistance > 0) {

        const burst =
          this.sphereBurstDistance * depthEnvelope;

        burstX = this.energyDirections[i] * burst;
        burstY = this.energyDirections[i + 1] * burst;
        burstZ = -Math.abs(this.energyDirections[i + 2]) * burst;
      }

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
        wolfFrame[i + 2] * this.wolfScale +
        this.wolfOffsetZ;

      // ----------------------------------
      // GRADUAL CONVERGENCE + DROP
      // ----------------------------------

      // The sphere first flows and twists.
      // Then the particles progressively
      // settle into their wolf positions.
      // The drop is added on top and returns
      // to zero when the wolf is formed.

      this.animatedPositions[i] =
        THREE.MathUtils.lerp(
          flowX,
          wolfX,
          convergence
        ) + dropX + burstX;

      this.animatedPositions[i + 1] =
        THREE.MathUtils.lerp(
          flowY,
          wolfY,
          convergence
        ) + dropY + burstY;

      this.animatedPositions[i + 2] =
        THREE.MathUtils.lerp(
          flowZ,
          wolfZ,
          convergence
        ) + dropZ + burstZ;
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

      // The wolf object is lifted on scroll, but the car edges are
      // sampled in world space, so remove that lift from the targets.
      const wolfLift = this.wolfObject
        ? this.wolfObject.position.z - this.wolfBaseZ
        : 0;

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
          this.carParticlePositions[i + 2] - wolfLift;

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

  public async loadEarth(): Promise<void> {

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const data = await (await fetch('/assets/particles/earth_particles.json')).json();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('color',    new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('light',    new THREE.Float32BufferAttribute(data.lights, 1));

    const material = new THREE.ShaderMaterial({
      vertexColors: true,
      uniforms: {
        uSize:       { value: 18.0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uSunDir:     { value: new THREE.Vector3(1, 0.3, 0.6).normalize() },
      },
      vertexShader: /* glsl */`
    attribute float light;
    varying vec3 vColor;
    varying float vLight;
    varying float vDay;

    uniform float uSize;
    uniform float uPixelRatio;
    uniform vec3 uSunDir;

    void main() {
      vColor = color;
      vLight = light;

      vec3 worldNormal = normalize((modelMatrix * vec4(position, 0.0)).xyz);
      vDay = dot(worldNormal, uSunDir);

      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize * uPixelRatio / -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
      fragmentShader: /* glsl */`
    varying vec3 vColor;
    varying float vLight;
    varying float vDay;

    void main() {
      if (length(gl_PointCoord - 0.5) > 0.5) discard;

      float dayMix = smoothstep(-0.1, 0.25, vDay);

      vec3 day = vColor * (0.45 + 1.2 * dayMix);

      vec3 night = vec3(1.0, 0.8, 0.45)
                 * vLight * 4.0 * (1.0 - dayMix);

      vec3 finalColor = day + night;

      gl_FragColor = vec4(finalColor, 1.0);

      #include <colorspace_fragment>
    }
  `,
    });

    const earth = new THREE.Points(geometry, material);
    earth.rotation.x = THREE.MathUtils.degToRad(40);
    earth.rotation.y = THREE.MathUtils.degToRad(30);
    earth.rotation.z = THREE.MathUtils.degToRad(40);
    const earthScale = 4;
    earth.scale.set(earthScale, earthScale, earthScale);

    const rotateEarth = () => {
      earth.rotation.x += 0.002;
      requestAnimationFrame(rotateEarth);
    };
    rotateEarth();
    this.particleEngine.addObject(earth);
  }
}
