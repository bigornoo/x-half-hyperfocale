/* Model: thin lens, distances from its principal plane; all inputs in mm. */
(function (root) {
  'use strict';
  const FOCAL_MM = 10.8;
  const APERTURES = Object.freeze([2.8, 4, 5.6, 8, 11]);
  const CIRCLES = Object.freeze([0.011, 0.008, 0.005]);
  function calculate(aperture, circle) {
    if (!APERTURES.includes(aperture) || !CIRCLES.includes(circle)) {
      throw new RangeError('Ouverture ou cercle de confusion non proposé.');
    }
    const hyperfocalMm = FOCAL_MM * FOCAL_MM / (aperture * circle) + FOCAL_MM;
    // Dnear = s(H-f)/(H+s-2f). At s=H, Dnear = H/2, exactly in this model.
    return Object.freeze({ hyperfocalM: hyperfocalMm / 1000, nearM: hyperfocalMm / 2000, farM: Infinity });
  }
  const api = Object.freeze({ FOCAL_MM, APERTURES, CIRCLES, calculate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hyperfocal = api;
})(globalThis);
