/**
 * Decodes an encoded polyline string (Google Polyline Algorithm format)
 * into an array of { latitude, longitude } coordinate objects.
 * Compatible with Google Routes API, Directions API, and OSRM encoded geometries.
 *
 * @param {string} encoded - Encoded polyline string.
 * @returns {Array<{latitude: number, longitude: number}>} Decoded coordinates array.
 */
export function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      latitude: Number((lat / 1e5).toFixed(6)),
      longitude: Number((lng / 1e5).toFixed(6)),
    });
  }

  return points;
}
