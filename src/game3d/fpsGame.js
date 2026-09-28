import * as THREE from "three";
import { parseMap, isSolid, distanceField, zoneAt } from "../maps/maps.js";
import { getWeapon, SKINS } from "../game/arsenal.js";
import { MAX_SHIELD } from "../game/matchSession.js";
import { h, clear, bar } from "../ui/dom.js";
import { toast } from "../ui/notify.js";
import { wallTexture, wallGlowTexture, floorTexture, ceilingTexture, glowTexture, beamTexture, screenTexture, doorTexture } from "./textures.js";
import { Particles } from "./particles.js";

const CELL = 2;
const WALL_HEIGHT = 3.2;
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.32;
const PLAYER_SPEED = 4.6;
const INTERACT_RANGE = 2.4;
const DRONE_SPEED = 2.3;
const DRONE_SIGHT = 14;
const DRONE_ATTACK_RANGE = 10;
const PROJECTILE_SPEED = 9;
const RESPAWN_INVULNERABLE = 2;
const SPRINT_MULTIPLIER = 1.35;
const ORB_DROP_CHANCE = 0.4;
const ORB_SHIELD = 15;
const ORB_LIFETIME = 25;
const OBJECTIVE_LABELS = { door: "DOOR", terminal: "TERMINAL", defuse: "DEFUSE", core: "CORE" };

const DIFFICULTY = {
  relaxed: { damage: 4, fireInterval: 2.6, droneHp: 2 },
  standard: { damage: 7, fireInterval: 1.8, droneHp: 3 },
  hard: { damage: 10, fireInterval: 1.3, droneHp: 4 },
};

const toWorld = (cell) => (cell + 0.5) * CELL;
const toCell = (world) => Math.floor(world / CELL);

/**
 * The 3D first-person layer. It handles movement, combat and rendering only;
 * every question and scoring rule goes through MatchSession via the handlers.
 */
export class FpsGame {
  /**
   * @param {{ container: HTMLElement, app: any, session: import("../game/matchSession.js").MatchSession, map: any,
   *           handlers: { interact: (objective: any) => Promise<void>, timeUp: () => void, quit: () => void } }} options
   */
  constructor({ container, app, session, map, handlers }) {
    this.container = container;
    this.app = app;
    this.session = session;
    this.map = map;
    this.handlers = handlers;
    this.parsed = parseMap(map);
    this.settings = app.save.settings;
    this.difficulty = DIFFICULTY[this.settings.combatDifficulty] ?? DIFFICULTY.standard;
    this.openDoors = new Set();
    this.usedObjectives = new Set();
    this.state = "briefing";
    this.keys = new Set();
    this.time = 0;
    this.effects = { revealEnemiesUntil: 0, revealObjectivesUntil: 0, speedUntil: 0, speedMultiplier: 1, shieldUntil: 0, shieldFactor: 1, invulnerableUntil: 0 };
    this.cooldowns = { basic: 0, tactical: 0 };
    this.drones = [];
    this.projectiles = [];
    this.tracers = [];
    this.orbs = [];
    this.pendingFeed = [];
    this.shake = 0;
    this.gunKick = 0;
    this.switchAnim = 0;
    this.disposables = [];
    this.listeners = [];
    this.gamepadPrevious = [];
    this.bigMap = false;
    this.dragLook = !app.capabilities.pointerLock;

    const loadout = app.save.loadout;
    const skin = SKINS.find((s) => s.id === loadout.skin);
    this.weapons = [getWeapon(loadout.primary), getWeapon(loadout.secondary)].map((weapon) => ({
      ...weapon, ammo: weapon.magazine, reloadUntil: 0, nextFireAt: 0, colour: skin?.colour ?? weapon.colour,
    }));
    this.weaponIndex = 0;

    this.#buildDom();
    this.#buildScene();
    this.#bindInput();
    this.#resetPlayer();
    this.startRound();
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame((t) => this.#loop(t));
  }

  // ---------- setup ----------

  #buildDom() {
    this.canvasHost = h("div", { class: "game-canvas" });
    this.hud = h("div", { class: "hud", "aria-hidden": "true" });
    this.overlay = h("div", { class: "game-overlay", role: "dialog", "aria-modal": "true", hidden: true });
    this.prompt = h("div", { class: "hud-prompt" });
    this.crosshair = h("div", { class: "crosshair" });
    this.damageFlash = h("div", { class: "damage-flash" });
    this.minimap = h("canvas", { class: "minimap" });
    this.hudTopLeft = h("div", { class: "hud-top-left" });
    this.hudTopRight = h("div", { class: "hud-top-right" });
    this.hudBottomLeft = h("div", { class: "hud-bottom-left" });
    this.hudBottomCentre = h("div", { class: "hud-bottom-centre" });
    this.hudBottomRight = h("div", { class: "hud-bottom-right" });
    this.lowShield = h("div", { class: "low-shield" });
    this.damageDir = h("div", { class: "damage-dir" });
    this.waypoint = h("div", { class: "waypoint" }, h("span", { class: "waypoint-arrow" }), h("span", { class: "waypoint-label" }));
    this.killFeed = h("div", { class: "kill-feed" });
    this.hud.append(this.lowShield, this.damageDir, this.waypoint, this.killFeed, this.damageFlash, this.hudTopLeft, h("div", { class: "hud-top-right-wrap" }, this.hudTopRight, this.minimap), this.crosshair, this.prompt, this.hudBottomLeft, this.hudBottomCentre, this.hudBottomRight);
    this.root = h("div", { class: "game-root" }, this.canvasHost, this.hud, this.overlay);
    this.container.append(this.root);
  }

  #track(object) {
    this.disposables.push(object);
    return object;
  }

  #buildScene() {
    const theme = this.map.theme;
    const high = this.settings.graphicsQuality === "high";
    this.renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    this.canvasHost.append(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("tabindex", "0");

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.fog);
    this.scene.fog = new THREE.Fog(theme.fog, 6, high ? 55 : 38);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 120);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.scene.add(new THREE.HemisphereLight(theme.light, theme.floor, 1.6));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 0.5);
    sun.position.set(10, 20, 5);
    this.scene.add(sun);
    // One light that follows the camera: muzzle flash and a faint torch so corridors read in depth.
    this.playerLight = new THREE.PointLight(theme.light, 0.6, 9, 1.6);
    this.scene.add(this.playerLight);

    this.glowTexture = this.#track(glowTexture());
    const { width, height } = this.parsed;
    const floor = new THREE.Mesh(this.#track(new THREE.PlaneGeometry(width * CELL, height * CELL)),
      this.#track(new THREE.MeshLambertMaterial({ map: this.#track(floorTexture(theme, [width, height])) })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((width * CELL) / 2, 0, (height * CELL) / 2);
    this.scene.add(floor);

    const ceiling = new THREE.Mesh(this.#track(new THREE.PlaneGeometry(width * CELL, height * CELL)),
      this.#track(new THREE.MeshBasicMaterial({ map: this.#track(ceilingTexture(theme, [width, height])), color: 0x9aa3ad })));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((width * CELL) / 2, WALL_HEIGHT, (height * CELL) / 2);
    this.scene.add(ceiling);

    // Walls as one instanced mesh (fast on low-end GPUs).
    const wallCells = [];
    this.map.layout.forEach((row, y) => [...row].forEach((cell, x) => cell === "#" && wallCells.push([x, y])));
    const wallGeometry = this.#track(new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL));
    const wallMaterial = this.#track(new THREE.MeshLambertMaterial({
      map: this.#track(wallTexture(theme)), emissive: 0xffffff, emissiveMap: this.#track(wallGlowTexture(theme)), emissiveIntensity: 0.9,
    }));
    this.walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallCells.length);
    const matrix = new THREE.Matrix4();
    wallCells.forEach(([x, y], index) => {
      matrix.makeTranslation(toWorld(x), WALL_HEIGHT / 2, toWorld(y));
      this.walls.setMatrixAt(index, matrix);
    });
    this.scene.add(this.walls);

    // Glowing skirting strip along the foot of the walls.
    const skirtGeometry = this.#track(new THREE.BoxGeometry(CELL + 0.04, 0.06, CELL + 0.04));
    const skirtMaterial = this.#track(new THREE.MeshBasicMaterial({ color: theme.accent }));
    const skirts = new THREE.InstancedMesh(skirtGeometry, skirtMaterial, wallCells.length);
    wallCells.forEach(([x, y], index) => {
      matrix.makeTranslation(toWorld(x), 0.12, toWorld(y));
      skirts.setMatrixAt(index, matrix);
    });
    this.scene.add(skirts);

    // Objectives.
    const accent = new THREE.Color(theme.accent);
    this.objectiveMeshes = new Map();
    for (const objective of this.parsed.objectives) {
      const mesh = this.#objectiveMesh(objective, accent);
      mesh.position.x = toWorld(objective.x);
      mesh.position.z = toWorld(objective.y);
      this.scene.add(mesh);
      this.objectiveMeshes.set(objective.id, mesh);
    }

    // Weapon model attached to the camera.
    this.gun = new THREE.Group();
    this.gunMaterial = this.#track(new THREE.MeshLambertMaterial({ color: this.weapons[0].colour, emissive: this.weapons[0].colour, emissiveIntensity: 0.35 }));
    const darkMaterial = this.#track(new THREE.MeshLambertMaterial({ color: 0x1b2028 }));
    const part = (geometry, material, x, y, z, rx = 0) => {
      const mesh = new THREE.Mesh(this.#track(geometry), material);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      this.gun.add(mesh);
      return mesh;
    };
    part(new THREE.BoxGeometry(0.05, 0.06, 0.26), darkMaterial, 0, 0, 0);
    part(new THREE.BoxGeometry(0.056, 0.02, 0.2), this.gunMaterial, 0, 0.036, -0.01);
    part(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8), darkMaterial, 0, 0.008, -0.2, Math.PI / 2);
    part(new THREE.BoxGeometry(0.034, 0.09, 0.045), darkMaterial, 0, -0.07, 0.07, -0.25);
    part(new THREE.BoxGeometry(0.02, 0.025, 0.05), darkMaterial, 0, 0.058, 0.03);
    this.gunCell = part(new THREE.BoxGeometry(0.058, 0.03, 0.06), this.gunMaterial, 0, -0.03, -0.06);
    this.muzzleFlash = new THREE.Sprite(this.#track(new THREE.SpriteMaterial({
      map: this.glowTexture, color: this.weapons[0].colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
    })));
    this.muzzleFlash.position.set(0, 0.008, -0.3);
    this.muzzleFlash.scale.setScalar(0.001);
    this.gun.add(this.muzzleFlash);
    this.gun.scale.setScalar(0.7);
    this.gunRest = new THREE.Vector3(0.13, -0.12, -0.36);
    this.gun.position.copy(this.gunRest);
    this.camera.add(this.gun);

    this.droneGeometry = this.#track(new THREE.OctahedronGeometry(0.42));
    this.ringGeometry = this.#track(new THREE.TorusGeometry(0.55, 0.04, 6, 20));
    this.eyeGeometry = this.#track(new THREE.SphereGeometry(0.12, 10, 8));
    this.orbGeometry = this.#track(new THREE.IcosahedronGeometry(0.16, 0));
    this.orbMaterial = this.#track(new THREE.MeshBasicMaterial({ color: 0x6fdc8c, wireframe: true }));
    this.projectileMaterial = this.#track(new THREE.SpriteMaterial({ map: this.glowTexture, color: 0xff5470, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.tracerMaterial = this.#track(new THREE.LineBasicMaterial({ color: this.weapons[0].colour, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    this.particles = new Particles(this.scene, this.glowTexture, { max: high ? 260 : 140 });
    this.raycaster = new THREE.Raycaster();
    this.raycaster.camera = this.camera;

    this.#buildMinimapBase();
    this.resizeObserver = new ResizeObserver(() => this.#resize());
    this.resizeObserver.observe(this.root);
    this.#resize();
  }

  #halo(colour, size, y) {
    const halo = new THREE.Sprite(this.#track(new THREE.SpriteMaterial({ map: this.glowTexture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
    halo.scale.setScalar(size);
    halo.position.y = y;
    return halo;
  }

  /** A soft column of light that marks an active objective. */
  #beam(colour) {
    this.beamTexture ??= this.#track(beamTexture());
    const beam = new THREE.Mesh(this.#track(new THREE.CylinderGeometry(0.55, 0.7, WALL_HEIGHT, 16, 1, true)),
      this.#track(new THREE.MeshBasicMaterial({ map: this.beamTexture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide, opacity: 0.45 })));
    beam.position.y = WALL_HEIGHT / 2;
    return beam;
  }

  #objectiveMesh(objective, accent) {
    const group = new THREE.Group();
    if (objective.kind === "door") {
      const horizontal = this.map.layout[objective.y][objective.x - 1] === "#";
      this.doorTexture ??= this.#track(doorTexture());
      const door = new THREE.Mesh(this.#track(new THREE.BoxGeometry(horizontal ? CELL : 0.35, WALL_HEIGHT, horizontal ? 0.35 : CELL)),
        this.#track(new THREE.MeshLambertMaterial({ map: this.doorTexture, emissive: 0xff9d3d, emissiveMap: this.doorTexture, emissiveIntensity: 0.6 })));
      door.position.y = WALL_HEIGHT / 2;
      group.add(door);
      group.userData.part = door;
    } else if (objective.kind === "terminal") {
      this.screenTexture ??= this.#track(screenTexture(this.map.theme));
      const pillar = new THREE.Mesh(this.#track(new THREE.BoxGeometry(0.6, 1.1, 0.6)), this.#track(new THREE.MeshLambertMaterial({ color: 0x1b2530 })));
      pillar.position.y = 0.55;
      const screen = new THREE.Mesh(this.#track(new THREE.BoxGeometry(0.66, 0.5, 0.66)), this.#track(new THREE.MeshBasicMaterial({ color: accent, map: this.screenTexture })));
      screen.position.y = 1.4;
      const beam = this.#beam(accent);
      const halo = this.#halo(accent, 1.6, 1.4);
      group.add(pillar, screen, beam, halo);
      group.userData.part = screen;
      group.userData.fx = [beam, halo];
    } else if (objective.kind === "defuse") {
      const bomb = new THREE.Mesh(this.#track(new THREE.OctahedronGeometry(0.45)), this.#track(new THREE.MeshBasicMaterial({ color: 0xff6b6b, wireframe: true })));
      bomb.position.y = 1.1;
      const base = new THREE.Mesh(this.#track(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 12)), this.#track(new THREE.MeshLambertMaterial({ color: 0x2a1a1a })));
      base.position.y = 0.15;
      const beam = this.#beam(0xff6b6b);
      const halo = this.#halo(0xff6b6b, 1.2, 1.1);
      group.add(bomb, base, beam, halo);
      group.userData.part = bomb;
      group.userData.fx = [beam, halo];
    } else {
      const core = new THREE.Mesh(this.#track(new THREE.IcosahedronGeometry(0.9, 1)), this.#track(new THREE.MeshBasicMaterial({ color: accent, wireframe: true })));
      core.position.y = 1.6;
      const inner = new THREE.Mesh(this.#track(new THREE.IcosahedronGeometry(0.45, 0)), this.#track(new THREE.MeshBasicMaterial({ color: accent })));
      core.add(inner);
      const beam = this.#beam(accent);
      const halo = this.#halo(accent, 3.2, 1.6);
      group.add(core, beam, halo);
      group.userData.part = core;
      group.userData.fx = [beam, halo, inner];
    }
    return group;
  }

  #buildMinimapBase() {
    const { width, height } = this.parsed;
    const scale = 5;
    this.minimap.width = width * scale;
    this.minimap.height = height * scale;
    this.minimapScale = scale;
    this.minimapBase = document.createElement("canvas");
    this.minimapBase.width = this.minimap.width;
    this.minimapBase.height = this.minimap.height;
    const context = this.minimapBase.getContext("2d");
    context.fillStyle = "rgba(0,0,0,0.65)";
    context.fillRect(0, 0, this.minimap.width, this.minimap.height);
    context.fillStyle = this.map.theme.wall;
    this.map.layout.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell === "#") context.fillRect(x * scale, y * scale, scale, scale);
    }));
  }

  #resize() {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ---------- input ----------

  #on(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push(() => target.removeEventListener(event, handler, options));
  }

  #bindInput() {
    this.#on(window, "keydown", (event) => {
      if (this.state !== "playing") {
        if (event.key === "Escape" && this.state === "paused" && document.activeElement?.tagName !== "INPUT") event.preventDefault();
        return;
      }
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "tab"].includes(key)) event.preventDefault();
      this.keys.add(key);
      if (event.repeat) return;
      if (key === "e") this.#interact();
      if (key === "r") this.#reload();
      if (key === "1") this.#switchWeapon(0);
      if (key === "2") this.#switchWeapon(1);
      if (key === "q") this.#useAbility("basic");
      if (key === "f") this.#useAbility("tactical");
      if (key === "x") this.#useUltimate();
      if (key === "tab") this.bigMap = true;
      if (key === "escape" && !document.pointerLockElement) this.pause();
    });
    this.#on(window, "keyup", (event) => {
      const key = event.key.toLowerCase();
      this.keys.delete(key);
      if (key === "tab") this.bigMap = false;
    });
    this.#on(window, "blur", () => this.keys.clear());
    this.#on(document, "pointerlockchange", () => {
      // Browsers can report a large bogus movement just after the lock changes.
      this.ignoreMouseUntil = performance.now() + 150;
      if (document.pointerLockElement !== this.canvas && this.state === "playing" && !this.dragLook) this.pause();
    });
    this.#on(document, "pointerlockerror", () => {
      this.dragLook = true;
      toast("Mouse lock is blocked on this computer. Hold the right mouse button and drag to look.", "warning", 6000);
    });
    this.#on(document, "mousemove", (event) => {
      if (this.state !== "playing") return;
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && !(this.dragLook && event.buttons & 2)) return;
      if (performance.now() < (this.ignoreMouseUntil ?? 0)) return;
      if (Math.abs(event.movementX) > 250 || Math.abs(event.movementY) > 250) return;
      this.#look(event.movementX, event.movementY, 0.0022);
    });
    this.#on(this.canvas, "mousedown", (event) => {
      if (this.state !== "playing") return;
      if (event.button === 0) this.firing = true;
    });
    this.#on(window, "mouseup", (event) => {
      if (event.button === 0) this.firing = false;
    });
    this.#on(this.canvas, "contextmenu", (event) => event.preventDefault());
    this.#on(this.canvas, "wheel", (event) => {
      if (this.state === "playing") this.#switchWeapon(this.weaponIndex === 0 ? 1 : 0);
      event.preventDefault();
    }, { passive: false });
  }

  #look(dx, dy, factor) {
    const sensitivity = this.settings.mouseSensitivity * factor;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity * (this.settings.invertY ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  #pollGamepad(dt) {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return { x: 0, z: 0 };
    const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    const pressed = pad.buttons.map((b) => b.pressed);
    const edge = (i) => pressed[i] && !this.gamepadPrevious[i];
    if (this.state === "playing") {
      this.#look(dead(pad.axes[2] ?? 0) * 900 * dt, dead(pad.axes[3] ?? 0) * 900 * dt, 0.0022);
      this.firing = this.firing || pressed[7];
      if (edge(0)) this.#interact();
      if (edge(2)) this.#reload();
      if (edge(3)) this.#switchWeapon(this.weaponIndex === 0 ? 1 : 0);
      if (edge(4)) this.#useAbility("basic");
      if (edge(5)) this.#useAbility("tactical");
      if (edge(6)) this.#useUltimate();
      if (edge(9)) this.pause();
      this.bigMap = pressed[8];
    } else if (this.state === "paused" && edge(9)) {
      this.resume();
    }
    this.padFiring = pressed[7];
    this.gamepadPrevious = pressed;
    return { x: dead(pad.axes[0] ?? 0), z: dead(pad.axes[1] ?? 0) };
  }

  // ---------- state ----------

  #resetPlayer() {
    this.position = new THREE.Vector3(toWorld(this.parsed.spawn.x), EYE_HEIGHT, toWorld(this.parsed.spawn.y));
    this.yaw = this.#openDirection();
    this.pitch = 0;
    this.effects.invulnerableUntil = this.time + RESPAWN_INVULNERABLE;
  }

  /** Yaw pointing down the longest clear line from the spawn cell. */
  #openDirection() {
    const { x, y } = this.parsed.spawn;
    const directions = [[0, -1, 0], [-1, 0, Math.PI / 2], [0, 1, Math.PI], [1, 0, -Math.PI / 2]];
    let best = directions[0];
    let bestRun = -1;
    for (const direction of directions) {
      let run = 0;
      while (!isSolid(this.map, x + direction[0] * (run + 1), y + direction[1] * (run + 1))) run++;
      if (run > bestRun) {
        bestRun = run;
        best = direction;
      }
    }
    return best[2];
  }

  /** Called at the start of each round: fresh objectives and drones. */
  startRound() {
    this.usedObjectives.clear();
    for (const drone of this.drones) this.#removeDrone(drone);
    this.drones = [];
    const target = Math.min(7, 2 + this.session.roundIndex + (this.session.round.boss ? 2 : 0));
    this.droneTarget = target;
    for (let i = 0; i < target; i++) this.#spawnDrone();
    this.#updateObjectiveVisuals();
    if (this.state === "briefing") this.#showBriefing();
  }

  #spawnDrone(nearCell = null) {
    const spawns = this.parsed.droneSpawns.filter((cell) => Math.hypot(toWorld(cell.x) - this.position.x, toWorld(cell.y) - this.position.z) > 8);
    const cell = nearCell ?? spawns[Math.floor(Math.random() * spawns.length)] ?? this.parsed.droneSpawns[0];
    const accent = 0xff5470;
    const body = new THREE.Mesh(this.droneGeometry, new THREE.MeshLambertMaterial({ color: 0x331018, emissive: accent, emissiveIntensity: 0.6 }));
    const ring = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color: accent }));
    ring.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(this.eyeGeometry, new THREE.MeshBasicMaterial({ color: 0xffc857 }));
    eye.position.z = 0.34;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: accent, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    halo.scale.setScalar(1.6);
    const group = new THREE.Group();
    group.add(body, ring, eye, halo);
    group.position.set(toWorld(cell.x), EYE_HEIGHT, toWorld(cell.y));
    this.scene.add(group);
    const drone = { group, body, ring, eye, halo, hp: this.difficulty.droneHp, cooldown: 1 + Math.random() * 2, stunnedUntil: 0, wanderTarget: null, wanderUntil: 0, dying: 0, phase: Math.random() * 6 };
    body.userData.drone = drone;
    ring.userData.drone = drone;
    eye.userData.drone = drone;
    this.drones.push(drone);
  }

  #removeDrone(drone) {
    this.scene.remove(drone.group);
    drone.body.material.dispose();
    drone.ring.material.dispose();
    drone.eye.material.dispose();
    drone.halo.material.dispose();
  }

  #updateObjectiveVisuals() {
    for (const objective of this.parsed.objectives) {
      const mesh = this.objectiveMeshes.get(objective.id);
      if (objective.kind === "door") {
        mesh.visible = !this.openDoors.has(objective.id) || mesh.userData.opening;
      } else if (objective.kind === "core") {
        mesh.userData.part.material.color.set(this.session.round.boss ? this.map.theme.accent : "#444");
        for (const fx of mesh.userData.fx) fx.visible = this.session.round.boss;
      } else {
        const used = this.usedObjectives.has(objective.id);
        mesh.userData.part.material.color.set(used ? "#3a3a3a" : objective.kind === "defuse" ? "#ff6b6b" : this.map.theme.accent);
        for (const fx of mesh.userData.fx) fx.visible = !used;
      }
    }
  }

  #showBriefing() {
    this.state = "briefing";
    const start = h("button", { class: "btn btn-primary", on: { click: () => this.resume() } }, "Click to deploy");
    this.#showOverlay(h("div", { class: "question-card briefing" },
      h("h2", {}, `${this.map.name}: ${this.session.round.name} round`),
      h("p", {}, this.session.round.boss
        ? "Boss round: reach the glowing core and restore it by answering a mixed set of timed questions."
        : `Answer ${this.session.round.questions} questions at terminals (glowing pillars), defuse points (red) and locked doors (orange). Bug drones will try to stop you.`),
      h("ul", { class: "controls-list" },
        h("li", {}, "WASD move · Shift sprint · Mouse look · Left click fire · E interact · R reload · 1/2 weapons"),
        h("li", {}, `Q ${this.session.playerClass.basic.name} · F ${this.session.playerClass.tactical.name} · X ${this.session.playerClass.ultimate.name} · Hold Tab for the map · Esc pause`)),
      h("p", { class: "muted" }, "Follow the waypoint marker to the nearest objective. Destroyed drones can drop green shield orbs."),
      h("p", { class: "muted" }, "The game pauses whenever a question is on screen."),
      h("div", { class: "actions" }, start)));
    start.focus();
  }

  #showOverlay(content) {
    this.overlay.hidden = false;
    clear(this.overlay, content);
  }

  hideOverlay() {
    this.overlay.hidden = true;
    clear(this.overlay);
  }

  /** Enters play; must be called from a user gesture for pointer lock. */
  resume() {
    this.hideOverlay();
    this.state = "playing";
    for (const [text, kind] of this.pendingFeed.splice(0)) this.#feedItem(text, kind);
    this.ignoreMouseUntil = performance.now() + 150;
    this.keys.clear();
    this.firing = false;
    if (!this.dragLook) {
      try {
        const request = this.canvas.requestPointerLock();
        request?.catch?.(() => {
          this.dragLook = true;
        });
      } catch {
        this.dragLook = true;
      }
    }
    this.canvas.focus();
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.keys.clear();
    this.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const resume = h("button", { class: "btn btn-primary", on: { click: () => this.resume() } }, "Resume");
    this.#showOverlay(h("div", { class: "question-card" },
      h("h2", {}, "Paused"),
      h("p", {}, `Round: ${this.session.round.name} · ${this.session.roundState.answered}/${this.session.round.questions} questions · Shield ${this.session.shield}`),
      h("div", { class: "actions" }, resume,
        h("button", { class: "btn btn-danger", on: { click: () => { if (window.confirm("Abandon this operation? Answers so far are kept.")) this.handlers.quit(); } } }, "Abandon operation"))));
    resume.focus();
  }

  /** Runs an async UI flow (question, round summary) with the game paused. */
  async runPaused(task) {
    this.state = "question";
    this.keys.clear();
    this.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.overlay.hidden = false;
    await task(this.overlay);
    if (this.disposed) return;
    const button = h("button", { class: "btn btn-primary", on: { click: () => this.resume() } }, "Click to continue");
    this.#showOverlay(h("div", { class: "question-card briefing" }, h("p", {}, "Ready?"), h("div", { class: "actions" }, button)));
    button.focus();
    this.state = "resuming";
  }

  applyEffects(objective, effects) {
    if (objective.kind === "door" && effects.unlock) {
      this.openDoors.add(objective.id);
      const mesh = this.objectiveMeshes.get(objective.id);
      mesh.userData.opening = !this.settings.reducedMotion;
      this.app.sound.play("door");
    }
    if (objective.kind === "terminal" || objective.kind === "defuse") this.usedObjectives.add(objective.id);
    if (objective.kind !== "door") {
      const colour = effects.alarm ? 0xff5470 : objective.kind === "defuse" ? 0xff6b6b : this.map.theme.accent;
      this.particles.burst(new THREE.Vector3(toWorld(objective.x), 1.3, toWorld(objective.y)), { count: 24, colour, speed: 5, size: 0.22, life: 0.9, gravity: 3 });
    }
    if (effects.shieldChange > 0) this.#feedItem(`+${effects.shieldChange} SHIELD`, "good");
    if (effects.refillAmmo) this.#feedItem("AMMO REFILLED", "good");
    if (effects.alarm) this.#feedItem("ALARM – DRONE DEPLOYED", "bad");
    if (this.session.correctStreak >= 2) this.#feedItem(`ANSWER STREAK ×${this.session.correctStreak}`, "kill");
    if (effects.refillAmmo) for (const weapon of this.weapons) weapon.ammo = weapon.magazine;
    if (effects.revealEnemies) this.effects.revealEnemiesUntil = this.time + effects.revealEnemies;
    if (effects.alarm) {
      this.app.sound.play("alarm");
      this.#spawnDrone();
    }
    const remaining = this.parsed.objectives.filter((o) => (o.kind === "terminal" || o.kind === "defuse") && !this.usedObjectives.has(o.id));
    if (remaining.length === 0) this.usedObjectives.clear();
    this.#updateObjectiveVisuals();
  }

  // ---------- actions ----------

  #nearestObjective() {
    let best = null;
    const forward = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    for (const objective of this.parsed.objectives) {
      if (objective.kind === "door" && this.openDoors.has(objective.id)) continue;
      if ((objective.kind === "terminal" || objective.kind === "defuse") && this.usedObjectives.has(objective.id)) continue;
      if (objective.kind === "core" && !this.session.round.boss) continue;
      const dx = toWorld(objective.x) - this.position.x;
      const dz = toWorld(objective.y) - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > INTERACT_RANGE + (objective.kind === "door" ? 0.3 : 0)) continue;
      const facing = distance < 0.8 ? 1 : (dx * forward.x + dz * forward.y) / distance;
      if (facing < 0.35) continue;
      if (!best || distance < best.distance) best = { objective, distance };
    }
    return best?.objective ?? null;
  }

  #interact() {
    const objective = this.#nearestObjective();
    if (!objective) return;
    this.app.sound.play("terminal");
    this.handlers.interact(objective);
  }

  #reload() {
    const weapon = this.weapons[this.weaponIndex];
    if (weapon.magazine === Infinity || weapon.ammo === weapon.magazine || weapon.reloadUntil > this.time) return;
    weapon.reloadUntil = this.time + weapon.reloadTime;
    this.app.sound.play("reload");
  }

  #switchWeapon(index) {
    if (index === this.weaponIndex) return;
    this.weaponIndex = index;
    const colour = this.weapons[index].colour;
    this.gunMaterial.color.set(colour);
    this.gunMaterial.emissive.set(colour);
    this.tracerMaterial.color.set(colour);
    this.muzzleFlash.material.color.set(colour);
    this.switchAnim = this.settings.reducedMotion ? 0 : 1;
  }

  #useAbility(slot) {
    const ability = this.session.playerClass[slot];
    if (this.cooldowns[slot] > this.time) return;
    this.cooldowns[slot] = this.time + ability.cooldown;
    switch (ability.kind) {
      case "revealEnemies": this.effects.revealEnemiesUntil = this.time + ability.duration; break;
      case "revealObjectives": this.effects.revealObjectivesUntil = this.time + ability.duration; break;
      case "speedBoost": this.effects.speedUntil = this.time + ability.duration; this.effects.speedMultiplier = ability.multiplier; break;
      case "damageReduction": this.effects.shieldUntil = this.time + ability.duration; this.effects.shieldFactor = ability.factor; break;
      case "stunPulse":
        for (const drone of this.drones) {
          if (drone.group.position.distanceTo(this.position) <= ability.radius) drone.stunnedUntil = this.time + ability.duration;
        }
        break;
    }
    this.app.sound.play("streak");
    toast(`${ability.name} activated`, "info", 1500);
  }

  #useUltimate() {
    const ultimate = this.session.playerClass.ultimate;
    if (this.session.pendingAids.size) return toast(`${ultimate.name} is already armed for your next question.`, "info", 2000);
    if (!this.session.activateUltimate()) return toast(`${ultimate.name} needs ${ultimate.charge - this.session.ultimateCharge} more correct answer(s).`, "info", 2000);
    this.app.sound.play("levelUp");
    toast(`${ultimate.name} armed: ${ultimate.description}`, "success", 4000);
  }

  #fire() {
    const weapon = this.weapons[this.weaponIndex];
    if (weapon.reloadUntil > this.time || weapon.nextFireAt > this.time) return;
    if (weapon.ammo <= 0) {
      this.app.sound.play("empty");
      return this.#reload();
    }
    weapon.nextFireAt = this.time + weapon.fireInterval;
    if (weapon.magazine !== Infinity) weapon.ammo -= 1;

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    direction.x += (Math.random() - 0.5) * weapon.spread * 2;
    direction.y += (Math.random() - 0.5) * weapon.spread * 2;
    direction.normalize();
    this.raycaster.set(this.camera.position, direction);
    this.raycaster.far = 60;
    const targets = [this.walls, ...this.drones.filter((d) => !d.dying).map((d) => d.group), ...[...this.objectiveMeshes.values()].filter((m) => m.visible)];
    const hits = this.raycaster.intersectObjects(targets, true).filter((candidate) => !candidate.object.isSprite && candidate.object.material?.blending !== THREE.AdditiveBlending);
    const [hit] = hits;
    const end = hit ? hit.point : this.camera.position.clone().addScaledVector(direction, 60);

    const drone = hit?.object.userData.drone;
    if (drone) {
      drone.hp -= weapon.damage;
      drone.body.material.emissiveIntensity = 3;
      this.app.sound.play("hit");
      this.particles.burst(end, { count: 6, colour: 0xffc857, speed: 4, size: 0.12, life: 0.3 });
      this.#hitMarker(drone.hp <= 0);
      if (drone.hp <= 0) this.#killDrone(drone);
    } else if (hit) {
      this.particles.burst(end.clone().addScaledVector(direction, -0.05), { count: 4, colour: weapon.colour, speed: 2.5, size: 0.08, life: 0.25, gravity: 4 });
    }
    this.app.sound.play("shoot");

    const start = new THREE.Vector3(0, 0.008, -0.3).applyMatrix4(this.gun.matrixWorld);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, this.tracerMaterial);
    this.scene.add(line);
    this.tracers.push({ line, until: this.time + 0.05 });
    this.muzzleFlash.scale.setScalar(0.14 + Math.random() * 0.06);
    this.muzzleFlash.material.rotation = Math.random() * Math.PI;
    this.flashUntil = this.time + 0.05;
    if (!this.settings.reducedMotion) {
      this.gunKick = Math.min(1, this.gunKick + 0.5 + weapon.damage * 0.2);
      this.pitch = Math.min(1.45, this.pitch + 0.0025 * weapon.damage);
    }
  }

  #killDrone(drone) {
    drone.dying = 0.3;
    const position = drone.group.position.clone();
    const kills = this.session.recordKill();
    this.app.sound.play("explode");
    this.particles.burst(position, { count: 28, colour: 0xff5470, speed: 6, size: 0.26, life: 0.7 });
    this.particles.burst(position, { count: 10, colour: 0xffc857, speed: 3, size: 0.35, life: 0.45, gravity: 1 });
    this.#feedItem(`BUG SQUASHED · ${kills}`, "kill");
    if (this.session.shield < MAX_SHIELD && Math.random() < ORB_DROP_CHANCE) this.#dropOrb(position);
    setTimeout(() => {
      if (!this.disposed && this.drones.length < this.droneTarget + this.session.alarms) this.#spawnDrone();
    }, 20000);
  }

  /** Shield orbs make combat worth something without ever giving XP: questions remain the only way to score. */
  #dropOrb(position) {
    const mesh = new THREE.Mesh(this.orbGeometry, this.orbMaterial);
    const halo = new THREE.Sprite(this.particles.material(0x6fdc8c));
    halo.scale.setScalar(0.8);
    mesh.add(halo);
    mesh.position.set(position.x, 0.6, position.z);
    this.scene.add(mesh);
    this.orbs.push({ mesh, until: this.time + ORB_LIFETIME, phase: Math.random() * 6 });
  }

  #updateOrbs(dt) {
    for (const orb of [...this.orbs]) {
      orb.mesh.rotation.y += dt * 2;
      orb.mesh.position.y = 0.6 + (this.settings.reducedMotion ? 0 : Math.sin(this.time * 3 + orb.phase) * 0.12);
      const expiring = orb.until - this.time < 4;
      orb.mesh.visible = !expiring || Math.floor(this.time * 6) % 2 === 0;
      const collected = Math.hypot(orb.mesh.position.x - this.position.x, orb.mesh.position.z - this.position.z) < 1 && this.session.shield < MAX_SHIELD;
      if (collected) {
        const before = this.session.shield;
        this.session.heal(ORB_SHIELD);
        this.app.sound.play("pickup");
        this.particles.burst(orb.mesh.position, { count: 14, colour: 0x6fdc8c, speed: 3, size: 0.18, life: 0.5, gravity: -2 });
        this.#feedItem(`+${this.session.shield - before} SHIELD`, "good");
      }
      if (collected || orb.until <= this.time) {
        this.scene.remove(orb.mesh);
        this.orbs = this.orbs.filter((o) => o !== orb);
      }
    }
  }

  #hitMarker(kill) {
    this.crosshair.classList.remove("hit", "kill");
    void this.crosshair.offsetWidth;
    this.crosshair.classList.add(kill ? "kill" : "hit");
  }

  #feedItem(text, kind) {
    // Rewards earned at a question are shown once the player is back in the game, not behind the overlay.
    if (this.state !== "playing") {
      this.pendingFeed.push([text, kind]);
      return;
    }
    const item = h("div", { class: `feed-item feed-${kind}` }, text);
    this.killFeed.prepend(item);
    while (this.killFeed.children.length > 4) this.killFeed.lastChild.remove();
    setTimeout(() => item.remove(), 2600);
  }

  #hurt(amount, from = null) {
    if (this.time < this.effects.invulnerableUntil) return;
    const factor = this.time < this.effects.shieldUntil ? this.effects.shieldFactor : 1;
    const damage = Math.round(amount * factor);
    if (damage <= 0) return;
    const crashed = this.session.takeDamage(damage);
    this.app.sound.play("damage");
    if (from) {
      // Angle of the attacker relative to where the player is looking (0 = straight ahead).
      const dx = from.x - this.position.x;
      const dz = from.z - this.position.z;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const ahead = -sin * dx - cos * dz;
      const right = cos * dx - sin * dz;
      this.damageDir.style.transform = `rotate(${Math.atan2(right, ahead)}rad)`;
      this.damageDir.classList.remove("show");
      void this.damageDir.offsetWidth;
      this.damageDir.classList.add("show");
      clearTimeout(this.damageDirTimer);
      this.damageDirTimer = setTimeout(() => this.damageDir.classList.remove("show"), 900);
    }
    if (!this.settings.reducedMotion) {
      this.shake = Math.min(1, this.shake + 0.5);
      this.damageFlash.classList.remove("flash");
      void this.damageFlash.offsetWidth;
      this.damageFlash.classList.add("flash");
    }
    if (crashed) {
      toast("SYSTEM CRASH – rebooting at spawn with 60 shield.", "error", 3000);
      this.#resetPlayer();
    }
  }

  // ---------- simulation ----------

  #blocked(x, z) {
    for (const [ox, oz] of [[-PLAYER_RADIUS, -PLAYER_RADIUS], [PLAYER_RADIUS, -PLAYER_RADIUS], [-PLAYER_RADIUS, PLAYER_RADIUS], [PLAYER_RADIUS, PLAYER_RADIUS]]) {
      if (isSolid(this.map, toCell(x + ox), toCell(z + oz), this.openDoors)) return true;
    }
    return false;
  }

  #lineOfSight(from, to) {
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.ceil(distance / 0.4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isSolid(this.map, toCell(from.x + (to.x - from.x) * t), toCell(from.z + (to.z - from.z) * t), this.openDoors)) return false;
    }
    return true;
  }

  #updatePlayer(dt, pad) {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) forward += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) forward -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) strafe += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) strafe -= 1;
    forward -= pad.z;
    strafe += pad.x;
    const length = Math.hypot(forward, strafe);
    if (length > 1) {
      forward /= length;
      strafe /= length;
    }
    this.sprinting = this.keys.has("shift") && forward > 0;
    const speed = PLAYER_SPEED * (this.time < this.effects.speedUntil ? this.effects.speedMultiplier : 1) * (this.sprinting ? SPRINT_MULTIPLIER : 1);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = (-sin * forward + cos * strafe) * speed * dt;
    const dz = (-cos * forward - sin * strafe) * speed * dt;
    if (!this.#blocked(this.position.x + dx, this.position.z)) this.position.x += dx;
    if (!this.#blocked(this.position.x, this.position.z + dz)) this.position.z += dz;

    const still = this.settings.reducedMotion;
    const moving = length > 0 ? 1 : 0;
    this.walkCycle = (this.walkCycle ?? 0) + dt * moving * (this.sprinting ? 12 : 9);
    const bob = still ? 0 : Math.sin(this.walkCycle) * 0.03 * moving;
    this.shake = Math.max(0, this.shake - dt * 3);
    const shakeX = still ? 0 : (Math.random() - 0.5) * this.shake * 0.04;
    const shakeY = still ? 0 : (Math.random() - 0.5) * this.shake * 0.04;
    this.camera.position.set(this.position.x, EYE_HEIGHT + bob, this.position.z);
    this.camera.rotation.set(this.pitch + shakeY, this.yaw + shakeX, 0);

    // Weapon sway, recoil, reload dip and weapon-switch raise.
    this.gunKick = Math.max(0, this.gunKick - dt * 8);
    this.switchAnim = Math.max(0, this.switchAnim - dt * 4);
    const reloading = this.weapons[this.weaponIndex].reloadUntil > this.time;
    this.reloadTilt = (this.reloadTilt ?? 0) + ((reloading && !still ? 1 : 0) - (this.reloadTilt ?? 0)) * Math.min(1, dt * 10);
    const sway = still ? 0 : moving;
    this.gun.position.set(
      this.gunRest.x + Math.cos(this.walkCycle * 0.5) * 0.012 * sway,
      this.gunRest.y + Math.abs(Math.sin(this.walkCycle * 0.5)) * 0.01 * sway - this.switchAnim * 0.2 - this.reloadTilt * 0.08 - (this.sprinting && !still ? 0.03 : 0),
      this.gunRest.z + this.gunKick * 0.06,
    );
    this.gun.rotation.set(this.gunKick * 0.12 - this.reloadTilt * 0.5, this.sprinting && !still ? 0.35 : 0, this.reloadTilt * 0.4);
    this.muzzleFlash.visible = this.time < (this.flashUntil ?? 0);
    this.playerLight.position.copy(this.camera.position);
    this.playerLight.intensity = this.muzzleFlash.visible ? 3 : 0.6;

    if ((this.firing || this.padFiring) && !this.sprinting) this.#fire();
    const weapon = this.weapons[this.weaponIndex];
    if (weapon.reloadUntil && weapon.reloadUntil <= this.time && weapon.ammo < weapon.magazine) {
      weapon.ammo = weapon.magazine;
      weapon.reloadUntil = 0;
    }
  }

  #updateDrones(dt) {
    if (!this.flowField || this.time > this.flowFieldAt + 0.4) {
      this.flowField = distanceField(this.map, { x: toCell(this.position.x), y: toCell(this.position.z) }, this.openDoors);
      this.flowFieldAt = this.time;
    }
    for (const drone of [...this.drones]) {
      const position = drone.group.position;
      drone.ring.rotation.z += dt * 2.5;
      drone.body.material.emissiveIntensity += (0.6 - drone.body.material.emissiveIntensity) * Math.min(1, dt * 8);
      if (drone.dying) {
        drone.dying -= dt;
        drone.group.scale.setScalar(Math.max(0.01, drone.dying / 0.3));
        if (drone.dying <= 0) {
          this.#removeDrone(drone);
          this.drones = this.drones.filter((d) => d !== drone);
        }
        continue;
      }
      position.y = EYE_HEIGHT + (this.settings.reducedMotion ? 0 : Math.sin(this.time * 2 + drone.phase) * 0.12);
      if (drone.stunnedUntil > this.time) continue;

      const distance = Math.hypot(position.x - this.position.x, position.z - this.position.z);
      const sees = distance < DRONE_SIGHT && this.#lineOfSight(position, this.position);
      const hunting = sees || this.session.alarms > 0;
      drone.eye.material.color.set(hunting ? 0xff3355 : 0xffc857);
      if (hunting) drone.group.lookAt(this.position.x, position.y, this.position.z);
      let target = null;
      if (hunting && distance > 2.5) {
        const cx = toCell(position.x);
        const cz = toCell(position.z);
        let best = this.flowField.at(cx, cz);
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const value = this.flowField.at(cx + ox, cz + oz);
          if (value < best) {
            best = value;
            target = { x: toWorld(cx + ox), z: toWorld(cz + oz) };
          }
        }
        if (!target && sees) target = { x: this.position.x, z: this.position.z };
      } else if (!hunting) {
        if (!drone.wanderTarget || this.time > drone.wanderUntil) {
          const cx = toCell(position.x);
          const cz = toCell(position.z);
          const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oz]) => !isSolid(this.map, cx + ox, cz + oz, this.openDoors));
          const [ox, oz] = options[Math.floor(Math.random() * options.length)] ?? [0, 0];
          drone.wanderTarget = { x: toWorld(cx + ox), z: toWorld(cz + oz) };
          drone.wanderUntil = this.time + 2 + Math.random() * 2;
        }
        target = drone.wanderTarget;
      }
      if (target) {
        const tx = target.x - position.x;
        const tz = target.z - position.z;
        const length = Math.hypot(tx, tz);
        if (length > 0.05) {
          const step = Math.min(length, DRONE_SPEED * (hunting ? 1 : 0.5) * dt);
          position.x += (tx / length) * step;
          position.z += (tz / length) * step;
        }
      }
      drone.cooldown -= dt;
      if (sees && distance < DRONE_ATTACK_RANGE && drone.cooldown <= 0 && this.time > this.effects.invulnerableUntil) {
        drone.cooldown = this.difficulty.fireInterval * (0.8 + Math.random() * 0.4);
        const mesh = new THREE.Sprite(this.projectileMaterial);
        mesh.scale.setScalar(0.45);
        mesh.position.copy(position);
        const velocity = new THREE.Vector3(this.position.x - position.x, EYE_HEIGHT - 0.2 - position.y, this.position.z - position.z).normalize().multiplyScalar(PROJECTILE_SPEED);
        this.scene.add(mesh);
        this.projectiles.push({ mesh, velocity, life: 3, from: position.clone() });
      }
    }
  }

  #updateProjectiles(dt) {
    for (const projectile of [...this.projectiles]) {
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      projectile.life -= dt;
      const { x, y, z } = projectile.mesh.position;
      let remove = projectile.life <= 0 || isSolid(this.map, toCell(x), toCell(z), this.openDoors);
      if (remove && projectile.life > 0) this.particles.burst(projectile.mesh.position, { count: 5, colour: 0xff5470, speed: 2, size: 0.12, life: 0.3 });
      if (!remove && Math.hypot(x - this.position.x, z - this.position.z) < 0.5 && Math.abs(y - EYE_HEIGHT) < 0.9) {
        this.#hurt(this.difficulty.damage, projectile.from);
        remove = true;
      }
      if (remove) {
        this.scene.remove(projectile.mesh);
        this.projectiles = this.projectiles.filter((p) => p !== projectile);
      }
    }
    for (const tracer of [...this.tracers]) {
      if (tracer.until <= this.time) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        this.tracers = this.tracers.filter((t) => t !== tracer);
      }
    }
  }

  #animateObjectives(dt) {
    for (const objective of this.parsed.objectives) {
      const mesh = this.objectiveMeshes.get(objective.id);
      const part = mesh.userData.part;
      if (objective.kind === "defuse" || objective.kind === "core") part.rotation.y += dt * (objective.kind === "core" && this.session.round.boss ? 1.5 : 0.6);
      if (objective.kind === "core" && this.session.round.boss && !this.settings.reducedMotion) {
        const progress = this.session.roundState.answered / this.session.round.questions;
        part.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06 * (1 - progress));
      }
      if (mesh.userData.fx && !this.settings.reducedMotion) mesh.userData.fx[0].material.opacity = 0.35 + Math.sin(this.time * 3 + objective.x) * 0.12;
      if (objective.kind === "door" && mesh.userData.opening) {
        part.position.y -= dt * 5;
        if (part.position.y < -WALL_HEIGHT / 2) {
          mesh.userData.opening = false;
          mesh.visible = false;
        }
      } else if (objective.kind === "door" && this.openDoors.has(objective.id)) {
        mesh.visible = false;
      }
    }
  }

  // ---------- HUD ----------

  #updateHud() {
    const session = this.session;
    const zone = zoneAt(this.map, toCell(this.position.x), toCell(this.position.z));
    const weapon = this.weapons[this.weaponIndex];
    const time = session.timeRemainingSeconds();
    clear(this.hudTopLeft,
      h("div", { class: "hud-round" }, `ROUND ${session.roundIndex + 1}/${session.mode.rounds.length} · ${session.round.name.toUpperCase()}`),
      h("div", {}, session.round.boss ? `Restore the core: ${session.roundState.answered}/${session.round.questions}` : `Questions answered: ${session.roundState.answered}/${session.round.questions}`),
      h("div", { class: "hud-zone" }, zone ? zone.name : ""),
      h("div", { class: "hud-kills" }, `Bugs squashed: ${session.kills}`),
      session.alarms ? h("div", { class: "hud-alarm" }, `ALARM x${session.alarms} – find a defuse point`) : null);
    clear(this.hudTopRight, time === null ? null : h("div", { class: "hud-time" }, `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`));
    clear(this.hudBottomLeft,
      h("div", {}, `SHIELD ${session.shield}`),
      bar(session.shield, { max: MAX_SHIELD, label: "Shield" }),
      this.time < this.effects.shieldUntil ? h("div", {}, "Barrier active") : null);
    const cooldown = (slot) => Math.max(0, Math.ceil(this.cooldowns[slot] - this.time));
    const ultimate = session.playerClass.ultimate;
    clear(this.hudBottomCentre,
      h("span", { class: `ability ${cooldown("basic") ? "cooling" : ""}` }, `Q ${session.playerClass.basic.name}${cooldown("basic") ? ` ${cooldown("basic")}s` : ""}`),
      h("span", { class: `ability ${cooldown("tactical") ? "cooling" : ""}` }, `F ${session.playerClass.tactical.name}${cooldown("tactical") ? ` ${cooldown("tactical")}s` : ""}`),
      h("span", { class: `ability ${session.ultimateReady || session.pendingAids.size ? "ready" : "cooling"}` }, `X ${ultimate.name} ${session.pendingAids.size ? "ARMED" : `${session.ultimateCharge}/${ultimate.charge}`}`));
    clear(this.hudBottomRight,
      h("div", {}, weapon.name),
      h("div", { class: "hud-ammo" }, weapon.reloadUntil > this.time ? "RELOADING" : weapon.magazine === Infinity ? "∞" : `${weapon.ammo}/${weapon.magazine}`));
    const objective = this.state === "playing" ? this.#nearestObjective() : null;
    const labels = { door: "Unlock door", terminal: "Access terminal", defuse: "Defuse", core: "Restore the core" };
    this.lowShield.classList.toggle("active", session.shield <= 30 && this.state === "playing");
    this.#updateWaypoint();
    this.prompt.textContent = objective ? `[E] ${labels[objective.kind]}${objective.zone ? ` · ${objective.zone.name}` : ""}` : "";
  }

  /** The closest objective that still needs doing, by walking distance so it never points through walls. */
  #waypointTarget() {
    const field = this.flowField;
    let best = null;
    for (const objective of this.parsed.objectives) {
      if (this.session.round.boss ? objective.kind !== "core" : objective.kind === "core") continue;
      if (objective.kind === "door") continue;
      if (this.usedObjectives.has(objective.id)) continue;
      const steps = field ? field.at(objective.x, objective.y) : Math.hypot(objective.x - this.position.x / CELL, objective.y - this.position.z / CELL);
      if (!Number.isFinite(steps)) continue;
      if (!best || steps < best.steps) best = { objective, steps };
    }
    if (best) return best.objective;
    // Everything reachable is used or behind locked doors: point at the nearest locked door.
    let door = null;
    for (const objective of this.parsed.objectives) {
      if (objective.kind !== "door" || this.openDoors.has(objective.id)) continue;
      const distance = Math.hypot(objective.x - this.position.x / CELL, objective.y - this.position.z / CELL);
      if (!door || distance < door.distance) door = { objective, distance };
    }
    return door?.objective ?? null;
  }

  #updateWaypoint() {
    const target = this.state === "playing" ? this.#waypointTarget() : null;
    this.waypoint.hidden = !target;
    if (!target) return;
    const world = new THREE.Vector3(toWorld(target.x), target.kind === "core" ? 1.6 : 1.4, toWorld(target.y));
    const distance = Math.round(Math.hypot(world.x - this.position.x, world.z - this.position.z));
    const projected = world.clone().project(this.camera);
    const behind = projected.z > 1;
    let x = projected.x;
    let y = projected.y;
    if (behind) {
      x = -x;
      y = -y;
    }
    // Keep clear of the HUD panels: less room at the bottom where the ability bar sits.
    const yLimit = y < 0 ? 0.68 : 0.8;
    const offscreen = behind || Math.abs(x) > 0.9 || Math.abs(y) > yLimit;
    if (offscreen) {
      // Clamp to the screen edge in the target's direction.
      const scale = 1 / Math.max(Math.abs(x) / 0.9, Math.abs(y) / yLimit, 1e-6);
      x *= scale;
      y *= scale;
    }
    const colour = target.kind === "defuse" ? "#ff6b6b" : target.kind === "door" ? "#ff9d3d" : this.map.theme.accent;
    this.waypoint.style.left = `${(x + 1) * 50}%`;
    this.waypoint.style.top = `${(1 - y) * 50}%`;
    this.waypoint.style.setProperty("--wp", colour);
    this.waypoint.classList.toggle("offscreen", offscreen);
    this.waypoint.firstChild.style.transform = offscreen ? `rotate(${Math.atan2(x, y)}rad)` : "";
    this.waypoint.lastChild.textContent = `${OBJECTIVE_LABELS[target.kind]} ${distance}m`;
  }

  #drawMinimap() {
    const context = this.minimap.getContext("2d");
    const scale = this.minimapScale;
    this.minimap.classList.toggle("minimap-big", this.bigMap);
    context.clearRect(0, 0, this.minimap.width, this.minimap.height);
    context.drawImage(this.minimapBase, 0, 0);
    const px = this.position.x / CELL;
    const pz = this.position.z / CELL;
    const revealObjectives = this.time < this.effects.revealObjectivesUntil || this.bigMap;
    for (const objective of this.parsed.objectives) {
      const near = Math.hypot(objective.x - px, objective.y - pz) < 7;
      if (objective.kind === "door") {
        if (this.openDoors.has(objective.id)) continue;
        context.fillStyle = "#ff9d3d";
      } else {
        if (!near && !revealObjectives) continue;
        if (objective.kind === "core" && !this.session.round.boss) continue;
        const used = this.usedObjectives.has(objective.id);
        context.fillStyle = used ? "#555" : { terminal: this.map.theme.accent, defuse: "#ff6b6b", core: "#ffffff" }[objective.kind];
      }
      context.fillRect(objective.x * scale + 1, objective.y * scale + 1, scale - 2, scale - 2);
    }
    if (this.time < this.effects.revealEnemiesUntil) {
      context.fillStyle = "#ff5470";
      for (const drone of this.drones) {
        context.beginPath();
        context.arc((drone.group.position.x / CELL) * scale, (drone.group.position.z / CELL) * scale, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.fillStyle = "#6fdc8c";
    for (const orb of this.orbs) context.fillRect((orb.mesh.position.x / CELL) * scale - 1.5, (orb.mesh.position.z / CELL) * scale - 1.5, 3, 3);
    context.save();
    context.translate(px * scale, pz * scale);
    context.rotate(-this.yaw);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(0, -5);
    context.lineTo(3.5, 4);
    context.lineTo(-3.5, 4);
    context.closePath();
    context.fill();
    context.restore();
  }

  // ---------- loop ----------

  #loop(now) {
    if (this.disposed) return;
    this.frame = requestAnimationFrame((t) => this.#loop(t));
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const pad = this.#pollGamepad(dt);

    if (this.state === "playing") {
      this.time += dt;
      this.#updatePlayer(dt, pad);
      this.#updateDrones(dt);
      this.#updateProjectiles(dt);
      this.#updateOrbs(dt);
      this.particles.update(dt);
      if (this.session.timeRemainingSeconds() === 0) {
        this.state = "ended";
        this.handlers.timeUp();
      }
    } else {
      this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    }
    this.#animateObjectives(dt);
    this.hudTimer = (this.hudTimer ?? 0) - dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.#updateHud();
      this.#drawMinimap();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    for (const remove of this.listeners) remove();
    this.resizeObserver?.disconnect();
    if (document.pointerLockElement) document.exitPointerLock();
    for (const drone of this.drones) this.#removeDrone(drone);
    for (const tracer of this.tracers) tracer.line.geometry.dispose();
    this.particles?.dispose();
    for (const item of this.disposables) item.dispose?.();
    this.walls?.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}
