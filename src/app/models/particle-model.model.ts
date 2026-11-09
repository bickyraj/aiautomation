
import { ParticleConfig } from './particle-config.model';

export class ParticleModel {

  private positions: Float32Array;

  private color: number;
  private particleSize: number;
  private opacity: number;

  constructor(config: ParticleConfig) {

    this.positions = config.positions.slice();

    this.color = config.color;
    this.particleSize = config.particleSize;
    this.opacity = config.opacity;
  }

  getPositions(): Float32Array {
    return this.positions;
  }

  setPositions(positions: Float32Array): void {

    if (positions.length !== this.positions.length) {
      throw new Error('Particle position count cannot change.');
    }

    // Update the existing buffer instead of replacing it.
    this.positions.set(positions);
  }

  getParticleCount(): number {
    return this.positions.length / 3;
  }

  getConfig(): ParticleConfig {
    return {
      positions: this.positions,
      color: this.color,
      particleSize: this.particleSize,
      opacity: this.opacity
    };
  }
}
