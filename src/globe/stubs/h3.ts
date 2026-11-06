/**
 * Platzhalter für „h3-js“ (Sechseck-Raster). Wird nur von Hexbin-Layern genutzt,
 * die Fernweh nicht verwendet. Spart ~500 KB im Bundle.
 */
const disabled = (): never => {
  throw new Error('H3-Sechseck-Layer sind in Fernweh deaktiviert.');
};

export const latLngToCell = disabled;
export const cellToLatLng = disabled;
export const cellToBoundary = disabled;
export const polygonToCells = disabled;
