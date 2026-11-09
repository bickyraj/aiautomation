
import * as THREE from 'three';

export interface GlowOptions {
  color: number;
  size: number;
  opacity: number;
}

interface GlowLayer {
  source: THREE.Points;
  glow: THREE.Points;
  material: THREE.PointsMaterial;
}

export class GlowDecorator {

  private layers = new Map<string, GlowLayer>();

  private nextId = 0;

  // --------------------------------------------------
  // ADD GLOW
  // --------------------------------------------------

  decorate(
    particles: THREE.Points,
    options: GlowOptions
  ): string {

    const id = `glow-${this.nextId++}`;

    // Reuse the particle geometry.
    const geometry = particles.geometry;

    // Create a soft radial gradient texture.
    const texture = this.createGlowTexture();

    // Create a separate material for the glow.
    const material = new THREE.PointsMaterial({
      color: options.color,
      size: options.size,
      map: texture,
      transparent: true,
      opacity: THREE.MathUtils.clamp(options.opacity, 0, 1),
      blending: THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: 0.001
    });

    // Create the glow layer using the same positions.
    const glow = new THREE.Points(
      geometry,
      material
    );

    // Render the glow behind the original particles.
    glow.renderOrder = particles.renderOrder - 1;

    // Attach it to the original particle object.
    particles.add(glow);

    this.layers.set(id, {
      source: particles,
      glow,
      material
    });

    return id;
  }

  // --------------------------------------------------
  // CONTROL GLOW OPACITY
  // --------------------------------------------------

  setOpacity(id: string, opacity: number): void {

    const layer = this.getLayer(id);

    layer.material.opacity =
      THREE.MathUtils.clamp(opacity, 0, 1);
  }

  // --------------------------------------------------
  // CONTROL GLOW COLOR
  // --------------------------------------------------

  setColor(id: string, color: number): void {

    const layer = this.getLayer(id);

    layer.material.color.set(color);
  }

  // --------------------------------------------------
  // CONTROL GLOW SIZE
  // --------------------------------------------------

  setSize(id: string, size: number): void {

    const layer = this.getLayer(id);

    layer.material.size = Math.max(0, size);
  }

  // --------------------------------------------------
  // REMOVE ONE GLOW LAYER
  // --------------------------------------------------

  remove(id: string): void {

    const layer = this.layers.get(id);

    if (!layer) {
      return;
    }

    layer.source.remove(layer.glow);

    // The geometry belongs to ParticleEngine.
    // Dispose only resources created by this decorator.
    layer.material.map?.dispose();
    layer.material.dispose();

    this.layers.delete(id);
  }

  // --------------------------------------------------
  // DISPOSE ALL GLOW LAYERS
  // --------------------------------------------------

  dispose(): void {

    for (const id of this.layers.keys()) {
      this.remove(id);
    }
  }

  // --------------------------------------------------
  // CREATE RADIAL GLOW TEXTURE
  // --------------------------------------------------

  private createGlowTexture(): THREE.CanvasTexture {

    const size = 128;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create glow texture.');
    }

    const center = size / 2;

    const gradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center
    );

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  // --------------------------------------------------
  // PRIVATE HELPER
  // --------------------------------------------------

  private getLayer(id: string): GlowLayer {

    const layer = this.layers.get(id);

    if (!layer) {
      throw new Error(`Glow layer not found: ${id}`);
    }

    return layer;
  }
}
