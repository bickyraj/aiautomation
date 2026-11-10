
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

  // Shared positions used by the rendered wireframe
  // and by particle sampling.
  private wireframePositions?: Float32Array;

  private edgeCumulativeLengths: number[] = [];
  private totalEdgeLength = 0;

  private wireframeEdgeCount = 0;

  // Car transformation
  private readonly carScale = 0.15;
  private readonly carRotation = THREE.MathUtils.degToRad(35);
  private readonly carTiltY = THREE.MathUtils.degToRad(25);

  // Visual settings
  private readonly surfaceOpacity = 0.03;
  private readonly glowOpacity = 0.3;
  private readonly coreOpacity = 0;

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
      !data ||
      data.vertices.length !== data.vertexCount * 3 ||
      data.faces.length !== data.faceCount ||
      data.edges.length !== data.edgeCount ||
      !data.vertices.every(Number.isFinite)
    ) {
      throw new Error('Invalid car geometry data.');
    }

    // Validate triangle indices.
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

    // Validate exported edge indices.
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

    // Three-quarter horizontal rotation.
    this.carGroup.rotation.z = this.carRotation;

    // Downward perspective tilt.
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
  // BUILD UNIQUE WIREFRAME EDGE POSITIONS
  // ----------------------------------------

  private buildWireframePositions(data: CarGeometryData): void {

    const positions: number[] = [];

    const uniqueEdges = new Set<string>();

    // Generate unique edges from every triangle.
    for (const face of data.faces) {

      const [a, b, c] = face;

      const triangleEdges = [
        [a, b],
        [b, c],
        [c, a]
      ];

      for (const [start, end] of triangleEdges) {

        const key =
          `${Math.min(start, end)}-${Math.max(start, end)}`;

        if (uniqueEdges.has(key)) {
          continue;
        }

        uniqueEdges.add(key);

        // Start vertex.
        positions.push(
          data.vertices[start * 3],
          data.vertices[start * 3 + 1],
          data.vertices[start * 3 + 2]
        );

        // End vertex.
        positions.push(
          data.vertices[end * 3],
          data.vertices[end * 3 + 1],
          data.vertices[end * 3 + 2]
        );
      }
    }

    this.wireframePositions = new Float32Array(positions);

    this.wireframeEdgeCount = this.wireframePositions.length / 6;

    this.calculateEdgeLengths();
  }

  // ----------------------------------------
  // CALCULATE EDGE LENGTHS
  // ----------------------------------------

  private calculateEdgeLengths(): void {

    if (!this.wireframePositions) return;

    this.edgeCumulativeLengths = [];

    this.totalEdgeLength = 0;

    for (
      let i = 0;
      i < this.wireframePositions.length;
      i += 6
    ) {

      const ax = this.wireframePositions[i];
      const ay = this.wireframePositions[i + 1];
      const az = this.wireframePositions[i + 2];

      const bx = this.wireframePositions[i + 3];
      const by = this.wireframePositions[i + 4];
      const bz = this.wireframePositions[i + 5];

      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;

      const length = Math.sqrt(
        dx * dx + dy * dy + dz * dz
      );

      this.totalEdgeLength += length;

      this.edgeCumulativeLengths.push(
        this.totalEdgeLength
      );
    }

    if (this.totalEdgeLength <= 0) {
      throw new Error('Car wireframe has no valid edge length.');
    }
  }

  // ----------------------------------------
  // CREATE PROGRESSIVE WIREFRAME
  // ----------------------------------------

  private createWireframe(data: CarGeometryData): void {

    this.buildWireframePositions(data);

    if (!this.wireframePositions) return;

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        this.wireframePositions,
        3
      )
    );

    // Start with no visible line segments.
    geometry.setDrawRange(0, 0);

    // OUTER BLUE GLOW.
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

    // BRIGHT POLYGON EDGES.
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
  // SAMPLE PARTICLES ALONG ACTUAL CAR EDGES
  // ----------------------------------------

  sampleEdgePositions(
    data: CarGeometryData,
    particleCount: number
  ): Float32Array {

    if (!this.carGroup || !this.wireframePositions) {
      throw new Error(
        'Create the car before sampling its edges.'
      );
    }

    if (
      !Number.isInteger(particleCount) ||
      particleCount <= 0
    ) {
      throw new Error(
        'Particle count must be a positive integer.'
      );
    }

    if (
      this.edgeCumulativeLengths.length !== this.wireframeEdgeCount ||
      this.totalEdgeLength <= 0
    ) {
      throw new Error('Car edge sampling data is invalid.');
    }

    this.carGroup.updateMatrixWorld(true);

    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {

      // Pick a random distance along the entire wireframe.
      const randomDistance =
        Math.random() * this.totalEdgeLength;

      // Find the edge containing that distance.
      let low = 0;
      let high = this.edgeCumulativeLengths.length - 1;

      while (low < high) {

        const mid = Math.floor((low + high) / 2);

        if (randomDistance <= this.edgeCumulativeLengths[mid]) {
          high = mid;
        } else {
          low = mid + 1;
        }
      }

      const edgeIndex = low;

      const previousLength =
        edgeIndex === 0
          ? 0
          : this.edgeCumulativeLengths[edgeIndex - 1];

      const edgeLength =
        this.edgeCumulativeLengths[edgeIndex] -
        previousLength;

      const edgeProgress = edgeLength > 0
        ? (randomDistance - previousLength) / edgeLength
        : 0;

      const offset = edgeIndex * 6;

      const ax = this.wireframePositions[offset];
      const ay = this.wireframePositions[offset + 1];
      const az = this.wireframePositions[offset + 2];

      const bx = this.wireframePositions[offset + 3];
      const by = this.wireframePositions[offset + 4];
      const bz = this.wireframePositions[offset + 5];

      // Interpolate along the selected edge.
      const point = new THREE.Vector3(
        THREE.MathUtils.lerp(ax, bx, edgeProgress),
        THREE.MathUtils.lerp(ay, by, edgeProgress),
        THREE.MathUtils.lerp(az, bz, edgeProgress)
      );

      // Apply the actual car scale and rotation.
      this.carGroup.localToWorld(point);

      const targetOffset = i * 3;

      positions[targetOffset] = point.x;
      positions[targetOffset + 1] = point.y;
      positions[targetOffset + 2] = point.z;
    }

    return positions;
  }

  // ----------------------------------------
  // PROGRESSIVELY REVEAL WIREFRAME
  // ----------------------------------------

  setWireframeProgress(progress: number): void {

    const value = THREE.MathUtils.clamp(progress, 0, 1);

    if (!this.wireframeGlow || !this.wireframeCore) {
      return;
    }

    // Every edge uses two vertices.
    // Reveal a growing number of complete segments.
    const visibleEdgeCount = Math.floor(
      this.wireframeEdgeCount * value
    );

    const visibleVertexCount = visibleEdgeCount * 2;

    this.wireframeGlow.geometry.setDrawRange(
      0,
      visibleVertexCount
    );

    this.wireframeCore.geometry.setDrawRange(
      0,
      visibleVertexCount
    );
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

    // Dispose surface geometry and material.
    this.surface?.geometry.dispose();

    (
      this.surface?.material as
        THREE.Material | undefined
    )?.dispose();

    // Shared wireframe geometry: dispose only once.
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

    this.wireframePositions = undefined;
    this.edgeCumulativeLengths = [];
    this.totalEdgeLength = 0;
    this.wireframeEdgeCount = 0;

    this.carGroup = undefined;
  }
}
