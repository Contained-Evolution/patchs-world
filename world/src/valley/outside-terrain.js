import * as THREE from 'three';
import { makeTexture } from './surface-textures.js';
import { WORLD, STEP, COLS, ROWS, heights, terrainHeight } from './heightfield.js';
import { LAKE, waterEdgeDistance } from './valley-water-layout.js';
export { terrainHeight } from './heightfield.js';

const SURFACES = ['grass', 'gravel', 'sand', 'rock', 'snow'];
function makeSurfaceMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 1840;
  const context = canvas.getContext('2d');
  const patterns = Object.fromEntries(SURFACES.map(type => {
    const source = makeTexture(type);
    const pattern = context.createPattern(source.image, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(.55));
    source.dispose();
    return [type, pattern];
  }));
  const tileWidth = canvas.width / (COLS - 1), tileHeight = canvas.height / (ROWS - 1);
  for(let row=0;row<ROWS;row++) for(let column=0;column<COLS;column++) {
    const x=WORLD.x0+column*STEP,z=WORLD.z0+row*STEP,h=terrainHeight(x,z);
    const slope=Math.hypot(terrainHeight(x+1,z)-terrainHeight(x-1,z),terrainHeight(x,z+1)-terrainHeight(x,z-1))/2;
    // Mix surfaces continuously so the snow follows the terrain instead of
    // following abrupt elevation contours.
    const variation = 4 * Math.sin(x * .045) + 3 * Math.sin(z * .052) +
      2 * Math.sin((x + z) * .11);
    const snow = THREE.MathUtils.smoothstep(h + variation, 100, 135) *
      (1 - .82 * THREE.MathUtils.smoothstep(slope, .45, 1.25));
    const rock = THREE.MathUtils.smoothstep(slope, .38, 1.05) * (1 - snow);
    const px = column * tileWidth, py = (ROWS - 1 - row) * tileHeight;
    const width = Math.ceil(tileWidth) + 1, height = Math.ceil(tileHeight) + 1;
    context.globalAlpha = 1;
    const shore = Math.min(x - WORLD.x0, WORLD.x1 - x, z - WORLD.z0, WORLD.z1 - z);
    context.fillStyle = waterEdgeDistance(x, z) < 12 ? patterns.gravel : shore < 20 ? patterns.sand : patterns.grass;
    context.fillRect(px, py, width, height);
    context.globalAlpha = rock;
    context.fillStyle = patterns.rock;
    context.fillRect(px, py, width, height);
    context.globalAlpha = snow;
    context.fillStyle = patterns.snow;
    context.fillRect(px, py, width, height);
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createValleyGeometry() {
  const positions = new Float32Array(COLS * ROWS * 3);
  const uvs = new Float32Array(COLS * ROWS * 2);
  const indices = [];
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLS; column++) {
    const index = row * COLS + column;
    positions.set([WORLD.x0 + column * STEP, heights[index], WORLD.z0 + row * STEP], index * 3);
    uvs.set([column / (COLS - 1), row / (ROWS - 1)], index * 2);
    if (row && column) {
      const a = index - COLS - 1, b = index - COLS, c = index - 1;
      indices.push(a, c, b, b, c, index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createOutsideTerrain(scene) {
  const geometry = createValleyGeometry();
  // ambientCG Ground013, CC0: https://ambientcg.com/a/Ground013
  // A small repeating detail map keeps nearby grass sharp without enlarging the
  // world-sized surface map or allocating extra terrain geometry.
  const grassDetail = new THREE.TextureLoader().load('/assets/valley/meadow-grass.jpg', () => {
    detailReady.value = 1;
  }, undefined, error => console.error('Grass detail failed to load', error));
  grassDetail.wrapS = grassDetail.wrapT = THREE.RepeatWrapping;
  grassDetail.colorSpace = THREE.SRGBColorSpace;
  grassDetail.anisotropy = 4;
  // Poly Haven rock_boulder_dry, CC0: https://polyhaven.com/a/rock_boulder_dry
  const rockReady = { value: 0 };
  const rockDetail = new THREE.TextureLoader().load('/assets/valley/rock-boulder-dry.jpg',
    () => { rockReady.value = 1; }, undefined,
    error => console.error('Rock detail failed to load', error));
  rockDetail.wrapS = rockDetail.wrapT = THREE.RepeatWrapping;
  rockDetail.colorSpace = THREE.SRGBColorSpace;
  rockDetail.anisotropy = 4;
  // Poly Haven gravel_floor_02, CC0: https://polyhaven.com/a/gravel_floor_02
  const gravelReady = { value: 0 };
  const gravelDetail = new THREE.TextureLoader().load('/assets/valley/gravel-floor.jpg',
    () => { gravelReady.value = 1; });
  gravelDetail.wrapS = gravelDetail.wrapT = THREE.RepeatWrapping;
  gravelDetail.colorSpace = THREE.SRGBColorSpace; gravelDetail.anisotropy = 4;
  const detailReady = { value: 0 };
  const material = new THREE.MeshStandardMaterial({
    map: makeSurfaceMap(), roughness: 1, side: THREE.DoubleSide,
  });
  material.addEventListener('dispose', () => { grassDetail.dispose(); rockDetail.dispose(); gravelDetail.dispose(); });
  material.onBeforeCompile = shader => {
    shader.uniforms.grassDetail = { value: grassDetail };
    shader.uniforms.grassDetailReady = detailReady;
    shader.uniforms.rockDetail = { value: rockDetail };
    shader.uniforms.rockDetailReady = rockReady;
    shader.uniforms.gravelDetail = { value: gravelDetail };
    shader.uniforms.gravelDetailReady = gravelReady;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 valleyPosition;\nvarying vec3 valleyNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvalleyPosition = position;\nvalleyNormal = normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform sampler2D grassDetail;\nuniform float grassDetailReady;\nuniform sampler2D rockDetail;\nuniform float rockDetailReady;\nuniform sampler2D gravelDetail;\nuniform float gravelDetailReady;\nvarying vec3 valleyPosition;\nvarying vec3 valleyNormal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>
       float grassMask = smoothstep(0.01, 0.07, diffuseColor.g - diffuseColor.r);
       vec3 detail = texture2D(grassDetail, vMapUv * vec2(160.0, 180.0)).rgb;
       diffuseColor.rgb = mix(diffuseColor.rgb, detail * vec3(.85, 1.05, .75),
         grassMask * grassDetailReady * .8);
       float rockMask = (1.0 - grassMask) * (1.0 - smoothstep(.32, .68, diffuseColor.g));
       vec3 rock = texture2D(rockDetail, vMapUv * vec2(95.0, 110.0)).rgb;
       diffuseColor.rgb *= mix(vec3(1.0), .55 + rock * 1.1, rockMask * rockDetailReady * .65);
       float gravelMask = rockMask * (1.0 - smoothstep(5.0, 12.0, valleyPosition.y));
       vec3 gravel = texture2D(gravelDetail, valleyPosition.xz * .18).rgb;
       diffuseColor.rgb = mix(diffuseColor.rgb, gravel * .9, gravelMask * gravelDetailReady * .8);
       vec3 slopeNormal = abs(normalize(valleyNormal));
       float cliffMask = 1.0 - smoothstep(.48, .78, slopeNormal.y);
       float verticalWeight = max(.001, slopeNormal.x + slopeNormal.z);
       vec3 cliffRock = (texture2D(rockDetail, valleyPosition.zy * .12).rgb * slopeNormal.x +
         texture2D(rockDetail, valleyPosition.xy * .12).rgb * slopeNormal.z) / verticalWeight;
       diffuseColor.rgb = mix(diffuseColor.rgb, cliffRock * .88, cliffMask * rockDetailReady);
       float snowRidge = valleyPosition.y + 9.0 * sin(valleyPosition.x * .09) + 7.0 * sin(valleyPosition.z * .12);
       float alpineSnow = smoothstep(125.0, 175.0, snowRidge) * smoothstep(.2, .65, slopeNormal.y);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.8, .85, .87), alpineSnow * .85);`);
  };
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  const waterTime = { value: 0 };
  const waterDaylight = { value: 0 };
  const waterSun = { value: new THREE.Vector3(0, 1, 0) };
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x39778a,
    roughness: .3, metalness: .12, side: THREE.DoubleSide });
  waterMaterial.onBeforeCompile = shader => {
    shader.uniforms.waterTime = waterTime;
    shader.uniforms.waterDaylight = waterDaylight;
    shader.uniforms.waterSun = waterSun;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec2 waterPosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nwaterPosition = position.xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec2 waterPosition;\nuniform float waterTime;\nuniform float waterDaylight;\nuniform vec3 waterSun;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float waveA = sin(waterPosition.x * .24 + waterPosition.y * .15 + waterTime * .65);
       float waveB = sin(waterPosition.x * -.12 + waterPosition.y * .37 - waterTime * .48);
       normal = normalize(normal + vec3(waveA * .065, waveB * .065, 0.0));
       diffuseColor.rgb *= .91 + .055 * waveA + .035 * waveB;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      `float lakeRadius = length((waterPosition - vec2(-62.0, 83.0)) / vec2(70.0, 57.0));
       float deepWater = 1.0 - smoothstep(.35, 1.0, lakeRadius);
       outgoingLight = mix(outgoingLight, vec3(.035, .12, .16), deepWater * .48);
       float reflection = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
       outgoingLight = mix(outgoingLight, vec3(.43, .61, .68), reflection * .55);
       float glint = pow(max(0.0, sin(waterPosition.x * .72 + waterTime * 1.1) *
         sin(waterPosition.y * .83 - waterTime * .8)), 18.0);
       vec3 surfaceNormal = normalize(vec3(waveA * .14, 1.0, waveB * .14));
       vec3 viewDirection = normalize(cameraPosition - vec3(waterPosition.x, 1.5, waterPosition.y));
       float sunReflection = pow(max(0.0, dot(surfaceNormal, normalize(waterSun + viewDirection))), 12.0);
       outgoingLight += vec3(1.0, .88, .64) * glint * waterDaylight * sunReflection * 1.5;
       #include <opaque_fragment>`);
  };
  // Tessellated water surface follows the lake and river outline; the visible
  // gravel terrain remains underneath the translucent shallow water.
  const waterPositions = [], waterIndices = [];
  const waterStep = 3, x0 = -315, x1 = 15, z0 = 20, z1 = 540;
  // Clip each triangle to the shoreline instead of drawing whole grid cells.
  // This retains a smooth edge without allocating a dense world-sized mesh.
  function addWaterTriangle(points) {
    const clipped = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if (a.d <= 0) clipped.push(a);
      if ((a.d < 0) !== (b.d < 0)) {
        const t = a.d / (a.d - b.d);
        clipped.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, d: 0 });
      }
    }
    if (clipped.length < 3) return;
    const start = waterPositions.length / 3;
    for (const point of clipped) waterPositions.push(point.x, LAKE.surface, point.z);
    for (let i = 1; i + 1 < clipped.length; i++) waterIndices.push(start, start + i, start + i + 1);
  }
  for (let z = z0; z < z1; z += waterStep) for (let x = x0; x < x1; x += waterStep) {
    const point = (px, pz) => ({ x: px, z: pz, d: waterEdgeDistance(px, pz) });
    const a = point(x, z), b = point(x + waterStep, z), c = point(x, z + waterStep), d = point(x + waterStep, z + waterStep);
    addWaterTriangle([a, c, b]); addWaterTriangle([b, c, d]);
  }
  const waterGeometry = new THREE.BufferGeometry();
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
  waterGeometry.setIndex(waterIndices); waterGeometry.computeVertexNormals();
  waterMaterial.transparent = true; waterMaterial.opacity = .6; waterMaterial.depthWrite = false;
  const ocean = new THREE.Mesh(waterGeometry, waterMaterial); scene.add(ocean);
  const foam = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xe4f2ef, transparent: true, opacity: .45,
      depthWrite: false, side: THREE.DoubleSide }), 36);
  const foamPose = new THREE.Object3D(); scene.add(foam);
  function updateFoam() {
    for (let i = 0; i < 36; i++) {
      const t = ((i * 7.3 + waterTime.value * 2.2) % 78) / 78;
      const z = 220 - t * 78, x = -185 + t * 55 + Math.sin(i * 17) * 8;
      foamPose.position.set(x, LAKE.surface + .025, z);
      foamPose.rotation.set(-Math.PI / 2, 0, -.4);
      foamPose.scale.set(.4 + (i % 3) * .35, .5 + (i % 4) * .22, 1);
      foamPose.updateMatrix(); foam.setMatrixAt(i, foamPose.matrix);
    }
    foam.instanceMatrix.needsUpdate = true;
  }
  updateFoam();
  return { mesh, update(dt, sunDirection, daylight = 1) {
    waterTime.value += dt;
    waterDaylight.value = daylight;
    waterSun.value.copy(sunDirection).normalize();
    updateFoam();
  } };
}
