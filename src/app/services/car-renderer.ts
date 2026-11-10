
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
  private surfacePolygons?: THREE.LineSegments;
  private wireframeGlow?: THREE.LineSegments;
  private wireframeCore?: THREE.LineSegments;
  private wireframeOuterGlow?: THREE.LineSegments;
  private wireframeDots?: THREE.Points;

  private wireframePositions?: Float32Array;
  private randomizedPositions?: Float32Array;
  private animatedWireframePositions?: Float32Array;

  private edgeCumulativeLengths: number[] = [];
  private totalEdgeLength = 0;
  private wireframeEdgeCount = 0;

  private readonly carScale = 0.17;
  private readonly carRotation = THREE.MathUtils.degToRad(35);
  private readonly carTiltY = THREE.MathUtils.degToRad(25);

  // Surface and polygon appearance.
  private readonly surfaceOpacity = 0.0;
  private readonly polygonOpacity = 0.2;

  // Neon wireframe appearance.
  private readonly glowOpacity = 0.0;
  private readonly coreOpacity = 0.1;
  private readonly outerGlowOpacity = 0.2;

  // Dots remain visible during the burst, then fade away.
  private readonly dotOpacity = 0.2;
  private readonly dotSize = 0.1;

  private readonly carColor = 0x00A3FF;
  private readonly coreColor = 0x66CCFF;

  private readonly networkScatterDistance = 4.5;
  private currentProgress = 0;

  update(deltaTime: number): void {
    if (!this.carGroup) return;

    const rotationSpeed = THREE.MathUtils.degToRad(30);

    this.carGroup.rotation.z += rotationSpeed * deltaTime;
  }

  async load(url: string): Promise<CarGeometryData> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load car geometry: ${response.status}`);
    }

    const data: CarGeometryData = await response.json();

    if (
      !data ||
      !Array.isArray(data.vertices) ||
      !Array.isArray(data.faces) ||
      !Array.isArray(data.edges) ||
      data.vertices.length !== data.vertexCount * 3 ||
      data.faces.length !== data.faceCount ||
      data.edges.length !== data.edgeCount ||
      !data.vertices.every(Number.isFinite)
    ) {
      throw new Error('Invalid car geometry data.');
    }

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

  create(scene: THREE.Scene, data: CarGeometryData): void {
    this.dispose();

    this.carGroup = new THREE.Group();
    this.carGroup.scale.setScalar(this.carScale);
    this.carGroup.rotation.z = this.carRotation;
    this.carGroup.rotation.y = this.carTiltY;
    this.carGroup.position.set(0, 0, 1);

    this.createSurface(data);
    this.createWireframe(data);

    scene.add(this.carGroup);
    this.carGroup.updateMatrixWorld(true);
  }

  private createSurface(data: CarGeometryData): void {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(data.vertices, 3)
    );

    geometry.setIndex(data.faces.flat());
    geometry.computeVertexNormals();

    const surfaceMaterial = new THREE.MeshBasicMaterial({
      color: this.carColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    });

    this.surface = new THREE.Mesh(geometry, surfaceMaterial);
    this.carGroup?.add(this.surface);

    // Draw every triangle edge over the translucent filled surface.
    const polygonGeometry = new THREE.WireframeGeometry(geometry);

    const polygonMaterial = new THREE.LineBasicMaterial({
      color: this.coreColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });

    this.surfacePolygons = new THREE.LineSegments(
      polygonGeometry,
      polygonMaterial
    );

    this.surfacePolygons.frustumCulled = false;
    this.carGroup?.add(this.surfacePolygons);
  }

  private buildWireframePositions(data: CarGeometryData): void {
    const positions: number[] = [];
    const burstDensity = 0.001;

    const burstEdges: number[][] = [];
    const remainingEdges: number[][] = [];

    data.edges.forEach((edge, index) => {
      if (index % Math.round(1 / burstDensity) === 0) {
        burstEdges.push(edge);
      } else {
        remainingEdges.push(edge);
      }
    });

    const orderedEdges = [...burstEdges, ...remainingEdges];

    for (const [start, end] of orderedEdges) {
      positions.push(
        data.vertices[start * 3],
        data.vertices[start * 3 + 1],
        data.vertices[start * 3 + 2],
        data.vertices[end * 3],
        data.vertices[end * 3 + 1],
        data.vertices[end * 3 + 2]
      );
    }

    this.wireframePositions = new Float32Array(positions);
    this.wireframeEdgeCount = this.wireframePositions.length / 6;

    this.randomizedPositions = this.createRandomizedPositions();
    this.animatedWireframePositions = this.randomizedPositions.slice();

    this.calculateEdgeLengths();
  }

  private createRandomizedPositions(): Float32Array {
    if (!this.wireframePositions) {
      throw new Error('Wireframe positions have not been created.');
    }

    const source = this.wireframePositions;
    const randomized = new Float32Array(source.length);
    const vertexCount = source.length / 3;
    const center = new THREE.Vector3();

    for (let i = 0; i < source.length; i += 3) {
      center.x += source[i];
      center.y += source[i + 1];
      center.z += source[i + 2];
    }

    center.divideScalar(vertexCount);

    // Reuse the same displacement for matching endpoints.
    const displacedVertices = new Map<string, THREE.Vector3>();

    for (let i = 0; i < source.length; i += 3) {
      const x = source[i];
      const y = source[i + 1];
      const z = source[i + 2];

      const key = `${x.toFixed(5)}_${y.toFixed(5)}_${z.toFixed(5)}`;

      let displaced = displacedVertices.get(key);

      if (!displaced) {
        const original = new THREE.Vector3(x, y, z);
        const outward = original.clone().sub(center);

        if (outward.lengthSq() < 0.000001) {
          outward.set(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
          );
        }

        outward.normalize();

        const impulse = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        ).normalize();

        const direction = outward
          .multiplyScalar(0.8)
          .add(impulse.multiplyScalar(1.6))
          .normalize();

        const distance =
          this.networkScatterDistance * (0.65 + Math.random() * 1.9);

        displaced = original.add(direction.multiplyScalar(distance));
        displacedVertices.set(key, displaced);
      }

      randomized[i] = displaced.x;
      randomized[i + 1] = displaced.y;
      randomized[i + 2] = displaced.z;
    }

    return randomized;
  }

  private calculateEdgeLengths(): void {
    if (!this.wireframePositions) return;

    this.edgeCumulativeLengths = [];
    this.totalEdgeLength = 0;

    for (let i = 0; i < this.wireframePositions.length; i += 6) {
      const ax = this.wireframePositions[i];
      const ay = this.wireframePositions[i + 1];
      const az = this.wireframePositions[i + 2];

      const bx = this.wireframePositions[i + 3];
      const by = this.wireframePositions[i + 4];
      const bz = this.wireframePositions[i + 5];

      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;

      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

      this.totalEdgeLength += length;
      this.edgeCumulativeLengths.push(this.totalEdgeLength);
    }

    if (this.totalEdgeLength <= 0) {
      throw new Error('Car wireframe has no valid edge length.');
    }
  }

  private createWireframe(data: CarGeometryData): void {
    this.buildWireframePositions(data);

    if (!this.animatedWireframePositions) return;

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.animatedWireframePositions, 3)
    );

    geometry.setDrawRange(0, 0);

    const glowMaterial = new THREE.LineBasicMaterial({
      color: this.carColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });

    this.wireframeGlow = new THREE.LineSegments(geometry, glowMaterial);

    // A slightly enlarged layer creates a wider neon halo.
    const outerGlowMaterial = new THREE.LineBasicMaterial({
      color: this.carColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });

    this.wireframeOuterGlow = new THREE.LineSegments(
      geometry,
      outerGlowMaterial
    );

    this.wireframeOuterGlow.scale.setScalar(1.015);

    const coreMaterial = new THREE.LineBasicMaterial({
      color: this.coreColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });

    this.wireframeCore = new THREE.LineSegments(geometry, coreMaterial);

    const dotMaterial = new THREE.PointsMaterial({
      color: this.carColor,
      size: this.dotSize,
      transparent: true,
      opacity: this.dotOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      map: this.createDotTexture(),
      alphaTest: 0.01,
      toneMapped: false
    });

    this.wireframeDots = new THREE.Points(geometry, dotMaterial);

    this.wireframeGlow.frustumCulled = false;
    this.wireframeCore.frustumCulled = false;
    this.wireframeOuterGlow.frustumCulled = false;
    this.wireframeDots.frustumCulled = false;

    this.carGroup?.add(this.wireframeDots);
    this.carGroup?.add(this.wireframeOuterGlow);
    this.carGroup?.add(this.wireframeGlow);
    this.carGroup?.add(this.wireframeCore);
  }

  private createDotTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create car particle texture.');
    }

    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  sampleEdgePositions(
    _data: CarGeometryData,
    particleCount: number
  ): Float32Array {
    if (!this.carGroup || !this.wireframePositions) {
      throw new Error('Create the car before sampling its edges.');
    }

    if (!Number.isInteger(particleCount) || particleCount <= 0) {
      throw new Error('Particle count must be a positive integer.');
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
      const randomDistance = Math.random() * this.totalEdgeLength;

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
        edgeIndex === 0 ? 0 : this.edgeCumulativeLengths[edgeIndex - 1];

      const edgeLength =
        this.edgeCumulativeLengths[edgeIndex] - previousLength;

      const edgeProgress =
        edgeLength > 0
          ? (randomDistance - previousLength) / edgeLength
          : 0;

      const offset = edgeIndex * 6;

      const point = new THREE.Vector3(
        THREE.MathUtils.lerp(
          this.wireframePositions[offset],
          this.wireframePositions[offset + 3],
          edgeProgress
        ),
        THREE.MathUtils.lerp(
          this.wireframePositions[offset + 1],
          this.wireframePositions[offset + 4],
          edgeProgress
        ),
        THREE.MathUtils.lerp(
          this.wireframePositions[offset + 2],
          this.wireframePositions[offset + 5],
          edgeProgress
        )
      );

      this.carGroup.localToWorld(point);

      const targetOffset = i * 3;

      positions[targetOffset] = point.x;
      positions[targetOffset + 1] = point.y;
      positions[targetOffset + 2] = point.z;
    }

    return positions;
  }

  setWireframeProgress(progress: number): void {
    const value = THREE.MathUtils.clamp(progress, 0, 1);
    this.currentProgress = value;

    if (
      !this.wireframePositions ||
      !this.randomizedPositions ||
      !this.animatedWireframePositions ||
      !this.wireframeGlow ||
      !this.wireframeCore ||
      !this.wireframeOuterGlow ||
      !this.wireframeDots
    ) {
      return;
    }

    // Keep the particles scattered for the first 65%.
    // Reconstruct the car during the remaining 35%.
    const eased = THREE.MathUtils.smoothstep(value, 0.65, 1);

    const burstEdgeCount = Math.ceil(this.wireframeEdgeCount * 0.001);

    const visibleEdgeCount = Math.floor(
      THREE.MathUtils.lerp(
        burstEdgeCount,
        this.wireframeEdgeCount,
        eased
      )
    );

    const drawCount = visibleEdgeCount * 2;

    this.wireframeGlow.geometry.setDrawRange(0, drawCount);
    this.wireframeCore.geometry.setDrawRange(0, drawCount);
    this.wireframeOuterGlow.geometry.setDrawRange(0, drawCount);
    this.wireframeDots.geometry.setDrawRange(0, drawCount);

    for (let i = 0; i < this.wireframePositions.length; i++) {
      this.animatedWireframePositions[i] = THREE.MathUtils.lerp(
        this.randomizedPositions[i],
        this.wireframePositions[i],
        eased
      );
    }

    const positionAttribute = this.wireframeGlow.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;

    positionAttribute.needsUpdate = true;

    // Dots remain visible longer, then fade as the neon lines emerge.
    const lineReveal = THREE.MathUtils.smoothstep(value, 0.72, 0.98);
    const dotFade = 1 - THREE.MathUtils.smoothstep(value, 0.62, 0.88);

    const glowMaterial = this.wireframeGlow.material as THREE.LineBasicMaterial;
    const coreMaterial = this.wireframeCore.material as THREE.LineBasicMaterial;
    const outerGlowMaterial =
      this.wireframeOuterGlow.material as THREE.LineBasicMaterial;
    const dotMaterial = this.wireframeDots.material as THREE.PointsMaterial;

    glowMaterial.opacity = this.glowOpacity * lineReveal;
    coreMaterial.opacity = this.coreOpacity * lineReveal;
    outerGlowMaterial.opacity = this.outerGlowOpacity * lineReveal;
    dotMaterial.opacity = this.dotOpacity * dotFade;
  }

  setVisible(visible: boolean): void {
    if (this.carGroup) {
      this.carGroup.visible = visible;
    }
  }

  setOpacity(value: number): void {
    const opacity = THREE.MathUtils.clamp(value, 0, 1);

    const lineReveal = THREE.MathUtils.smoothstep(
      this.currentProgress,
      0.72,
      0.98
    );

    const dotFade =
      1 - THREE.MathUtils.smoothstep(this.currentProgress, 0.62, 0.88);

    // Filled surface and triangle edges appear last.
    const surfaceReveal = THREE.MathUtils.smoothstep(
      this.currentProgress,
      0.86,
      1
    );

    if (this.surface) {
      const material = this.surface.material as THREE.MeshBasicMaterial;
      material.opacity = this.surfaceOpacity * surfaceReveal * opacity;
    }

    if (this.surfacePolygons) {
      const material = this.surfacePolygons.material as THREE.LineBasicMaterial;
      material.opacity = this.polygonOpacity * surfaceReveal * opacity;
    }

    if (this.wireframeGlow) {
      const material = this.wireframeGlow.material as THREE.LineBasicMaterial;
      material.opacity = this.glowOpacity * lineReveal * opacity;
    }

    if (this.wireframeCore) {
      const material = this.wireframeCore.material as THREE.LineBasicMaterial;
      material.opacity = this.coreOpacity * lineReveal * opacity;
    }

    if (this.wireframeOuterGlow) {
      const material =
        this.wireframeOuterGlow.material as THREE.LineBasicMaterial;

      material.opacity = this.outerGlowOpacity * lineReveal * opacity;
    }

    if (this.wireframeDots) {
      const material = this.wireframeDots.material as THREE.PointsMaterial;
      material.opacity = this.dotOpacity * dotFade * opacity;
    }
  }

  setRotationZ(degrees: number): void {
    if (this.carGroup) {
      this.carGroup.rotation.z = THREE.MathUtils.degToRad(degrees);
      this.carGroup.updateMatrixWorld(true);
    }
  }

  setScale(scale: number): void {
    if (this.carGroup) {
      this.carGroup.scale.setScalar(scale);
      this.carGroup.updateMatrixWorld(true);
    }
  }

  dispose(): void {
    this.carGroup?.removeFromParent();

    this.surface?.geometry.dispose();
    (this.surface?.material as THREE.Material | undefined)?.dispose();

    this.surfacePolygons?.geometry.dispose();
    (this.surfacePolygons?.material as THREE.Material | undefined)?.dispose();

    const sharedGeometry = this.wireframeGlow?.geometry;
    sharedGeometry?.dispose();

    (this.wireframeGlow?.material as THREE.Material | undefined)?.dispose();
    (this.wireframeCore?.material as THREE.Material | undefined)?.dispose();
    (this.wireframeOuterGlow?.material as THREE.Material | undefined)?.dispose();

    const dotMaterial = this.wireframeDots?.material as
      | THREE.PointsMaterial
      | undefined;

    dotMaterial?.map?.dispose();
    dotMaterial?.dispose();

    this.surface = undefined;
    this.surfacePolygons = undefined;
    this.wireframeGlow = undefined;
    this.wireframeCore = undefined;
    this.wireframeOuterGlow = undefined;
    this.wireframeDots = undefined;

    this.wireframePositions = undefined;
    this.randomizedPositions = undefined;
    this.animatedWireframePositions = undefined;

    this.edgeCumulativeLengths = [];
    this.totalEdgeLength = 0;
    this.wireframeEdgeCount = 0;
    this.currentProgress = 0;

    this.carGroup = undefined;
  }
}
