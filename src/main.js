import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';

// ----- Config -----
const WORLD_SIZE_X = 48;
const WORLD_SIZE_Z = 48;
const WORLD_MIN_X = -Math.floor(WORLD_SIZE_X / 2);
const WORLD_MIN_Z = -Math.floor(WORLD_SIZE_Z / 2);
const WORLD_MAX_X = WORLD_MIN_X + WORLD_SIZE_X - 1;
const WORLD_MAX_Z = WORLD_MIN_Z + WORLD_SIZE_Z - 1;
const MAX_RAY_DISTANCE = 10;

const BlockType = {
  Grass: 1,
  Dirt: 2,
  Stone: 3,
};

const BlockMeta = {
  [BlockType.Grass]: { label: 'Trawa', color: 0x55aa33 },
  [BlockType.Dirt]: { label: 'Ziemia', color: 0x8b5a2b },
  [BlockType.Stone]: { label: 'Kamień', color: 0x888888 },
};

// ----- DOM refs -----
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const blockLabelEl = document.getElementById('blockLabel');
const blockSwatchEl = document.getElementById('blockSwatch');
const fpsEl = document.getElementById('fps');

// ----- Three.js setup -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b3ff);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = false;
scene.add(dirLight);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

// ----- Input state -----
const keys = new Set();
let flyUp = false;
let flyDown = false;
let selectedBlockType = BlockType.Grass;

function updateSelectedBlockUI() {
  const meta = BlockMeta[selectedBlockType];
  blockLabelEl.textContent = meta.label;
  blockSwatchEl.style.background = `#${meta.color.toString(16).padStart(6, '0')}`;
}
updateSelectedBlockUI();

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Digit1') { selectedBlockType = BlockType.Grass; updateSelectedBlockUI(); }
  if (e.code === 'Digit2') { selectedBlockType = BlockType.Dirt; updateSelectedBlockUI(); }
  if (e.code === 'Digit3') { selectedBlockType = BlockType.Stone; updateSelectedBlockUI(); }
  if (e.code === 'Space') { flyUp = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { flyDown = true; }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space') { flyUp = false; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { flyDown = false; }
});

// Prevent context menu for right-click placement
window.addEventListener('contextmenu', (e) => e.preventDefault());

startBtn.addEventListener('click', () => {
  controls.lock();
});
controls.addEventListener('lock', () => {
  overlay.classList.add('hide');
});
controls.addEventListener('unlock', () => {
  overlay.classList.remove('hide');
});

// ----- World data -----
const world = new Map(); // key: "x,y,z" -> BlockType
function keyOf(x, y, z) { return `${x},${y},${z}`; }
function hasBlock(x, y, z) { return world.has(keyOf(x, y, z)); }
function getBlock(x, y, z) { return world.get(keyOf(x, y, z)); }
function setBlock(x, y, z, type) { world.set(keyOf(x, y, z), type); }
function removeBlock(x, y, z) { world.delete(keyOf(x, y, z)); }

// Simple height function (fast and deterministic)
function terrainHeightAt(x, z) {
  const h = 6
    + Math.floor(3 * Math.sin(x * 0.15))
    + Math.floor(3 * Math.cos(z * 0.15))
    + Math.floor(2 * Math.sin((x + z) * 0.12));
  return Math.max(2, h);
}

// Generate world
for (let x = WORLD_MIN_X; x <= WORLD_MAX_X; x++) {
  for (let z = WORLD_MIN_Z; z <= WORLD_MAX_Z; z++) {
    const h = terrainHeightAt(x, z);
    for (let y = 0; y <= h; y++) {
      let type = BlockType.Stone;
      if (y === h) type = BlockType.Grass;
      else if (y >= h - 3) type = BlockType.Dirt;
      setBlock(x, y, z, type);
    }
  }
}

// ----- Mesh building (Instanced) -----
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const materials = {
  [BlockType.Grass]: new THREE.MeshStandardMaterial({ color: BlockMeta[BlockType.Grass].color, roughness: 1, metalness: 0 }),
  [BlockType.Dirt]: new THREE.MeshStandardMaterial({ color: BlockMeta[BlockType.Dirt].color, roughness: 1, metalness: 0 }),
  [BlockType.Stone]: new THREE.MeshStandardMaterial({ color: BlockMeta[BlockType.Stone].color, roughness: 1, metalness: 0 }),
};

const typeToMesh = new Map(); // type -> { mesh: InstancedMesh, positions: Array<THREE.Vector3> }

function rebuildMeshes() {
  // Remove old
  for (const entry of typeToMesh.values()) {
    scene.remove(entry.mesh);
    entry.mesh.geometry.dispose?.();
    // Keep materials shared
  }
  typeToMesh.clear();

  const positionsByType = new Map();
  positionsByType.set(BlockType.Grass, []);
  positionsByType.set(BlockType.Dirt, []);
  positionsByType.set(BlockType.Stone, []);

  for (const [key, type] of world.entries()) {
    const [x, y, z] = key.split(',').map(Number);
    positionsByType.get(type).push(new THREE.Vector3(x, y, z));
  }

  const tempMatrix = new THREE.Matrix4();
  for (const type of [BlockType.Grass, BlockType.Dirt, BlockType.Stone]) {
    const positions = positionsByType.get(type);
    if (!positions || positions.length === 0) continue;
    const mesh = new THREE.InstancedMesh(boxGeometry, materials[type], positions.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.blockType = type;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      tempMatrix.makeTranslation(p.x + 0.5, p.y + 0.5, p.z + 0.5);
      mesh.setMatrixAt(i, tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    typeToMesh.set(type, { mesh, positions });
  }
  updateRaycastTargets();
}

let raycastTargets = [];
function updateRaycastTargets() {
  raycastTargets = [];
  for (const { mesh } of typeToMesh.values()) {
    raycastTargets.push(mesh);
  }
}

rebuildMeshes();

// Spawn the camera above ground near center
function groundHeightAt(x, z) {
  for (let y = 64; y >= -10; y--) {
    if (hasBlock(x, y, z)) return y;
  }
  return 0;
}
const spawnX = 0, spawnZ = 0;
const gh = groundHeightAt(spawnX, spawnZ);
camera.position.set(spawnX + 2, gh + 6, spawnZ + 6);

// ----- Interaction (raycast) -----
const raycaster = new THREE.Raycaster();
const ndcCenter = new THREE.Vector2(0, 0);

function removeBlockAtIntersection(intersection) {
  const mesh = intersection.object; // InstancedMesh
  const instanceId = intersection.instanceId;
  const type = mesh.userData.blockType;
  const entry = typeToMesh.get(type);
  if (!entry) return;
  const pos = entry.positions[instanceId];
  if (!pos) return;
  removeBlock(pos.x, pos.y, pos.z);
  rebuildMeshes();
}

function placeBlockAtIntersection(intersection, placeType) {
  const mesh = intersection.object; // InstancedMesh
  const instanceId = intersection.instanceId;
  const type = mesh.userData.blockType;
  const entry = typeToMesh.get(type);
  if (!entry) return;
  const pos = entry.positions[instanceId];
  if (!pos) return;
  // Face normal is in object space; with axis-aligned unit boxes it's ±X/±Y/±Z
  const n = intersection.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
  // Because each instance is translated by +0.5, +0.5, +0.5, we can just add the normal to block coordinates
  const target = new THREE.Vector3(pos.x + Math.round(n.x), pos.y + Math.round(n.y), pos.z + Math.round(n.z));
  const key = keyOf(target.x, target.y, target.z);
  if (!world.has(key)) {
    setBlock(target.x, target.y, target.z, placeType);
    rebuildMeshes();
  }
}

window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  raycaster.setFromCamera(ndcCenter, camera);
  const intersects = raycaster.intersectObjects(raycastTargets, false);
  const i0 = intersects[0];
  if (!i0) return;
  if (e.button === 0) {
    removeBlockAtIntersection(i0);
  } else if (e.button === 2) {
    placeBlockAtIntersection(i0, selectedBlockType);
  }
});

// ----- Movement / update loop -----
const clock = new THREE.Clock();
let accumDt = 0;
let fpsSmoothed = 0;

function update(dt) {
  const speed = 7; // units per second
  const velocity = new THREE.Vector3();

  if (keys.has('KeyW')) velocity.z -= 1;
  if (keys.has('KeyS')) velocity.z += 1;
  if (keys.has('KeyA')) velocity.x -= 1;
  if (keys.has('KeyD')) velocity.x += 1;

  velocity.normalize();

  // Move in camera's local space (XZ plane)
  const moveZ = velocity.z * speed * dt;
  const moveX = velocity.x * speed * dt;
  controls.moveRight(moveX);
  controls.moveForward(moveZ);

  // Vertical fly
  let vy = 0;
  if (flyUp) vy += 1;
  if (flyDown) vy -= 1;
  if (vy !== 0) {
    camera.position.y += vy * speed * 0.7 * dt;
  }
}

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);

  // FPS HUD
  accumDt += dt;
  if (accumDt >= 0.2) {
    const fps = 1 / dt;
    fpsSmoothed = fpsSmoothed === 0 ? fps : THREE.MathUtils.lerp(fpsSmoothed, fps, 0.2);
    fpsEl.textContent = `${fpsSmoothed.toFixed(0)}`;
    accumDt = 0;
  }

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ----- Resize -----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});