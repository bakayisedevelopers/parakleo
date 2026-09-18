import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';
import { updateLiveTracking } from './liveTrackingRealtimeService';
import { decodePolyline } from '../utils/polyline';

function normalizeCoordinate(coordinate = null) {
  const latitude = Number(coordinate?.latitude ?? coordinate?.lat);
  const longitude = Number(coordinate?.longitude ?? coordinate?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

/**
 * Direct client-side road routing fallback using Open Source Routing Machine (OSRM).
 */
async function fetchDirectRoadRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ParakleoTutors/1.0',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (data?.code !== 'Ok' || !Array.isArray(data?.routes) || !data.routes.length) {
    return null;
  }

  const primary = data.routes[0];
  const encodedPolyline = primary.geometry || '';
  const decodedPoints = decodePolyline(encodedPolyline);

  return {
    distanceMeters: Math.round(Number(primary.distance || 0)),
    durationSeconds: Math.round(Number(primary.duration || 0)),
    encodedPolyline,
    overviewEncodedPolyline: encodedPolyline,
    routeCoordinates: decodedPoints.length >= 2 ? decodedPoints : [origin, destination],
    routeProvider: 'osrm',
  };
}

export async function fetchLiveRoute({
  requestId = '',
  origin,
  destination,
}) {
  const routeOrigin = normalizeCoordinate(origin);
  const routeDestination = normalizeCoordinate(destination);

  if (!routeOrigin || !routeDestination) {
    return null;
  }

  let routeResult = null;

  // 1. Try Cloud Function getDirectionsRoute first
  try {
    const { auth } = getFirebaseClients();
    const token = await auth.currentUser?.getIdToken().catch(() => null);

    if (token) {
      const response = await fetch(getFunctionEndpoint('getDirectionsRoute'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          origin: routeOrigin,
          destination: routeDestination,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.success && payload?.route) {
        const rawRoute = payload.route;
        let routeCoordinates = [];

        if (rawRoute.encodedPolyline || rawRoute.overviewPolyline) {
          routeCoordinates = decodePolyline(rawRoute.encodedPolyline || rawRoute.overviewPolyline);
        } else if (Array.isArray(rawRoute.routeCoordinates)) {
          routeCoordinates = rawRoute.routeCoordinates.map(normalizeCoordinate).filter(Boolean);
        }

        routeResult = {
          ...rawRoute,
          routeCoordinates: routeCoordinates.length >= 2 ? routeCoordinates : [routeOrigin, routeDestination],
          encodedPolyline: rawRoute.encodedPolyline || rawRoute.overviewPolyline || '',
        };
      }
    }
  } catch (fnErr) {
    console.warn('[directionsRouteService] Cloud Function call skipped/failed, using direct road route:', fnErr?.message);
  }

  // 2. Direct client fallback for road polyline
  if (!routeResult || !Array.isArray(routeResult.routeCoordinates) || routeResult.routeCoordinates.length < 2) {
    try {
      const directRoute = await fetchDirectRoadRoute(routeOrigin, routeDestination);
      if (directRoute) {
        routeResult = directRoute;
      }
    } catch (directErr) {
      console.warn('[directionsRouteService] Direct road route failed:', directErr?.message);
    }
  }

  // 3. If route was successfully computed and requestId exists, save routeSnapshot to RTDB
  if (routeResult && requestId) {
    updateLiveTracking(requestId, {
      routeSnapshot: {
        encodedPolyline: routeResult.encodedPolyline || '',
        overviewEncodedPolyline: routeResult.overviewEncodedPolyline || routeResult.encodedPolyline || '',
        distanceMeters: routeResult.distanceMeters,
        durationSeconds: routeResult.durationSeconds,
        routeProvider: routeResult.routeProvider || 'google_routes',
        lastRouteOrigin: routeOrigin,
        lastDestination: routeDestination,
        lastSuccessfulRouteFetchAtMs: Date.now(),
      },
      distanceRemainingMeters: routeResult.distanceMeters,
      etaSeconds: routeResult.durationSeconds,
      updatedAtMs: Date.now(),
    }).catch(() => null);
  }

  return routeResult;
}
