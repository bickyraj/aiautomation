
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

    // Create a separate material for the glow.
    const material = new THREE.PointsMaterial({
      color: options.color,
      size: options.size,
      transparent: true,
      opacity: THREE.MathUtils.clamp(options.opacity, 0, 1),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
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
    // Only dispose the material created here.
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
