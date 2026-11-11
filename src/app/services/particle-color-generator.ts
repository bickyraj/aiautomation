
import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class ParticleColorGenerator {

  generateGalaxyColors(
    positions: Float32Array
  ): Float32Array {

    const particleCount = positions.length / 3;
    const colors = new Float32Array(positions.length);

    const palette = [
      new THREE.Color('#171044'), // Midnight purple
      new THREE.Color('#852cff'), // Deep violet
      new THREE.Color('#245BCE'), // Electric blue
      new THREE.Color('#7655FF'), // Bright violet
      new THREE.Color('#D044C8'), // Magenta
      new THREE.Color('#FF79C8')  // Pink highlights
    ];

    for (let i = 0; i < particleCount; i++) {

      const index = i * 3;

      const x = positions[index];
      const y = positions[index + 1];
      const z = positions[index + 2];

      // Normalize the particle's vertical position.
      const vertical = THREE.MathUtils.clamp(
        (z + 5) / 10,
        0,
        1
      );

      // Add spatial variation using the particle's direction.
      const angle = Math.atan2(y, x);

      const variation =
        (Math.sin(angle * 3 + vertical * 5) + 1) * 0.5;

      // Combine vertical position and spatial variation.
      const colorPosition = THREE.MathUtils.clamp(
        vertical * 0.65 + variation * 0.35,
        0,
        1
      );

      // Map the value across the palette.
      const scaled = colorPosition * (palette.length - 1);

      const paletteIndex = Math.min(
        Math.floor(scaled),
        palette.length - 2
      );

      const blend = scaled - paletteIndex;

      const color = palette[paletteIndex].clone().lerp(
        palette[paletteIndex + 1],
        blend
      );

      colors[index] = color.r;
      colors[index + 1] = color.g;
      colors[index + 2] = color.b;
    }

    return colors;
  }

  generateWolfColors(positions: Float32Array): Float32Array {
    const particleCount = positions.length / 3;
    const colors = new Float32Array(positions.length);

    const palette = [
      new THREE.Color('#082B66'), // Midnight blue
      new THREE.Color('#104C9E'), // Royal blue
      new THREE.Color('#176FCB'), // Sapphire blue
      new THREE.Color('#168FE8'), // Electric blue
      new THREE.Color('#36BCEB')  // Cyan highlights
    ];

    for (let i = 0; i < particleCount; i++) {
      const index = i * 3;

      const x = positions[index];
      const y = positions[index + 1];
      const z = positions[index + 2];

      const angle = Math.atan2(y, x);

      const vertical = THREE.MathUtils.clamp(
        (z + 5) / 10,
        0,
        1
      );

      const variation =
        (Math.sin(angle * 3 + vertical * 4) + 1) * 0.5;

      const colorPosition = THREE.MathUtils.clamp(
        vertical * 0.65 + variation * 0.35,
        0,
        1
      );

      const scaled = colorPosition * (palette.length - 1);

      const paletteIndex = Math.min(
        Math.floor(scaled),
        palette.length - 2
      );

      const blend = scaled - paletteIndex;

      const color = palette[paletteIndex].clone().lerp(
        palette[paletteIndex + 1],
        blend
      );

      colors[index] = color.r;
      colors[index + 1] = color.g;
      colors[index + 2] = color.b;
    }

    return colors;
  }
}
