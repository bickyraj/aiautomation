
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
  templateUrl: './particle-universe.html',
  styleUrl: './particle-universe.scss'
})
export class ParticleUniverse implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer')
  canvasContainer!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private glowParticles?: THREE.Points;
  private coreParticles?: THREE.Points;
  private glowTexture?: THREE.Texture;

  private originalPositions?: Float32Array;
  private animatedPositions?: Float32Array;

  private wolfFrames: Float32Array[] = [];
  private matchedWolfFrames: Float32Array[] = [];

  private morphProgress = 0;
  private readonly universeScale = 1.5;
  private readonly wolfScale = 5;
  private morphTween?: gsap.core.Timeline;

  private wolfFrameProgress = 0;
  private readonly wolfFramesPerSecond = 12;

  private universeRotation = 0;
  private readonly universeRotationSpeed = 0.15;

  private animationId = 0;
  private clock = new THREE.Clock();

  private wolfGlowTexture?: THREE.Texture;

  private readonly sphereUrl =
    '/assets/particles/particles.json';

  private readonly wolfUrl =
    '/assets/particles/wolf_particles.json';

  async ngAfterViewInit(): Promise<void> {

    gsap.registerPlugin(ScrollTrigger);

    this.initScene();

    const sphereLoaded = await this.loadSphereParticles();

    if (!sphereLoaded) {
      return;
    }

    const wolfLoaded = await this.loadWolfParticles();

    if (!wolfLoaded) {
      return;
    }

    this.setupScrollAnimation();

    this.animate();
  }

  // ==========================================
  // THREE.JS SCENE
  // ==========================================

  private initScene(): void {

    const container = this.canvasContainer.nativeElement;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100
    );

    this.camera.up.set(0, 0, 1);
    this.camera.position.set(10, -1, 0);
    this.camera.lookAt(0, -3, 1.7);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(width, height);

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', this.onResize);
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

      this.createParticleSphere();

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

      // Ensure Blender frames play in numerical order.
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
  // CREATE ICY PARTICLES
  // ==========================================

  private createParticleSphere(): void {

    if (!this.animatedPositions) return;

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.animatedPositions, 3)
    );

    this.glowTexture = this.createGlowTexture();

    const glowMaterial = new THREE.PointsMaterial({
      color: 0x58cfff,
      size: 0.19,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    const coreMaterial = new THREE.PointsMaterial({
      color: 0xe6faff,
      size: 0.065,
      map: this.glowTexture,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.glowParticles = new THREE.Points(
      geometry,
      glowMaterial
    );

    this.coreParticles = new THREE.Points(
      geometry,
      coreMaterial
    );

    // Scale is handled directly in updateMorph().
    // Do not scale either Points object here.

    this.scene.add(this.glowParticles);
    this.scene.add(this.coreParticles);
  }

  // ==========================================
  // ICY GLOW TEXTURE
  // ==========================================

  private createGlowTexture(): THREE.Texture {

    const canvas = document.createElement('canvas');

    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d')!;

    const gradient = context.createRadialGradient(
      64, 64, 0,
      64, 64, 64
    );

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.12, 'rgba(225,250,255,1)');
    gradient.addColorStop(0.3, 'rgba(115,220,255,0.95)');
    gradient.addColorStop(0.5, 'rgba(55,180,255,0.45)');
    gradient.addColorStop(0.75, 'rgba(30,130,255,0.12)');
    gradient.addColorStop(1, 'rgba(30,130,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  // ==========================================
  // SCROLL-BASED MORPH
  // ==========================================

  private setupScrollAnimation(): void {

    const section = this.canvasContainer.nativeElement
      .closest('.particle-universe-section');

    if (!section) {
      console.error('Particle section not found.');
      return;
    }

    this.morphProgress = 0;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=400%',
        scrub: 1,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      .to({}, { duration: 1 })
      .to(this, {
        morphProgress: 1,
        duration: 10,
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

    if (this.matchedWolfFrames.length === 0) {
      return undefined;
    }

    const count = this.matchedWolfFrames.length;

    const currentIndex = Math.floor(this.wolfFrameProgress);
    const nextIndex = (currentIndex + 1) % count;

    const blend = this.wolfFrameProgress - currentIndex;

    const frameA = this.matchedWolfFrames[currentIndex];
    const frameB = this.matchedWolfFrames[nextIndex];

    return this.interpolateFrames(frameA, frameB, blend);
  }

  private interpolateFrames(
    frameA: Float32Array,
    frameB: Float32Array,
    blend: number
  ): Float32Array {

    const result = new Float32Array(frameA.length);

    for (let i = 0; i < result.length; i++) {

      result[i] = THREE.MathUtils.lerp(
        frameA[i],
        frameB[i],
        blend
      );
    }

    return result;
  }

  // ==========================================
  // MORPH SPHERE INTO RUNNING WOLF
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

    // Calculate current sphere rotation.
    const cos = Math.cos(this.universeRotation);
    const sin = Math.sin(this.universeRotation);

    for (let i = 0; i < this.animatedPositions.length; i += 3) {

      // Original sphere coordinates.
      const x = this.originalPositions[i];
      const y = this.originalPositions[i + 1];
      const z = this.originalPositions[i + 2];

      // Rotate sphere around the Z axis.
      const rotatedX = x * cos - y * sin;
      const rotatedY = x * sin + y * cos;

      // Apply universe scale.
      const sphereX = rotatedX * this.universeScale;
      const sphereY = rotatedY * this.universeScale;
      const sphereZ = z * this.universeScale;

      // Apply wolf scale in its original Blender orientation.
      const wolfX = wolfFrame[i] * this.wolfScale;
      const wolfY = wolfFrame[i + 1] * this.wolfScale;
      const wolfZ = wolfFrame[i + 2] * this.wolfScale;

      // Morph from sphere coordinates into wolf coordinates.
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

    const coreAttribute = this.coreParticles?.geometry
      .getAttribute('position') as THREE.BufferAttribute;

    const glowAttribute = this.glowParticles?.geometry
      .getAttribute('position') as THREE.BufferAttribute;

    if (coreAttribute) coreAttribute.needsUpdate = true;
    if (glowAttribute) glowAttribute.needsUpdate = true;
  }

  // ==========================================
  // MAIN ANIMATION LOOP
  // ==========================================

  private animate = (): void => {

    this.animationId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    // Rotate the universe while the morph is incomplete.
    if (this.morphProgress < 1) {
      this.universeRotation +=
        this.universeRotationSpeed * delta;
    }

    this.updateWolfAnimation(delta);

    this.updateMorph();

    this.renderer.render(this.scene, this.camera);
  };

  // ==========================================
  // RESIZE
  // ==========================================

  private onResize = (): void => {

    if (!this.camera || !this.renderer) return;

    const container = this.canvasContainer.nativeElement;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);

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

    if (this.glowParticles) {
      this.glowParticles.geometry.dispose();
      (this.glowParticles.material as THREE.Material).dispose();
    }

    if (this.coreParticles) {
      (this.coreParticles.material as THREE.Material).dispose();
    }

    this.glowTexture?.dispose();

    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
