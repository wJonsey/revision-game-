import * as THREE from "three";

/**
 * Procedural textures drawn on 2D canvases, so the game ships no image files
 * (works when CDNs and asset hosts are blocked) and every map can be re-tinted.
 */

function canvasTexture(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const shade = (hex, factor) => {
  const colour = new THREE.Color(hex);
  colour.multiplyScalar(factor);
  return `#${colour.getHexString()}`;
};

/** Seeded so every wall looks the same on every PC and between frames. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Sci-fi wall panel: two stacked plates, rivets, a lit strip and faint circuit traces. */
export function wallTexture(theme) {
  return canvasTexture(256, (g, s) => {
    const random = seeded(7);
    g.fillStyle = shade(theme.wall, 1.25);
    g.fillRect(0, 0, s, s);
    // Plates.
    for (const [y, h] of [[6, 150], [162, 88]]) {
      const gradient = g.createLinearGradient(0, y, 0, y + h);
      gradient.addColorStop(0, shade(theme.wall, 1.55));
      gradient.addColorStop(1, shade(theme.wall, 1.0));
      g.fillStyle = gradient;
      g.fillRect(6, y, s - 12, h);
      g.strokeStyle = shade(theme.wall, 0.55);
      g.lineWidth = 3;
      g.strokeRect(6, y, s - 12, h);
      g.fillStyle = shade(theme.wall, 0.6);
      for (const [rx, ry] of [[16, y + 10], [s - 16, y + 10], [16, y + h - 10], [s - 16, y + h - 10]]) {
        g.beginPath();
        g.arc(rx, ry, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Circuit traces.
    g.strokeStyle = theme.accent;
    g.globalAlpha = 0.18;
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      let x = 20 + random() * (s - 40);
      let y = 20 + random() * 120;
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        if (j % 2 === 0) x += (random() - 0.5) * 80;
        else y += random() * 30;
        g.lineTo(Math.max(12, Math.min(s - 12, x)), Math.min(150, y));
      }
      g.stroke();
      g.beginPath();
      g.arc(Math.max(12, Math.min(s - 12, x)), Math.min(150, y), 3, 0, Math.PI * 2);
      g.fillStyle = theme.accent;
      g.fill();
    }
    g.globalAlpha = 1;
    // Lit strip between the plates.
    g.fillStyle = theme.accent;
    g.globalAlpha = 0.85;
    g.fillRect(6, 157, s - 12, 3);
    g.globalAlpha = 1;
  });
}

/** Emissive mask for the wall: only the strip and traces glow. */
export function wallGlowTexture(theme) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, s, s);
    g.fillStyle = theme.accent;
    g.fillRect(6, 156, s - 12, 5);
  });
}

/** Floor tiles with bevelled seams and occasional hazard markings. */
export function floorTexture(theme, repeat) {
  return canvasTexture(256, (g, s) => {
    const random = seeded(11);
    g.fillStyle = shade(theme.floor, 1.9);
    g.fillRect(0, 0, s, s);
    const tile = s / 2;
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const x = tx * tile;
        const y = ty * tile;
        g.fillStyle = shade(theme.floor, 2.2 + random() * 0.35);
        g.fillRect(x + 3, y + 3, tile - 6, tile - 6);
        g.strokeStyle = shade(theme.floor, 3.2);
        g.lineWidth = 1;
        g.strokeRect(x + 4.5, y + 4.5, tile - 9, tile - 9);
        // Grip dots.
        g.fillStyle = shade(theme.floor, 1.4);
        for (let i = 0; i < 18; i++) g.fillRect(x + 12 + random() * (tile - 24), y + 12 + random() * (tile - 24), 2, 2);
      }
    }
    // Seams glow faintly with the accent colour.
    g.strokeStyle = theme.accent;
    g.globalAlpha = 0.35;
    g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.beginPath();
    g.moveTo(s / 2, 0);
    g.lineTo(s / 2, s);
    g.moveTo(0, s / 2);
    g.lineTo(s, s / 2);
    g.stroke();
    g.globalAlpha = 1;
  }, { repeat });
}

/** Ceiling: dark grille with light panels. */
export function ceilingTexture(theme, repeat) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = shade(theme.wall, 0.55);
    g.fillRect(0, 0, s, s);
    g.strokeStyle = shade(theme.wall, 0.9);
    g.lineWidth = 2;
    for (let i = 0; i <= s; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, s);
      g.moveTo(0, i);
      g.lineTo(s, i);
      g.stroke();
    }
    g.fillStyle = theme.light;
    g.globalAlpha = 0.9;
    g.fillRect(40, 58, 48, 12);
    g.globalAlpha = 1;
  }, { repeat });
}

/** Soft round glow used for halos, muzzle flash, projectiles and particles (additive blending). */
export function glowTexture() {
  return canvasTexture(64, (g, s) => {
    const gradient = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.75)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, s, s);
  });
}

/** Vertical fade for objective light beams. */
export function beamTexture() {
  return canvasTexture(8, (g, s) => {
    const gradient = g.createLinearGradient(0, s, 0, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, s, s);
  });
}

/** Terminal screen with lines of fake code in the accent colour. */
export function screenTexture(theme) {
  return canvasTexture(128, (g, s) => {
    const random = seeded(3);
    g.fillStyle = shade(theme.accent, 0.18);
    g.fillRect(0, 0, s, s);
    g.fillStyle = theme.accent;
    for (let y = 12; y < s - 8; y += 10) {
      let x = 10 + Math.floor(random() * 3) * 8;
      while (x < s - 16 && random() > 0.15) {
        const width = 6 + random() * 22;
        g.globalAlpha = 0.5 + random() * 0.5;
        g.fillRect(x, y, Math.min(width, s - 10 - x), 4);
        x += width + 5;
      }
    }
    g.globalAlpha = 1;
    g.strokeStyle = theme.accent;
    g.lineWidth = 4;
    g.strokeRect(2, 2, s - 4, s - 4);
  }, { srgb: true });
}

/** Locked blast door: hazard stripes around a lit lock panel. */
export function doorTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = "#3a2a14";
    g.fillRect(0, 0, s, s);
    g.save();
    g.beginPath();
    g.rect(0, 0, s, 18);
    g.rect(0, s - 18, s, 18);
    g.clip();
    for (let x = -s; x < s * 2; x += 20) {
      g.fillStyle = "#ff9d3d";
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 10, 0);
      g.lineTo(x + 10 + s, s);
      g.lineTo(x + s, s);
      g.fill();
    }
    g.restore();
    g.strokeStyle = "#1e1408";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(s / 2, 18);
    g.lineTo(s / 2, s - 18);
    g.stroke();
    g.fillStyle = "#ff9d3d";
    g.fillRect(s / 2 - 14, s / 2 - 10, 28, 20);
    g.fillStyle = "#1e1408";
    g.fillRect(s / 2 - 8, s / 2 - 4, 16, 8);
  });
}
