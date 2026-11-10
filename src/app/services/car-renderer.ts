
import * as THREE from 'three';

interface CarGeometryData {
  vertexCount: number;
  faceCount: number;
  edgeCount: number;
  vertices: number[];
  faces: number[][];
  edges: number[][];
}

export class CarRenderer {
  private carGroup?: THREE.Group;

  private surface?: THREE.Mesh;
  private wireframeGlow?: THREE.LineSegments;
  private wireframeCore?: THREE.LineSegments;

  // Car transformation
  private readonly carScale = 0.15;
  private readonly carRotation = THREE.MathUtils.degToRad(35);
  private readonly carTiltY = THREE.MathUtils.degToRad(25);

  // Visual settings
  private readonly surfaceOpacity = 0.08;
  private readonly glowOpacity = 0.2;
  private readonly coreOpacity = 0.3;

  private readonly carColor = 0x00A3FF;
  private readonly coreColor = 0x66CCFF;

  // ----------------------------------------
  // LOAD CAR GEOMETRY
  // ----------------------------------------

  async load(url: string): Promise<CarGeometryData> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to load car geometry: ${response.status}`
      );
    }

    const data: CarGeometryData = await response.json();

    if (
      data.vertices.length !== data.vertexCount * 3 ||
      data.faces.length !== data.faceCount ||
      data.edges.length !== data.edgeCount
    ) {
      throw new Error('Invalid car geometry data.');
    }

    // Validate triangle indices
    for (const face of data.faces) {
      if (
        face.length !== 3 ||
        face.some(index =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= data.vertexCount
        )
      ) {
        throw new Error('Invalid triangle indices.');
      }
    }

    // Validate exported edge indices
    for (const edge of data.edges) {
      if (
        edge.length !== 2 ||
        edge.some(index =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= data.vertexCount
        )
      ) {
        throw new Error('Invalid edge indices.');
      }
    }

    return data;
  }

  // ----------------------------------------
  // CREATE CAR
  // ----------------------------------------

  create(scene: THREE.Scene, data: CarGeometryData): void {
    this.dispose();

    this.carGroup = new THREE.Group();

    this.carGroup.scale.setScalar(this.carScale);

    // Three-quarter horizontal rotation
    this.carGroup.rotation.z = this.carRotation;

    // Downward perspective tilt
    this.carGroup.rotation.y = this.carTiltY;

    this.createSurface(data);
    this.createWireframe(data);

    scene.add(this.carGroup);

    this.carGroup.updateMatrixWorld(true);
  }

  // ----------------------------------------
  // CREATE TRANSPARENT CAR SURFACE
  // ----------------------------------------

  private createSurface(data: CarGeometryData): void {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(data.vertices, 3)
    );

    geometry.setIndex(data.faces.flat());

    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: this.carColor,
      transparent: true,
      opacity: this.surfaceOpacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.surface = new THREE.Mesh(geometry, material);

    this.carGroup?.add(this.surface);
  }

  // ----------------------------------------
  // CREATE FULL TRIANGULAR WIREFRAME
  // ----------------------------------------

  private createWireframe(data: CarGeometryData): void {
    const positions: number[] = [];
    const uniqueEdges = new Set<string>();

    // Generate edges from every triangle
    for (const face of data.faces) {
      const [a, b, c] = face;

      const triangleEdges = [
        [a, b],
        [b, c],
        [c, a]
      ];

      for (const [start, end] of triangleEdges) {
        // Avoid duplicate edges
        const key =
          `${Math.min(start, end)}-${Math.max(start, end)}`;

        if (uniqueEdges.has(key)) {
          continue;
        }

        uniqueEdges.add(key);

        // Starting vertex
        positions.push(
          data.vertices[start * 3],
          data.vertices[start * 3 + 1],
          data.vertices[start * 3 + 2]
        );

        // Ending vertex
        positions.push(
          data.vertices[end * 3],
          data.vertices[end * 3 + 1],
          data.vertices[end * 3 + 2]
        );
      }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );

    // OUTER BLUE GLOW
    const glowMaterial = new THREE.LineBasicMaterial({
      color: this.carColor,
      transparent: true,
      opacity: this.glowOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.wireframeGlow = new THREE.LineSegments(
      geometry,
      glowMaterial
    );

    // BRIGHT POLYGON EDGES
    const coreMaterial = new THREE.LineBasicMaterial({
      color: this.coreColor,
      transparent: true,
      opacity: this.coreOpacity,
      depthWrite: false
    });

    this.wireframeCore = new THREE.LineSegments(
      geometry,
      coreMaterial
    );

    this.carGroup?.add(this.wireframeGlow);
    this.carGroup?.add(this.wireframeCore);
  }

  // ----------------------------------------
  // SAMPLE PARTICLES ACROSS CAR SURFACE
  // ----------------------------------------

  sampleSurfacePositions(
    data: CarGeometryData,
    particleCount: number
  ): Float32Array {
    if (!this.carGroup) {
      throw new Error('Create the car before sampling its surface.');
    }

    if (!Number.isInteger(particleCount) || particleCount <= 0) {
      throw new Error('Particle count must be a positive integer.');
    }

    const cumulativeAreas: number[] = [];
    let totalArea = 0;

    // Calculate each triangle's surface area
    for (const face of data.faces) {
      const [a, b, c] = face;

      const ax = data.vertices[a * 3];
      const ay = data.vertices[a * 3 + 1];
      const az = data.vertices[a * 3 + 2];

      const bx = data.vertices[b * 3];
      const by = data.vertices[b * 3 + 1];
      const bz = data.vertices[b * 3 + 2];

      const cx = data.vertices[c * 3];
      const cy = data.vertices[c * 3 + 1];
      const cz = data.vertices[c * 3 + 2];

      const ab = new THREE.Vector3(
        bx - ax,
        by - ay,
        bz - az
      );

      const ac = new THREE.Vector3(
        cx - ax,
        cy - ay,
        cz - az
      );

      const area = ab.cross(ac).length() * 0.5;

      totalArea += area;
      cumulativeAreas.push(totalArea);
    }

    if (totalArea <= 0) {
      throw new Error('Car geometry has no valid surface area.');
    }

    // Ensure world transformation is up to date
    this.carGroup.updateMatrixWorld(true);

    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Choose triangle proportionally to its area
      const randomArea = Math.random() * totalArea;

      let low = 0;
      let high = cumulativeAreas.length - 1;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);

        if (randomArea <= cumulativeAreas[mid]) {
          high = mid;
        } else {
          low = mid + 1;
        }
      }

      const [a, b, c] = data.faces[low];

      const ax = data.vertices[a * 3];
      const ay = data.vertices[a * 3 + 1];
      const az = data.vertices[a * 3 + 2];

      const bx = data.vertices[b * 3];
      const by = data.vertices[b * 3 + 1];
      const bz = data.vertices[b * 3 + 2];

      const cx = data.vertices[c * 3];
      const cy = data.vertices[c * 3 + 1];
      const cz = data.vertices[c * 3 + 2];

      // Uniform random point inside the triangle
      const r1 = Math.sqrt(Math.random());
      const r2 = Math.random();

      const u = 1 - r1;
      const v = r1 * (1 - r2);
      const w = r1 * r2;

      const point = new THREE.Vector3(
        u * ax + v * bx + w * cx,
        u * ay + v * by + w * cy,
        u * az + v * bz + w * cz
      );

      // Apply the visible car's scale and rotation
      this.carGroup.localToWorld(point);

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }

    return positions;
  }

  // ----------------------------------------
  // CONTROL VISIBILITY
  // ----------------------------------------

  setVisible(visible: boolean): void {
    if (this.carGroup) {
      this.carGroup.visible = visible;
    }
  }

  // ----------------------------------------
  // CONTROL OPACITY
  // ----------------------------------------

  setOpacity(value: number): void {
    const opacity = THREE.MathUtils.clamp(value, 0, 1);

    if (this.surface) {
      const material =
        this.surface.material as THREE.MeshBasicMaterial;

      material.opacity = this.surfaceOpacity * opacity;
    }

    if (this.wireframeGlow) {
      const material =
        this.wireframeGlow.material as THREE.LineBasicMaterial;

      material.opacity = this.glowOpacity * opacity;
    }

    if (this.wireframeCore) {
      const material =
        this.wireframeCore.material as THREE.LineBasicMaterial;

      material.opacity = this.coreOpacity * opacity;
    }
  }

  // ----------------------------------------
  // ADJUST ROTATION
  // ----------------------------------------

  setRotationZ(degrees: number): void {
    if (this.carGroup) {
      this.carGroup.rotation.z =
        THREE.MathUtils.degToRad(degrees);

      this.carGroup.updateMatrixWorld(true);
    }
  }

  setScale(scale: number): void {
    if (this.carGroup) {
      this.carGroup.scale.setScalar(scale);

      this.carGroup.updateMatrixWorld(true);
    }
  }

  // ----------------------------------------
  // CLEANUP
  // ----------------------------------------

  dispose(): void {
    if (!this.carGroup) return;

    this.carGroup.removeFromParent();

    // Dispose surface geometry and material
    this.surface?.geometry.dispose();

    (
      this.surface?.material as
        THREE.Material | undefined
    )?.dispose();

    // Shared wireframe geometry: dispose only once
    this.wireframeGlow?.geometry.dispose();

    (
      this.wireframeGlow?.material as
        THREE.Material | undefined
    )?.dispose();

    (
      this.wireframeCore?.material as
        THREE.Material | undefined
    )?.dispose();

    this.surface = undefined;
    this.wireframeGlow = undefined;
    this.wireframeCore = undefined;
    this.carGroup = undefined;
  }
}
