
import {inject, Injectable} from '@angular/core';
import * as THREE from 'three';
import { ParticleModel } from '../models/particle-model.model';

interface ParticleSystem {
  model: ParticleModel;
  geometry: THREE.BufferGeometry;
  particles: THREE.Points;
  material: THREE.PointsMaterial;
}

@Injectable()
export class ParticleEngine {

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private particleSystems = new Map<string, ParticleSystem>();
  private nextId = 0;
  private initialized = false;

  // --------------------------------------------------
  // INITIALIZE
  // --------------------------------------------------

  initialize(container: HTMLDivElement): void {

    if (this.initialized) {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100
    );

    // Preserve original camera orientation.
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

    this.initialized = true;
  }

  // --------------------------------------------------
  // CREATE PARTICLES
  // --------------------------------------------------

  createParticles(model: ParticleModel): string {

    if (!this.initialized) {
      throw new Error('ParticleEngine must be initialized first.');
    }

    const config = model.getConfig();
    const positions = model.getPositions();

    // Validate particle positions without creating
    // a temporary JavaScript array.
    if (
      positions.length === 0 ||
      positions.length % 3 !== 0
    ) {
      throw new Error('Invalid particle positions.');
    }

    for (let i = 0; i < positions.length; i++) {
      if (!Number.isFinite(positions[i])) {
        throw new Error('Invalid particle positions.');
      }
    }

    const id = `particle-system-${this.nextId++}`;

    // Create geometry using the model's existing buffer.
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    const colors = model.getColors();

    if (colors) {
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors, 3)
      );
    }

    // Create particle material.
    const material = new THREE.PointsMaterial({
      color: colors ? 0xffffff : config.color,
      size: config.particleSize,
      transparent: true,
      opacity: config.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: !!colors
    });

    // Create particle object.
    const particles = new THREE.Points(
      geometry,
      material
    );

    this.scene.add(particles);

    // Store model and Three.js objects together.
    this.particleSystems.set(id, {
      model,
      geometry,
      particles,
      material
    });

    return id;
  }

  // --------------------------------------------------
  // UPDATE PARTICLE POSITIONS
  // --------------------------------------------------

  updateParticles(
    id: string,
    positions: Float32Array
  ): void {

    const system = this.getSystem(id);

    // Update the model's existing position buffer.
    system.model.setPositions(positions);

    // Geometry already references the same buffer.
    // Only notify Three.js that the data has changed.
    const positionAttribute = system.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;

    positionAttribute.needsUpdate = true;
  }

  // --------------------------------------------------
  // CONTROL VISIBILITY
  // --------------------------------------------------

  setVisibility(id: string, opacity: number): void {

    const system = this.getSystem(id);

    system.material.opacity =
      system.model.getConfig().opacity *
      THREE.MathUtils.clamp(opacity, 0, 1);
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  render(): void {

    if (!this.initialized) {
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // --------------------------------------------------
  // RESIZE
  // --------------------------------------------------

  resize(width: number, height: number): void {

    if (!this.initialized || width <= 0 || height <= 0) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  // --------------------------------------------------
  // REMOVE ONE PARTICLE SYSTEM
  // --------------------------------------------------

  removeParticles(id: string): void {

    const system = this.particleSystems.get(id);

    if (!system) {
      return;
    }

    this.scene.remove(system.particles);

    system.geometry.dispose();
    system.material.dispose();

    this.particleSystems.delete(id);
  }

  // --------------------------------------------------
  // DISPOSE EVERYTHING
  // --------------------------------------------------

  dispose(): void {

    for (const id of this.particleSystems.keys()) {
      this.removeParticles(id);
    }

    if (this.initialized) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }

    this.initialized = false;
  }

  // --------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------

  private getSystem(id: string): ParticleSystem {

    const system = this.particleSystems.get(id);

    if (!system) {
      throw new Error(`Particle system not found: ${id}`);
    }

    return system;
  }

  // --------------------------------------------------
// GET PARTICLE OBJECT
// --------------------------------------------------

  getParticleObject(id: string): THREE.Points {

    const system = this.getSystem(id);

    return system.particles;
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  getScene(): THREE.Scene {
    return this.scene;
  }
}
