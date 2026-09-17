const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeHaversineDistanceKm,
  rankTutorsWithProximityAndFairness,
} = require('./index');

test('computeHaversineDistanceKm calculates Great-circle distance accurately', () => {
  // Cape Town CBD (-33.9249, 18.4241) to Sea Point (-33.9167, 18.3889) ~ 3.36 km
  const capeTownCbd = { latitude: -33.9249, longitude: 18.4241 };
  const seaPoint = { latitude: -33.9167, longitude: 18.3889 };
  const distCapeTown = computeHaversineDistanceKm(capeTownCbd, seaPoint);
  assert.ok(distCapeTown >= 3.0 && distCapeTown <= 3.6, `Expected ~3.3 km, got ${distCapeTown}`);

  // Johannesburg (-26.2041, 28.0473) to Pretoria (-25.7479, 28.2293) ~ 53.6 km
  const jhb = { latitude: -26.2041, longitude: 28.0473 };
  const pta = { latitude: -25.7479, longitude: 28.2293 };
  const distJhbPta = computeHaversineDistanceKm(jhb, pta);
  assert.ok(distJhbPta >= 50 && distJhbPta <= 58, `Expected ~53.6 km, got ${distJhbPta}`);

  // Zero distance for identical coordinates
  const zero = computeHaversineDistanceKm(capeTownCbd, capeTownCbd);
  assert.equal(zero, 0);

  // Invalid coordinates return null
  assert.equal(computeHaversineDistanceKm(null, capeTownCbd), null);
  assert.equal(computeHaversineDistanceKm(capeTownCbd, {}), null);
  assert.equal(computeHaversineDistanceKm({ latitude: 'invalid' }, capeTownCbd), null);
});

test('rankTutorsWithProximityAndFairness prioritizes closer tutors across radial distance buckets', () => {
  const studentLoc = { latitude: -33.9249, longitude: 18.4241 }; // Cape Town CBD

  const closeTutor = {
    uid: 'tutor_close_2km',
    location: { latitude: -33.9300, longitude: 18.4300 }, // ~0.8 km away
    tutorProfile: { overallRating: 4.8 },
  };

  const midTutor = {
    uid: 'tutor_mid_10km',
    location: { latitude: -33.9800, longitude: 18.4700 }, // ~7.5 km away
    tutorProfile: { overallRating: 4.9 },
  };

  const farTutor = {
    uid: 'tutor_far_35km',
    location: { latitude: -34.1500, longitude: 18.8500 }, // ~45 km away
    tutorProfile: { overallRating: 5.0 },
  };

  const noLocationTutor = {
    uid: 'tutor_no_loc',
    tutorProfile: { overallRating: 5.0 },
  };

  // Pass tutors in reverse order
  const candidates = [farTutor, noLocationTutor, midTutor, closeTutor];
  const ranked = rankTutorsWithProximityAndFairness(candidates, studentLoc);

  // Close tutor (<5km) must be ranked ahead of mid tutor (5-15km) and far tutor (30-50km)
  assert.equal(ranked[0], 'tutor_close_2km', 'Close tutor should be first in dispatch queue');
  assert.equal(ranked[1], 'tutor_mid_10km', 'Mid tutor should be second');
  assert.equal(ranked[2], 'tutor_far_35km', 'Far tutor should be third');
  assert.equal(ranked[3], 'tutor_no_loc', 'Tutor without location should be queued last');
});

test('rankTutorsWithProximityAndFairness falls back gracefully when student location is null', () => {
  const tutorA = {
    uid: 'tutor_a',
    tutorProfile: { overallRating: 5.0, acceptanceRate: 1.0, completionRate: 1.0 },
  };
  const tutorB = {
    uid: 'tutor_b',
    tutorProfile: { overallRating: 3.0, acceptanceRate: 0.5, completionRate: 0.5 },
  };

  const ranked = rankTutorsWithProximityAndFairness([tutorB, tutorA], null);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0], 'tutor_a', 'Higher rated tutor ranked first when no location is provided');
});
