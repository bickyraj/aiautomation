
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import * as THREE from 'three';

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

  // ==========================================
  // SPHERE PARTICLES
  // ==========================================

  private particles?: THREE.Points;
  private glowParticles?: THREE.Points;

  private originalPositions?: Float32Array;
  private particleVelocities?: Float32Array;

  private glowTexture?: THREE.Texture;

  // ==========================================
  // WOLF PARTICLES
  // ==========================================

  private wolfParticles?: THREE.Points;
  private wolfGlowParticles?: THREE.Points;

  private wolfFrames: Float32Array[] = [];

  private wolfFrameIndex = 0;
  private wolfFrameDuration = 1 / 12;
  private wolfLastFrameTime = 0;

  private wolfAnimationPlaying = true;
  private wolfGlowTexture?: THREE.Texture;

  // ==========================================
  // ANIMATION
  // ==========================================

  private animationId = 0;

  // ==========================================
  // MOUSE INTERACTION
  // ==========================================

  private mouse = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();

  private mousePlane = new THREE.Plane(
    new THREE.Vector3(0, 0, 1),
    0
  );

  private mouseWorld = new THREE.Vector3();
  private localMouse = new THREE.Vector3();

  private mouseActive = false;

  // Sphere interaction settings
  private interactionRadius = 1.2;
  private interactionStrength = 1.0;
  private returnSpeed = 0.12;

  private springStrength = 0.012;
  private damping = 0.90;

  // ==========================================
  // INITIALIZATION
  // ==========================================

  ngAfterViewInit(): void {
    this.initScene();

    this.loadParticles();
    this.loadWolfParticles();

    this.animate();
  }

  private initScene(): void {

    const container = this.canvasContainer.nativeElement;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100
    );

    // Front view of the wolf
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(10, 0, 0);
    this.camera.lookAt(0, -2.5, 0);

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

    this.renderer.domElement.addEventListener(
      'pointermove',
      this.onMouseMove
    );

    this.renderer.domElement.addEventListener(
      'pointerleave',
      this.onMouseLeave
    );
  }

  // ==========================================
  // MOUSE MOVEMENT
  // ==========================================

  private onMouseMove = (event: PointerEvent): void => {

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    this.mouse.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    this.mouseActive =
      this.raycaster.ray.intersectPlane(
        this.mousePlane,
        this.mouseWorld
      ) !== null;
  };

  private onMouseLeave = (): void => {
    this.mouseActive = false;
  };

  // ==========================================
  // LOAD GOLDEN PARTICLE SPHERE
  // ==========================================

  private async loadParticles(): Promise<void> {

    try {

      const response = await fetch(
        '/assets/particles/particles.json'
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const positions: number[] = await response.json();

      if (
        !Array.isArray(positions) ||
        positions.length === 0 ||
        positions.length % 3 !== 0 ||
        !positions.every(Number.isFinite)
      ) {
        throw new Error('Invalid particle position array.');
      }

      this.originalPositions = new Float32Array(positions);

      this.particleVelocities = new Float32Array(
        positions.length
      );

      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );

      // Golden glow texture
      this.glowTexture = this.createGlowTexture();

      // Outer golden glow
      const glowMaterial = new THREE.PointsMaterial({
        color: 0xffb52e,
        size: 0.32,
        map: this.glowTexture,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      this.glowParticles = new THREE.Points(
        geometry,
        glowMaterial
      );

      this.scene.add(this.glowParticles);

      // Bright particle cores
      const coreMaterial = new THREE.PointsMaterial({
        color: 0xffffc2,
        size: 0.055,
        map: this.glowTexture,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      this.particles = new THREE.Points(
        geometry,
        coreMaterial
      );

      this.scene.add(this.particles);

      // Wolf is the focus during this first test.
      // Hide the sphere without removing its data.
      this.particles.visible = false;
      this.glowParticles.visible = false;

      console.log(
        'Golden sphere particles loaded:',
        positions.length / 3
      );

    } catch (error) {

      console.error(
        'Sphere particle loading failed:',
        error
      );

    }
  }

  // ==========================================
  // LOAD ANIMATED WOLF PARTICLES
  // ==========================================

  private async loadWolfParticles(): Promise<void> {

    try {

      const response = await fetch(
        '/assets/particles/wolf_particles.json'
      );

      if (!response.ok) {
        throw new Error(`Wolf loading failed: ${response.status}`);
      }

      const data = await response.json();

      if (
        !data.frames ||
        data.frames.length === 0 ||
        !Number.isInteger(data.particleCount) ||
        data.particleCount <= 0 ||
        !data.frames.every((frame: any) =>
          Array.isArray(frame.positions) &&
          frame.positions.length === data.particleCount * 3 &&
          frame.positions.every(Number.isFinite)
        )
      ) {
        throw new Error('Invalid wolf particle data.');
      }

      // Get first frame for consistent centering and scaling.
      const firstPositions = data.frames[0].positions;

      const bounds = new THREE.Box3();
      const point = new THREE.Vector3();

      for (let i = 0; i < firstPositions.length; i += 3) {

        point.set(
          firstPositions[i],
          firstPositions[i + 1],
          firstPositions[i + 2]
        );

        bounds.expandByPoint(point);
      }

      const center = bounds.getCenter(
        new THREE.Vector3()
      );

      const size = bounds.getSize(
        new THREE.Vector3()
      );

      const maxDimension = Math.max(
        size.x,
        size.y,
        size.z
      );

      if (!Number.isFinite(maxDimension) || maxDimension === 0) {
        throw new Error('Wolf has no measurable dimensions.');
      }

      const scale = 5.5 / maxDimension;

      // Apply the same scale and center to every frame.
      this.wolfFrames = data.frames.map((frame: any) => {

        const positions = new Float32Array(
          frame.positions.length
        );

        for (let i = 0; i < frame.positions.length; i += 3) {

          positions[i] =
            (frame.positions[i] - center.x) * scale;

          positions[i + 1] =
            (frame.positions[i + 1] - center.y) * scale;

          positions[i + 2] =
            (frame.positions[i + 2] - center.z) * scale;
        }

        return positions;
      });

      // Create shared wolf geometry.
      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          this.wolfFrames[0].slice(),
          3
        )
      );

      // Icy-blue glow texture.
      this.wolfGlowTexture = this.createWolfGlowTexture();

      // Outer icy glow.
      const glowMaterial = new THREE.PointsMaterial({
        color: 0x70cfff,
        size: 0.22,
        map: this.wolfGlowTexture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      this.wolfGlowParticles = new THREE.Points(
        geometry,
        glowMaterial
      );

      // Bright white particle cores.
      const coreMaterial = new THREE.PointsMaterial({
        color: 0xeafaff,
        size: 0.045,
        map: this.wolfGlowTexture,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      this.wolfParticles = new THREE.Points(
        geometry,
        coreMaterial
      );

      // Show wolf for the first test.
      this.wolfParticles.visible = true;
      this.wolfGlowParticles.visible = true;

      this.scene.add(this.wolfGlowParticles);
      this.scene.add(this.wolfParticles);

      // Hide golden sphere during wolf test.
      if (this.particles) {
        this.particles.visible = false;
      }

      if (this.glowParticles) {
        this.glowParticles.visible = false;
      }

      console.log(
        'Wolf particles loaded:',
        data.particleCount,
        'particles across',
        this.wolfFrames.length,
        'frames'
      );

    } catch (error) {

      console.error(
        'Wolf particle loading failed:',
        error
      );

    }
  }

  // ==========================================
  // ANIMATE PARTICLE SPHERE + MOUSE INTERACTION
  // ==========================================

  private animate = (): void => {

    this.animationId = requestAnimationFrame(
      this.animate
    );

    // ==========================================
    // SPHERE PHYSICS
    // ==========================================

    if (
      this.particles &&
      this.originalPositions &&
      this.particleVelocities
    ) {

      this.particles.rotation.y += 0.0015;
      this.particles.rotation.x += 0.0003;

      if (this.glowParticles) {
        this.glowParticles.rotation.copy(
          this.particles.rotation
        );
      }

      this.particles.updateMatrixWorld(true);

      this.localMouse.copy(this.mouseWorld);

      this.particles.worldToLocal(
        this.localMouse
      );

      const positionAttribute = this.particles.geometry
        .getAttribute('position') as THREE.BufferAttribute;

      const positions = positionAttribute.array as Float32Array;

      const original = this.originalPositions;
      const velocities = this.particleVelocities;

      for (let i = 0; i < positions.length; i += 3) {

        const x = positions[i];
        const y = positions[i + 1];

        const dx = x - this.localMouse.x;
        const dy = y - this.localMouse.y;

        const distance = Math.sqrt(
          dx * dx + dy * dy
        );

        let forceX = 0;
        let forceY = 0;

        // Mouse repulsion
        if (
          this.mouseActive &&
          distance < this.interactionRadius
        ) {

          const influence =
            1 - distance / this.interactionRadius;

          const force =
            influence * influence * this.interactionStrength;

          if (distance > 0.001) {

            forceX = (dx / distance) * force;
            forceY = (dy / distance) * force;
          }
        }

        // Spring force
        const returnX =
          (original[i] - x) * this.springStrength;

        const returnY =
          (original[i + 1] - y) * this.springStrength;

        const returnZ =
          (original[i + 2] - positions[i + 2]) *
          this.springStrength;

        // Velocity
        velocities[i] =
          (velocities[i] + forceX + returnX) *
          this.damping;

        velocities[i + 1] =
          (velocities[i + 1] + forceY + returnY) *
          this.damping;

        velocities[i + 2] =
          (velocities[i + 2] + returnZ) *
          this.damping;

        // Position
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
      }

      positionAttribute.needsUpdate = true;
    }

    // ==========================================
    // WOLF RUNNING ANIMATION
    // ==========================================

    if (
      this.wolfParticles &&
      this.wolfFrames.length > 0 &&
      this.wolfAnimationPlaying
    ) {

      const now = performance.now();

      if (this.wolfLastFrameTime === 0) {
        this.wolfLastFrameTime = now;
      }

      const frameInterval =
        this.wolfFrameDuration * 1000;

      if (now - this.wolfLastFrameTime >= frameInterval) {

        this.wolfLastFrameTime = now;

        this.wolfFrameIndex =
          (this.wolfFrameIndex + 1) %
          this.wolfFrames.length;

        const attribute = this.wolfParticles.geometry
          .getAttribute('position') as THREE.BufferAttribute;

        const positions = attribute.array as Float32Array;

        positions.set(
          this.wolfFrames[this.wolfFrameIndex]
        );

        attribute.needsUpdate = true;
      }
    }

    // ==========================================
    // RENDER
    // ==========================================

    this.renderer.render(
      this.scene,
      this.camera
    );
  };

  // ==========================================
  // GOLDEN GLOW TEXTURE
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

    gradient.addColorStop(
      0,
      'rgba(255, 255, 220, 1)'
    );

    gradient.addColorStop(
      0.12,
      'rgba(255, 220, 100, 0.9)'
    );

    gradient.addColorStop(
      0.35,
      'rgba(255, 170, 30, 0.35)'
    );

    gradient.addColorStop(
      1,
      'rgba(255, 140, 0, 0)'
    );

    context.fillStyle = gradient;

    context.fillRect(
      0, 0, 128, 128
    );

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  // ==========================================
  // WOLF ICY GLOW TEXTURE
  // ==========================================

  private createWolfGlowTexture(): THREE.Texture {

    const canvas = document.createElement('canvas');

    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d')!;

    const gradient = context.createRadialGradient(
      64, 64, 0,
      64, 64, 64
    );

    gradient.addColorStop(
      0,
      'rgba(255,255,255,1)'
    );

    gradient.addColorStop(
      0.15,
      'rgba(180,235,255,0.95)'
    );

    gradient.addColorStop(
      0.4,
      'rgba(70,180,255,0.4)'
    );

    gradient.addColorStop(
      1,
      'rgba(40,130,255,0)'
    );

    context.fillStyle = gradient;

    context.fillRect(
      0, 0, 128, 128
    );

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  ngOnDestroy(): void {

    cancelAnimationFrame(this.animationId);

    if (this.renderer) {

      this.renderer.domElement.removeEventListener(
        'pointermove',
        this.onMouseMove
      );

      this.renderer.domElement.removeEventListener(
        'pointerleave',
        this.onMouseLeave
      );
    }

    // Sphere cleanup
    if (this.particles) {

      this.particles.geometry.dispose();

      (
        this.particles.material as THREE.Material
      ).dispose();
    }

    if (this.glowParticles) {

      (
        this.glowParticles.material as THREE.Material
      ).dispose();
    }

    this.glowTexture?.dispose();

    // Wolf cleanup
    if (this.wolfParticles) {

      this.wolfParticles.geometry.dispose();

      (
        this.wolfParticles.material as THREE.Material
      ).dispose();
    }

    if (this.wolfGlowParticles) {

      (
        this.wolfGlowParticles.material as THREE.Material
      ).dispose();
    }

    this.wolfGlowTexture?.dispose();

    // Renderer cleanup
    this.renderer?.dispose();

    this.renderer?.domElement.remove();
  }
}
