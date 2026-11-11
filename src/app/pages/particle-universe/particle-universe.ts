
import {
  AfterViewInit,
  Component,
  ElementRef, inject,
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
import {ParticleColorGenerator} from '../../services/particle-color-generator';

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

  private particleColorGenerator: ParticleColorGenerator = inject(ParticleColorGenerator);

  constructor(private particleEngine: ParticleEngine) {}

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

      // Generate individual galaxy colors.
      const colors =
        this.particleColorGenerator.generateGalaxyColors(
          this.originalPositions
        );

      const universeModel = new ParticleModel({
        positions: this.animatedPositions,
        color: 0xffffff,
        particleSize: 0.02,
        opacity: 0.9,
        colors
      });

      this.universeId = this.particleEngine.createParticles(
        universeModel
      );

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

      this.prepareEnergyMotion();

      // Generate an icy blue gradient based on the wolf's shape.
      const wolfColors =
        this.particleColorGenerator.generateWolfColors(
          this.matchedWolfFrames[0]
        );

      const wolfModel = new ParticleModel({
        positions: new Float32Array(this.originalPositions.length),
        color: 0x176FCB,
        particleSize: 0.04,
        opacity: 1,
        colors: wolfColors
      });

      this.wolfId = this.particleEngine.createParticles(
        wolfModel
      );

      this.wolfGlowId = this.glowDecorator.decorate(
        this.particleEngine.getParticleObject(this.wolfId),
        {
          color: 0x80cfff,
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

    const particleCount = this.originalPositions.length / 3;

    this.energyDirections = new Float32Array(particleCount * 3);
    this.energySwirl = new Float32Array(particleCount);

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

      this.energyDirections[offset] = radius * Math.cos(angle);
      this.energyDirections[offset + 1] = radius * Math.sin(angle);
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
    const experience = this.canvasContainer.nativeElement
      .closest('.particle-experience');

    const universeSection = experience?.querySelector('.section-universe');
    const wolfSection = experience?.querySelector('.section-wolf');
    const carSection = experience?.querySelector('.section-car');

    if (!experience || !universeSection || !wolfSection || !carSection) {
      console.error('One or more sections could not be found.');
      return;
    }

    this.morphProgress = 0;
    this.carProgress = 0;
    this.wireframeProgress = 0;
    this.particleFadeProgress = 0;
    this.carMorphStarted = false;

    ScrollTrigger.create({
      trigger: universeSection,
      start: 'top top',
      end: '+=100%',
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true
    });

    ScrollTrigger.create({
      trigger: wolfSection,
      start: 'top top',
      end: '+=100%',
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true
    });

    ScrollTrigger.create({
      trigger: carSection,
      start: 'top top',
      end: '+=100%',
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true
    });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: experience,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        // pin: true,
        // pinSpacing: true,
        // anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      // 1. Hold the sphere
      .to({}, { duration: 3 })

      // 2. Sphere → Wolf
      .to(this, {
        morphProgress: 1,
        duration: 3,
        ease: 'power1.inOut'
      })

      // 3. Hold the wolf
      .to({}, { duration: 2 })

      // 4. Wolf → Car
      .to(this, {
        carProgress: 1,
        wireframeProgress: 1,
        duration: 5,
        ease: 'sine.inOut'
      })

      // 5. Hold the car
      .to({}, { duration: 2 });

    this.morphTween = timeline;

    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  }

  // ==========================================
  // RUNNING WOLF FRAME ANIMATION
  // ==========================================

  private updateWolfAnimation(delta: number): void {
    // Keep the wolf running during the car transition.
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

    const cos = Math.cos(this.universeRotation);
    const sin = Math.sin(this.universeRotation);

    const smoothMorphProgress =
      (1 - Math.cos(Math.PI * progress)) / 2;

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
        smoothMorphProgress
      );

      this.animatedPositions[i + 1] = THREE.MathUtils.lerp(
        sphereY,
        wolfY,
        smoothMorphProgress
      );

      this.animatedPositions[i + 2] = THREE.MathUtils.lerp(
        sphereZ,
        wolfZ,
        smoothMorphProgress
      );
    }

    this.particleEngine.updateParticles(
      this.universeId,
      this.animatedPositions
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
    //    WITH RUNNING ANIMATION CARRIED OVER
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

      // Running motion gradually fades as the car forms.
      const animationWeight = 1 - smoothCarProgress;

      for (
        let i = 0;
        i < this.wolfToCarPositions.length;
        i += 3
      ) {
        const particleIndex = i / 3;

        const startX = this.wolfToCarStartPositions[i];
        const startY = this.wolfToCarStartPositions[i + 1];
        const startZ = this.wolfToCarStartPositions[i + 2];

        // Current animated wolf position relative to captured pose.
        const animationOffsetX =
          this.animatedPositions[i] - startX;

        const animationOffsetY =
          this.animatedPositions[i + 1] - startY;

        const animationOffsetZ =
          this.animatedPositions[i + 2] - startZ;

        const targetX = this.carParticlePositions[i];
        const targetY = this.carParticlePositions[i + 1];
        const targetZ = this.carParticlePositions[i + 2];

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

        const directionX = this.energyDirections[i];
        const directionY = this.energyDirections[i + 1];
        const directionZ = this.energyDirections[i + 2];

        const swirl = this.energySwirl[particleIndex];

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

    const wolfMorphVisibility = THREE.MathUtils.smoothstep(
      progress,
      0.55,
      0.9
    );

    const universeVisibility = 1 - wolfMorphVisibility;

    const wolfToCarFade = THREE.MathUtils.smoothstep(
      carProgress,
      0.35,
      0.9
    );

    const wolfVisibility =
      wolfMorphVisibility *
      (1 - wolfToCarFade) *
      (1 - particleFadeProgress);

    const networkVisibility = THREE.MathUtils.smoothstep(
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

    this.carRenderer.setOpacity(networkVisibility);
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

    this.carRenderer.update(delta);

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
