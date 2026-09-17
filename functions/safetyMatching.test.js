const test = require('node:test');
const assert = require('node:assert/strict');
const {
  rankTutorsWithProximityAndFairness,
} = require('./index');

test('soft same-gender matching prioritizes matching tutors within the same proximity tier', () => {
  const studentLoc = { latitude: -33.9249, longitude: 18.4241 }; // Cape Town CBD

  const closeMaleTutor = {
    uid: 'tutor_close_male',
    gender: 'male',
    location: { latitude: -33.9300, longitude: 18.4300 }, // ~0.8 km
    tutorProfile: { overallRating: 4.9 },
  };

  const closeFemaleTutor = {
    uid: 'tutor_close_female',
    gender: 'female',
    location: { latitude: -33.9310, longitude: 18.4310 }, // ~1.0 km (same 0-5km bucket)
    tutorProfile: { overallRating: 4.8 },
  };

  const midFemaleTutor = {
    uid: 'tutor_mid_female',
    gender: 'female',
    location: { latitude: -33.9800, longitude: 18.4700 }, // ~7.5 km (5-15km bucket)
    tutorProfile: { overallRating: 5.0 },
  };

  const candidates = [closeMaleTutor, closeFemaleTutor, midFemaleTutor];

  const rankedForFemale = rankTutorsWithProximityAndFairness(candidates, studentLoc, {
    preferSameGenderTutor: true,
    studentGender: 'female',
  });

  // In the 0-5km bucket: closeFemaleTutor should be boosted ahead of closeMaleTutor
  assert.equal(rankedForFemale[0], 'tutor_close_female');
  assert.equal(rankedForFemale[1], 'tutor_close_male');
  // Proximity tier takes precedence over gender boost: midFemaleTutor is in 5-15km bucket so comes third
  assert.equal(rankedForFemale[2], 'tutor_mid_female');
});

test('soft matching falls back cleanly without excluding tutors when no gender match exists', () => {
  const studentLoc = { latitude: -33.9249, longitude: 18.4241 };

  const tutorA = {
    uid: 'tutor_a_male',
    gender: 'male',
    location: { latitude: -33.9300, longitude: 18.4300 },
    tutorProfile: { overallRating: 4.8 },
  };
  const tutorB = {
    uid: 'tutor_b_male',
    gender: 'male',
    location: { latitude: -33.9350, longitude: 18.4350 },
    tutorProfile: { overallRating: 4.9 },
  };

  const candidates = [tutorA, tutorB];

  // Requesting female tutor when only male tutors are available
  const ranked = rankTutorsWithProximityAndFairness(candidates, studentLoc, {
    preferSameGenderTutor: true,
    studentGender: 'female',
  });

  // Must not return empty list or filter out tutors
  assert.equal(ranked.length, 2);
  assert.ok(ranked.includes('tutor_a_male'));
  assert.ok(ranked.includes('tutor_b_male'));
});

test('neutral ranking when preferSameGenderTutor is false or omitted', () => {
  const studentLoc = { latitude: -33.9249, longitude: 18.4241 };

  const tutorMale = {
    uid: 'tutor_male',
    gender: 'male',
    location: { latitude: -33.9300, longitude: 18.4300 },
    tutorProfile: { overallRating: 5.0 },
  };
  const tutorFemale = {
    uid: 'tutor_female',
    gender: 'female',
    location: { latitude: -33.9300, longitude: 18.4300 },
    tutorProfile: { overallRating: 5.0 },
  };

  const rankedOmitted = rankTutorsWithProximityAndFairness([tutorMale, tutorFemale], studentLoc);
  assert.equal(rankedOmitted.length, 2);

  const rankedDisabled = rankTutorsWithProximityAndFairness([tutorMale, tutorFemale], studentLoc, {
    preferSameGenderTutor: false,
    studentGender: 'female',
  });
  assert.equal(rankedDisabled.length, 2);
});

test('accepts safetySnapshot nested structure in options', () => {
  const studentLoc = { latitude: -33.9249, longitude: 18.4241 };

  const tutorMale = {
    uid: 'male_1',
    gender: 'male',
    location: { latitude: -33.9300, longitude: 18.4300 },
    tutorProfile: { overallRating: 4.7 },
  };
  const tutorFemale = {
    uid: 'female_1',
    gender: 'female',
    location: { latitude: -33.9310, longitude: 18.4310 },
    tutorProfile: { overallRating: 4.7 },
  };

  const ranked = rankTutorsWithProximityAndFairness([tutorMale, tutorFemale], studentLoc, {
    safetySnapshot: {
      isMinor: true,
      guardianPresenceRequired: true,
      preferSameGenderTutor: true,
      studentGender: 'female',
    },
  });

  assert.equal(ranked[0], 'female_1');
  assert.equal(ranked[1], 'male_1');
});

test('resolves gender across tutor.gender, tutor.tutorProfile.gender, and personalDetails.gender', () => {
  const studentLoc = null; // Test fallback without location

  const tutorTopLevel = {
    uid: 'tutor_top',
    gender: 'female',
    tutorProfile: { overallRating: 4.5 },
  };
  const tutorProfileLevel = {
    uid: 'tutor_profile',
    tutorProfile: { gender: 'female', overallRating: 4.6 },
  };
  const tutorDetailsLevel = {
    uid: 'tutor_details',
    personalDetails: { gender: 'male' },
    tutorProfile: { overallRating: 5.0 }, // higher rating, but different gender
  };

  const candidates = [tutorDetailsLevel, tutorTopLevel, tutorProfileLevel];

  const ranked = rankTutorsWithProximityAndFairness(candidates, studentLoc, {
    preferSameGenderTutor: true,
    studentGender: 'female',
  });

  assert.equal(ranked.length, 3);
  // The two female tutors should be ranked before the male tutor, even though male tutor has higher rating
  assert.equal(ranked[2], 'tutor_details');
  const topTwoUids = [ranked[0], ranked[1]];
  assert.ok(topTwoUids.includes('tutor_top'));
  assert.ok(topTwoUids.includes('tutor_profile'));
});
