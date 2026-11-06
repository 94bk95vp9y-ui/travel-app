/**
 * Platzhalter für „three/webgpu“.
 * globe.gl/three-globe importieren WebGPU nur für Funktionen, die Fernweh nicht nutzt
 * (Heatmap-Berechnung, WebGPU-Renderer). Ohne diesen Platzhalter würde eine zweite,
 * komplette Kopie von three.js im Bundle landen (~1 MB).
 */
const disabled = () => {
  throw new Error('WebGPU ist in Fernweh deaktiviert.');
};

export class WebGPURenderer {
  constructor() {
    disabled();
  }
}

export class StorageInstancedBufferAttribute {
  constructor() {
    disabled();
  }
}
