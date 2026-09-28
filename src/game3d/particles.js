import * as THREE from "three";

/**
 * Pooled additive sprites for sparks, explosions and pickups. Particles shrink rather than fade,
 * so sprites of one colour can share a material (fewer draw-state changes on school PCs).
 */
export class Particles {
  constructor(scene, texture, { max = 220 } = {}) {
    this.scene = scene;
    this.texture = texture;
    this.max = max;
    this.materials = new Map();
    this.live = [];
    this.pool = [];
  }

  material(colour) {
    const key = new THREE.Color(colour).getHex();
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.SpriteMaterial({
        map: this.texture, color: key, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }));
    }
    return this.materials.get(key);
  }

  /**
   * @param {THREE.Vector3} origin
   * @param {{ count?: number, colour?: any, speed?: number, size?: number, life?: number, gravity?: number, spread?: THREE.Vector3 }} options
   */
  burst(origin, { count = 12, colour = 0xffffff, speed = 4, size = 0.18, life = 0.5, gravity = 6, direction = null } = {}) {
    const material = this.material(colour);
    for (let i = 0; i < count; i++) {
      if (this.live.length >= this.max) this.#release(this.live[0]);
      const sprite = this.pool.pop() ?? new THREE.Sprite(material);
      sprite.material = material;
      sprite.position.copy(origin);
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.65));
      if (direction) velocity.addScaledVector(direction, speed * 0.6);
      const particleLife = life * (0.6 + Math.random() * 0.6);
      this.live.push({ sprite, velocity, life: particleLife, total: particleLife, size: size * (0.6 + Math.random() * 0.8), gravity });
      sprite.scale.setScalar(size);
      this.scene.add(sprite);
    }
  }

  #release(particle) {
    this.scene.remove(particle.sprite);
    this.pool.push(particle.sprite);
    this.live.splice(this.live.indexOf(particle), 1);
  }

  update(dt) {
    for (const particle of [...this.live]) {
      particle.life -= dt;
      if (particle.life <= 0) {
        this.#release(particle);
        continue;
      }
      particle.velocity.y -= particle.gravity * dt;
      particle.velocity.multiplyScalar(1 - Math.min(1, dt * 2.5));
      particle.sprite.position.addScaledVector(particle.velocity, dt);
      if (particle.sprite.position.y < 0.03) {
        particle.sprite.position.y = 0.03;
        particle.velocity.y *= -0.35;
      }
      particle.sprite.scale.setScalar(particle.size * (particle.life / particle.total));
    }
  }

  dispose() {
    for (const particle of this.live) this.scene.remove(particle.sprite);
    this.live = [];
    this.pool = [];
    for (const material of this.materials.values()) material.dispose();
  }
}
