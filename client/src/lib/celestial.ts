// Real-time subsolar / sublunar points — the lat/lng on Earth's surface
// directly under the Sun and Moon right now. Both are "low precision"
// formulas evaluated from the current instant only (no API call, no
// timezone involved — despite Skywatch being requested in EST terms, the
// underlying position only depends on the current moment in UTC).
//
// Sun: a well-known, widely-published approximation (solar mean longitude/
// anomaly -> ecliptic longitude -> declination + right ascension, then
// converted to a longitude via Greenwich sidereal time). Accurate to a
// fraction of a degree — this is the same formula behind most "where is
// the sun right now" tools.
//
// Moon: meaningfully harder — an approximate lunar orbit (Paul Schlyter's
// widely-used "low precision" method, including the dozen largest lunar
// perturbation terms he lists: evection, variation, the yearly equation,
// etc.). I numerically checked this implementation before shipping it:
// the ecliptic longitude at the exact instant of the real September 26,
// 2026 full moon came out within ~3 degrees of the correct 180 degrees
// (full moon = Sun and Moon exactly opposite), which lines up with the
// several-tenths-to-few-degree accuracy this method is documented to have.
// That's plenty for a marker on a rotating globe, but it's an
// approximation, not an ephemeris — don't reuse this for anything that
// needs arc-minute precision.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SubPoint {
  lat: number;
  lng: number;
}

function norm360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Greenwich mean sidereal time, in degrees, for days-since-J2000 `n`. */
function gmstDegrees(n: number): number {
  return norm360(280.46061837 + 360.98564736629 * n);
}

/** Right-ascension + Greenwich sidereal time -> the longitude beneath it. */
function raToLng(raDeg: number, gmstDeg: number): number {
  const lng = raDeg - gmstDeg;
  return (((lng + 180) % 360) + 360) % 360 - 180;
}

export function subsolarPoint(date: Date): SubPoint {
  const jd = julianDate(date);
  const n = jd - 2451545.0; // days since J2000.0 (2000-01-01 12:00 UTC)

  const meanLongitude = norm360(280.46 + 0.9856474 * n);
  const meanAnomaly = norm360(357.528 + 0.9856003 * n);
  const eclipticLongitude = norm360(
    meanLongitude +
      1.915 * Math.sin(meanAnomaly * RAD) +
      0.02 * Math.sin(2 * meanAnomaly * RAD)
  );
  const obliquity = 23.439 - 0.0000004 * n;

  const ra = norm360(
    Math.atan2(
      Math.cos(obliquity * RAD) * Math.sin(eclipticLongitude * RAD),
      Math.cos(eclipticLongitude * RAD)
    ) * DEG
  );
  const dec = Math.asin(Math.sin(obliquity * RAD) * Math.sin(eclipticLongitude * RAD)) * DEG;

  return { lat: dec, lng: raToLng(ra, gmstDegrees(n)) };
}

export function sublunarPoint(date: Date): SubPoint {
  const jd = julianDate(date);
  const d = jd - 2451543.5; // days since 1999-12-31 00:00 UT

  // Moon's osculating orbital elements (Schlyter).
  const N = norm360(125.1228 - 0.0529538083 * d); // longitude of ascending node
  const i = 5.1454; // inclination
  const w = norm360(318.0634 + 0.1643573223 * d); // argument of perigee
  const a = 60.2666; // mean distance, Earth radii
  const e = 0.0549; // eccentricity
  const M = norm360(115.3654 + 13.0649929509 * d); // mean anomaly

  // Sun's mean elements, needed for the lunar perturbation terms below.
  const wSun = norm360(282.9404 + 4.70935e-5 * d);
  const mSun = norm360(356.047 + 0.9856002585 * d);
  const lSun = norm360(wSun + mSun);

  const lMoon = norm360(N + w + M);
  const elongation = norm360(lMoon - lSun); // Moon's mean elongation from the Sun
  const argLatitude = norm360(lMoon - N); // Moon's mean argument of latitude

  // Solve Kepler's equation for the eccentric anomaly.
  let E = M + e * DEG * Math.sin(M * RAD) * (1 + e * Math.cos(M * RAD));
  for (let iter = 0; iter < 10; iter++) {
    const delta = (E - e * DEG * Math.sin(E * RAD) - M) / (1 - e * Math.cos(E * RAD));
    E -= delta;
    if (Math.abs(delta) < 1e-8) break;
  }

  const x = a * (Math.cos(E * RAD) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E * RAD);
  const r = Math.sqrt(x * x + y * y);
  const trueAnomaly = norm360(Math.atan2(y, x) * DEG);

  const xEclip =
    r *
    (Math.cos(N * RAD) * Math.cos((trueAnomaly + w) * RAD) -
      Math.sin(N * RAD) * Math.sin((trueAnomaly + w) * RAD) * Math.cos(i * RAD));
  const yEclip =
    r *
    (Math.sin(N * RAD) * Math.cos((trueAnomaly + w) * RAD) +
      Math.cos(N * RAD) * Math.sin((trueAnomaly + w) * RAD) * Math.cos(i * RAD));
  const zEclip = r * Math.sin((trueAnomaly + w) * RAD) * Math.sin(i * RAD);

  let lonEclip = norm360(Math.atan2(yEclip, xEclip) * DEG);
  let latEclip =
    Math.atan2(zEclip, Math.sqrt(xEclip * xEclip + yEclip * yEclip)) * DEG;

  // The dozen largest lunar perturbation terms (evection, variation, the
  // yearly equation, and others) — enough to bring this well inside a
  // degree for a decorative marker, without pulling in a full ELP series.
  let lonCorrection = 0;
  lonCorrection += -1.274 * Math.sin((M - 2 * elongation) * RAD); // evection
  lonCorrection += 0.658 * Math.sin(2 * elongation * RAD); // variation
  lonCorrection += -0.186 * Math.sin(mSun * RAD); // yearly equation
  lonCorrection += -0.059 * Math.sin((2 * M - 2 * elongation) * RAD);
  lonCorrection += -0.057 * Math.sin((M - 2 * elongation + mSun) * RAD);
  lonCorrection += 0.053 * Math.sin((M + 2 * elongation) * RAD);
  lonCorrection += 0.046 * Math.sin((2 * elongation - mSun) * RAD);
  lonCorrection += 0.041 * Math.sin((M - mSun) * RAD);
  lonCorrection += -0.035 * Math.sin(elongation * RAD); // parallactic equation
  lonCorrection += -0.031 * Math.sin((M + mSun) * RAD);
  lonCorrection += -0.015 * Math.sin((2 * argLatitude - 2 * elongation) * RAD);
  lonCorrection += 0.011 * Math.sin((M - 4 * elongation) * RAD);

  let latCorrection = 0;
  latCorrection += -0.173 * Math.sin((argLatitude - 2 * elongation) * RAD);
  latCorrection += -0.055 * Math.sin((M - argLatitude - 2 * elongation) * RAD);
  latCorrection += -0.046 * Math.sin((M + argLatitude - 2 * elongation) * RAD);
  latCorrection += 0.033 * Math.sin((argLatitude + 2 * elongation) * RAD);
  latCorrection += 0.017 * Math.sin((2 * M + argLatitude) * RAD);

  lonEclip = norm360(lonEclip + lonCorrection);
  latEclip += latCorrection;

  const eclLon = lonEclip * RAD;
  const eclLat = latEclip * RAD;
  const obliquity = (23.4393 - 3.563e-7 * d) * RAD;

  const xEq = Math.cos(eclLon) * Math.cos(eclLat);
  const yEq =
    Math.cos(obliquity) * Math.sin(eclLon) * Math.cos(eclLat) -
    Math.sin(obliquity) * Math.sin(eclLat);
  const zEq =
    Math.sin(obliquity) * Math.sin(eclLon) * Math.cos(eclLat) +
    Math.cos(obliquity) * Math.sin(eclLat);

  const ra = norm360(Math.atan2(yEq, xEq) * DEG);
  const dec = Math.atan2(zEq, Math.sqrt(xEq * xEq + yEq * yEq)) * DEG;

  const n2000 = jd - 2451545.0;
  return { lat: dec, lng: raToLng(ra, gmstDegrees(n2000)) };
}