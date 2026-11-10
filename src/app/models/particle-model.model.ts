
import { ParticleConfig } from './particle-config.model';

export class ParticleModel {

  private positions: Float32Array;
  private colors?: Float32Array;

  private color: number;
  private particleSize: number;
  private opacity: number;

  constructor(config: ParticleConfig) {

    this.positions = config.positions.slice();

    this.color = config.color;
    this.particleSize = config.particleSize;
    this.opacity = config.opacity;

    // Create a color buffer only when supplied.
    if (config.colors) {

      if (config.colors.length !== this.positions.length) {
        throw new Error('Particle colors must match the position count.');
      }

      this.colors = config.colors.slice();
    }
  }

  getPositions(): Float32Array {
    return this.positions;
  }

  setPositions(positions: Float32Array): void {

    if (positions.length !== this.positions.length) {
      throw new Error('Particle position count cannot change.');
    }

    this.positions.set(positions);
  }

  getColors(): Float32Array | undefined {
    return this.colors;
  }

  setColors(colors: Float32Array): void {

    if (!this.colors) {
      throw new Error('This particle system does not use vertex colors.');
    }

    if (colors.length !== this.colors.length) {
      throw new Error('Particle color count cannot change.');
    }

    this.colors.set(colors);
  }

  getParticleCount(): number {
    return this.positions.length / 3;
  }

  getConfig(): ParticleConfig {
    return {
      positions: this.positions,
      color: this.color,
      particleSize: this.particleSize,
      opacity: this.opacity,
      colors: this.colors
    };
  }
}
