
import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy
} from '@angular/core';

import * as THREE from 'three';
import { gsap } from 'gsap';

interface Particle {
  position: [number, number, number];
  color: {
    r: number;
    g: number;
    b: number;
  };
  alpha: number;
  size: number;
}

interface ParticleData {
  image: string;
  width: number;
  height: number;
  particle_count: number;
  particles: Particle[];
}

@Component({
  selector: 'app-handicrafts',
  standalone: true,
  templateUrl: './handicrafts.html'
})
export class Handicrafts
  implements AfterViewInit, OnDestroy {

  @ViewChild('particleCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private particleCloud?: THREE.Points;
  private animationId = 0;



  ngAfterViewInit(): void {
    this.initScene();
    this.loadParticles();
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080808);

    this.camera = new THREE.PerspectiveCamera(
      50,
      width / height,
      0.1,
      100
    );

    this.camera.position.set(0, 0, 4);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    this.renderer.setSize(width, height);

    this.animate();

    window.addEventListener('resize', this.onResize);
  }

  private async loadParticles(): Promise<void> {

    try {
      const response = await fetch(
        '/assets/particles/buddha_particles.json'
      );

      if (!response.ok) {
        throw new Error('Could not load particle JSON');
      }

      const data: ParticleData = await response.json();

      this.createParticleCloud(data);

    } catch (error) {
      console.error('Particle loading error:', error);
    }
  }

  private createParticleCloud(data: ParticleData): void {

    const particles = data.particles;

    const positions = new Float32Array(
      particles.length * 3
    );

    const colors = new Float32Array(
      particles.length * 4
    );

    particles.forEach((particle, i) => {

      const p = particle.position;
      const c = particle.color;

      // Position
      positions[i * 3] = p[0];
      positions[i * 3 + 1] = p[1];
      positions[i * 3 + 2] = p[2];

      // Original RGB color
      colors[i * 4] = c.r / 255;
      colors[i * 4 + 1] = c.g / 255;
      colors[i * 4 + 2] = c.b / 255;

      // Transparency
      colors[i * 4 + 3] = particle.alpha / 255;
    });

    // Geometry
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 4)
    );

    // Material
    const material = new THREE.PointsMaterial({
      size: 3,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    // Create point cloud
    this.particleCloud = new THREE.Points(
      geometry,
      material
    );

    this.scene.add(this.particleCloud);

    // GSAP entrance animation
    gsap.fromTo(
      material,
      {
        opacity: 0
      },
      {
        opacity: 1,
        duration: 2,
        ease: 'power2.out'
      }
    );

    gsap.fromTo(
      this.particleCloud.scale,
      {
        x: 0.85,
        y: 0.85,
        z: 0.85
      },
      {
        x: 1,
        y: 1,
        z: 1,
        duration: 2,
        ease: 'power3.out'
      }
    );

    console.log(
      'Particles loaded:',
      particles.length
    );
  }


  private animate = (): void => {

    this.animationId = requestAnimationFrame(
      this.animate
    );

    if (this.particleCloud) {

      const time = performance.now() * 0.0003;

      this.particleCloud.rotation.y =
        Math.sin(time) * 0.04;

      this.particleCloud.rotation.z =
        Math.sin(time * 0.7) * 0.012;

    }

    this.renderer.render(
      this.scene,
      this.camera
    );
  };


  private onResize = (): void => {

    if (!this.renderer || !this.camera) return;

    const canvas = this.canvasRef.nativeElement;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  ngOnDestroy(): void {

    cancelAnimationFrame(this.animationId);

    window.removeEventListener(
      'resize',
      this.onResize
    );

    if (this.particleCloud) {
      this.particleCloud.geometry.dispose();

      const material = this.particleCloud.material;
      if (material instanceof THREE.Material) {
        material.dispose();
      }

      this.scene.remove(this.particleCloud);
    }

    this.renderer?.dispose();
  }
}
