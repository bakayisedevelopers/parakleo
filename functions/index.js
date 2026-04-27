const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const vision = require('@google-cloud/vision');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const { randomUUID } = require('crypto');
const {
  DEFAULT_PRICING_CONFIG,
  LEGACY_SAFE_PRICING_SNAPSHOT,
  computePricingQuote,
  computeFinalAmountFromSnapshot,
  loadPricingConfig,
  sanitizePricingSnapshot,
} = require('./pricingEngine');
const {
  normalizeSubjectName,
} = require('./subjectExtraction');
const {
  convertPdfToImages,
  extractSubjectsWithAI,
  classifySubjectWithAI,
} = require('./aiSubjectExtraction');

admin.initializeApp();

const db = admin.firestore();

const CLAXI_PAYMENTS_SECRETS = defineSecret('CLAXI_PAYMENTS_SECRETS');
const CLAXI_EMAIL_SECRETS = defineSecret('CLAXI_EMAIL_SECRETS');
const CLAXI_REALTIME_SECRETS = defineSecret('CLAXI_REALTIME_SECRETS');

const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const EMAIL_FROM = defineSecret('EMAIL_FROM');
const CLOUDFLARE_TURN_KEY_ID = defineSecret('CLOUDFLARE_TURN_KEY_ID');
const CLOUDFLARE_TURN_API_TOKEN = defineSecret('CLOUDFLARE_TURN_API_TOKEN');
const CLOUDFLARE_TURN_TTL_SECONDS = defineSecret('CLOUDFLARE_TURN_TTL_SECONDS');

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
const DEFAULT_TURN_TTL_SECONDS = 600;
const MATCHING_TIMEOUT_MS = 3 * 60 * 1000;
const OFFER_TIMEOUT_MS = 30 * 1000;
const DISPATCH_SCORE_WEIGHTS = {
  acceptanceRate: 0.20,
  completionRate: 0.20,
  rating: 0.20,
  responseSpeed: 0.15,
  reliability: 0.15,
  fairness: 0.10,
};
const DISPATCH_NEAR_EQUAL_THRESHOLD = 2;
const DEFAULT_ACCEPTANCE_RATE = 0.75;
const DEFAULT_COMPLETION_RATE = 0.9;
const DEFAULT_RATING = 4.5;
const DEFAULT_AVG_RESPONSE_SECONDS = 30;
const DEFAULT_CANCELLATION_RATE = 0.08;
const FAIRNESS_WORKLOAD_CAP = 10;
const DEFAULT_STUDENT_FREE_MINUTES = 30;
const REFERRAL_REWARD_MINUTES = 30;
const REQUEST_STATUS = {
  PENDING: 'pending',
  MATCHING: 'matching',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  IN_SESSION: 'in_session',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  CANCELED_DURING: 'canceled_during',
  EXPIRED: 'expired',
  NO_TUTOR_AVAILABLE: 'no_tutor_available',
};
const ACTIVE_REQUEST_STATUSES = new Set([
  REQUEST_STATUS.PENDING,
  REQUEST_STATUS.MATCHING,
  REQUEST_STATUS.OFFERED,
  REQUEST_STATUS.NO_TUTOR_AVAILABLE,
]);
let visionClient = null;

function getVisionClient() {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient();
  }
  return visionClient;
}

function normalizeMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextOfferRevision(request = {}) {
  const current = Number(request.offerRevision || 0);
  if (!Number.isFinite(current) || current < 0) return 1;
  return Math.floor(current) + 1;
}

function isRequestExpired(request) {
  const createdAtMs = normalizeMillis(request?.createdAt);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs >= MATCHING_TIMEOUT_MS;
}

function getTutorScore(tutor = {}) {
  const acceptanceRate = normalizeRate(
    tutor?.tutorProfile?.acceptanceRate
      ?? tutor?.acceptanceRate
      ?? tutor?.stats?.acceptanceRate,
    DEFAULT_ACCEPTANCE_RATE,
  );
  const completionRate = normalizeRate(
    tutor?.tutorProfile?.completionRate
      ?? tutor?.completionRate
      ?? tutor?.stats?.completionRate,
    DEFAULT_COMPLETION_RATE,
  );
  const rating = normalizeRating(
    tutor?.tutorProfile?.overallRating
      ?? tutor?.overallRating
      ?? tutor?.rating
      ?? tutor?.stats?.overallRating,
    DEFAULT_RATING,
  );
  const avgResponseSeconds = normalizePositiveNumber(
    tutor?.tutorProfile?.avgResponseSeconds
      ?? tutor?.avgResponseSeconds
      ?? tutor?.stats?.avgResponseSeconds,
    DEFAULT_AVG_RESPONSE_SECONDS,
  );
  const cancellationRate = normalizeRate(
    tutor?.tutorProfile?.cancellationRate
      ?? tutor?.cancellationRate
      ?? tutor?.stats?.cancellationRate,
    DEFAULT_CANCELLATION_RATE,
  );
  const recentAssignmentsCount = normalizePositiveNumber(
    tutor?.tutorProfile?.recentAssignmentsCount
      ?? tutor?.recentAssignmentsCount
      ?? tutor?.tutorProfile?.completedSessionsLast24Hours
      ?? tutor?.stats?.recentAssignmentsCount,
    0,
  );

  const responseSpeedScore = 1 - clamp01(avgResponseSeconds / 120);
  const reliabilityScore = 1 - clamp01(cancellationRate);
  const fairnessScore = 1 - clamp01(recentAssignmentsCount / FAIRNESS_WORKLOAD_CAP);

  return (
    (acceptanceRate * DISPATCH_SCORE_WEIGHTS.acceptanceRate)
    + (completionRate * DISPATCH_SCORE_WEIGHTS.completionRate)
    + ((rating / 5) * DISPATCH_SCORE_WEIGHTS.rating)
    + (responseSpeedScore * DISPATCH_SCORE_WEIGHTS.responseSpeed)
    + (reliabilityScore * DISPATCH_SCORE_WEIGHTS.reliability)
    + (fairnessScore * DISPATCH_SCORE_WEIGHTS.fairness)
  ) * 100;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeRate(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric > 1) return clamp01(numeric / 100);
  return clamp01(numeric);
}

function normalizeRating(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(5, numeric));
}

function normalizePositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

function hasCompletedStudentProfile(user = {}) {
  const studentProfile = user?.studentProfile || {};
  const paymentMethods = Array.isArray(user?.paymentMethods) ? user.paymentMethods : [];

  return Boolean(
    studentProfile.grade
      && String(studentProfile.curriculum || '').trim()
      && String(studentProfile.discoverySource || '').trim()
      && paymentMethods.length > 0,
  );
}

function isTruthyFlag(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'paused', 'blocked', 'suspended', 'disabled'].includes(normalized);
}

function isTutorDispatchEligible(tutor = {}, subjectKey) {
  const normalizedSubjects = (tutor.activeSubjects || tutor.subjects || []).map((entry) => String(entry || '').trim().toLowerCase());
  const isDispatchPaused = isTruthyFlag(
    tutor.dispatchPaused
      ?? tutor.isDispatchPaused
      ?? tutor?.tutorProfile?.dispatchPaused
      ?? tutor?.tutorProfile?.isDispatchPaused
      ?? tutor?.tutorProfile?.pausedFromDispatch,
  );
  const isSuspendedOrBlocked = isTruthyFlag(
    tutor.suspended
      ?? tutor.isSuspended
      ?? tutor.blocked
      ?? tutor.isBlocked
      ?? tutor?.tutorProfile?.suspended
      ?? tutor?.tutorProfile?.blocked,
  );

  return tutor?.tutorProfile?.verificationStatus === 'verified'
    && !tutor.activeSessionId
    && normalizedSubjects.includes(subjectKey)
    && !isDispatchPaused
    && !isSuspendedOrBlocked;
}

function getLastOfferAtMillis(tutor = {}) {
  return normalizeMillis(tutor?.tutorProfile?.lastOfferAt ?? tutor?.lastOfferAt);
}

function getRecentAssignmentsCount(tutor = {}) {
  return normalizePositiveNumber(
    tutor?.tutorProfile?.recentAssignmentsCount
      ?? tutor?.recentAssignmentsCount
      ?? tutor?.tutorProfile?.completedSessionsLast24Hours
      ?? 0,
    0,
  );
}

function randomIndex(max) {
  return Math.floor(Math.random() * Math.max(1, max));
}

function hasArrayChanged(before = [], after = []) {
  return JSON.stringify(before || []) !== JSON.stringify(after || []);
}

function normalizeActiveSubjects(values = []) {
  const seen = new Set();
  return values
    .map((value) => normalizeSubjectName(value) || String(value || '').trim())
    .filter(Boolean)
    .filter((subject) => {
      const key = subject.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildQualifiedSubjects(extractedSubjects = []) {
  return extractedSubjects.filter((item) => Number(item.mark) >= 60);
}

async function mergeTutorQualifiedSubjects({ uid, docId, qualifiedSubjects }) {
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};
    const existingQualified = Array.isArray(user.qualifiedSubjects) ? user.qualifiedSubjects : [];
    const bySubject = new Map();
    const now = new Date().toISOString();

    existingQualified.forEach((item) => {
      if (!item?.subject) return;
      bySubject.set(item.subject, item);
    });

    qualifiedSubjects.forEach((item) => {
      const subject = normalizeSubjectName(item.subject) || item.subject;
      const mark = Number(item.mark || 0);
      const existing = bySubject.get(subject);
      if (!existing || mark > Number(existing.mark || 0)) {
        bySubject.set(subject, {
          subject,
          mark,
          sourceDocumentId: docId,
          updatedAt: now,
        });
      }
    });

    const nextQualifiedSubjects = [...bySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject));
    const qualifiedNames = nextQualifiedSubjects.map((item) => item.subject);
    const existingActive = normalizeActiveSubjects(user.activeSubjects || user.subjects || []);
    const nextActiveSubjects = normalizeActiveSubjects([...existingActive, ...qualifiedSubjects.map((item) => item.subject)])
      .filter((subject) => qualifiedNames.includes(subject));

    transaction.set(userRef, {
      qualifiedSubjects: nextQualifiedSubjects,
      activeSubjects: nextActiveSubjects,
      subjects: nextActiveSubjects,
      tutorProfile: {
        ...(user.tutorProfile || {}),
        verificationStatus: nextQualifiedSubjects.length ? 'verified' : 'pending',
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function refreshGlobalSubjects() {
  const tutorsSnap = await db.collection('users').where('activeRole', '==', 'tutor').get();
  const counts = new Map();

  tutorsSnap.docs.forEach((docSnap) => {
    const qualifiedSubjects = Array.isArray(docSnap.data().qualifiedSubjects)
      ? docSnap.data().qualifiedSubjects.map((item) => item?.subject || '')
      : [];
    const uniqueSubjects = [...new Set(normalizeActiveSubjects(qualifiedSubjects))];
    uniqueSubjects.forEach((subject) => {
      counts.set(subject, (counts.get(subject) || 0) + 1);
    });
  });

  const subjects = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tutorCount]) => ({
      name,
      tutorCount,
      updatedAt: new Date().toISOString(),
    }));

  await db.collection('system').doc('subjects').set({
    subjects,
    subjectNames: subjects.map((subject) => subject.name),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return subjects;
}

function rankTutorsWithFairness(candidates = []) {
  const remaining = [...candidates]
    .map((tutor) => ({
      tutor,
      score: getTutorScore(tutor),
      lastOfferAtMs: getLastOfferAtMillis(tutor),
      recentAssignmentsCount: getRecentAssignmentsCount(tutor),
    }))
    .sort((a, b) => b.score - a.score);

  const ordered = [];

  while (remaining.length) {
    const highestScore = remaining[0].score;
    const bucket = remaining.filter((entry) => (highestScore - entry.score) <= DISPATCH_NEAR_EQUAL_THRESHOLD);

    const oldestLastOfferAt = bucket.reduce(
      (min, entry) => Math.min(min, entry.lastOfferAtMs || 0),
      Number.POSITIVE_INFINITY,
    );
    const leastRecentlyOffered = bucket.filter((entry) => (entry.lastOfferAtMs || 0) === oldestLastOfferAt);

    const smallestRecentAssignments = leastRecentlyOffered.reduce(
      (min, entry) => Math.min(min, entry.recentAssignmentsCount),
      Number.POSITIVE_INFINITY,
    );
    const leastAssigned = leastRecentlyOffered.filter(
      (entry) => entry.recentAssignmentsCount === smallestRecentAssignments,
    );

    const picked = leastAssigned[randomIndex(leastAssigned.length)];
    ordered.push(picked.tutor.uid);

    const removeIndex = remaining.findIndex((entry) => entry.tutor.uid === picked.tutor.uid);
    if (removeIndex >= 0) {
      remaining.splice(removeIndex, 1);
    } else {
      break;
    }
  }

  return ordered;
}

async function getTutorQueueForSubject(subject) {
  const subjectKey = String(subject || 'Mathematics').trim().toLowerCase();
  const snapshot = await db
    .collection('users')
    .where('activeRole', '==', 'tutor')
    .where('onlineStatus', '==', 'online')
    .get();

  const eligibleTutors = snapshot.docs
    .map((item) => ({ uid: item.id, ...item.data() }))
    .filter((tutor) => isTutorDispatchEligible(tutor, subjectKey));

  return rankTutorsWithFairness(eligibleTutors);
}

exports.syncClassRequestLifecycle = onDocumentWritten('classRequests/{requestId}', async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : null;
  if (!afterData) return;

  if (!ACTIVE_REQUEST_STATUSES.has(afterData.status) || afterData.tutorId) {
    return;
  }

  const requestId = event.params.requestId;
  const requestRef = db.collection('classRequests').doc(requestId);
  const candidateQueue = await getTutorQueueForSubject(afterData.subject);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (!snap.exists) return;
    const request = snap.data();

    if (!ACTIVE_REQUEST_STATUSES.has(request.status) || request.tutorId) {
      return;
    }

    if (isRequestExpired(request)) {
      transaction.update(requestRef, {
        status: REQUEST_STATUS.EXPIRED,
        statusDetail: 'Request expired because no tutor accepted in time.',
        tutorQueue: [],
        currentOfferTutorId: null,
        offerExpiresAt: null,
        offerToken: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    if (
      request.status === REQUEST_STATUS.OFFERED
      && request.currentOfferTutorId
      && normalizeMillis(request.offerExpiresAt) > Date.now()
    ) {
      return;
    }

    let queue = Array.isArray(candidateQueue) ? [...candidateQueue] : [];

    if (request.status === REQUEST_STATUS.OFFERED && request.currentOfferTutorId) {
      queue = queue.filter((id) => id !== request.currentOfferTutorId);
    }

    if (!queue.length) {
      transaction.update(requestRef, {
        status: REQUEST_STATUS.NO_TUTOR_AVAILABLE,
        statusDetail: 'No tutor accepted. Looking for another tutor.',
        tutorQueue: [],
        currentOfferTutorId: null,
        offerExpiresAt: null,
        offerToken: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const offerRevision = nextOfferRevision(request);
    const selectedTutorId = queue[0];
    const selectedTutorRef = db.collection('users').doc(selectedTutorId);
    transaction.update(requestRef, {
      status: REQUEST_STATUS.OFFERED,
      statusDetail: 'Tutor notified. Waiting for acceptance.',
      tutorQueue: queue,
      currentOfferTutorId: selectedTutorId,
      offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
      lastOfferAt: Date.now(),
      offerRevision,
      offerToken: randomUUID(),
      retryOfferGranted: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(selectedTutorRef, {
      lastOfferAt: admin.firestore.FieldValue.serverTimestamp(),
      tutorProfile: {
        lastOfferAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
});

async function processTutorDocumentRecord({ docId, data = {} }) {
  const docRef = db.collection('tutorDocuments').doc(docId);

  if (!data.uid || !data.filePath) {
    await docRef.set({
      status: 'FAILED',
      error: 'Document record is missing uid or filePath.',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  await docRef.set({
    status: 'PROCESSING',
    error: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(data.filePath);
    const [documentBuffer] = await file.download();
    const images = await convertPdfToImages(documentBuffer);
    const extractedSubjects = await extractSubjectsWithAI(images);

    if (!extractedSubjects.length) {
      await docRef.set({
        extractedSubjects: [],
        qualifiedSubjects: [],
        status: 'FAILED',
        error: 'No subjects detected',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const qualifiedSubjects = buildQualifiedSubjects(extractedSubjects);

    await docRef.set({
      extractedSubjects,
      qualifiedSubjects,
      status: 'VERIFIED',
      error: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await mergeTutorQualifiedSubjects({
      uid: data.uid,
      docId,
      qualifiedSubjects,
    });
    await refreshGlobalSubjects();

    logger.info('Tutor document processed.', {
      docId,
      uid: data.uid,
      extractedSubjectCount: extractedSubjects.length,
      qualifiedSubjectCount: qualifiedSubjects.length,
    });
  } catch (error) {
    logger.error('Tutor document processing failed.', {
      docId,
      uid: data.uid,
      error: error.message,
    });
    await docRef.set({
      status: 'FAILED',
      error: error.message || 'Document processing failed.',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

exports.processTutorDocument = onDocumentCreated('tutorDocuments/{docId}', async (event) => {
  const docId = event.params.docId;
  const data = event.data?.data() || {};
  await processTutorDocumentRecord({ docId, data });
});

exports.retryTutorDocumentProcessing = onDocumentWritten('tutorDocuments/{docId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!before || !after) return;
  if (String(after.status || '').toUpperCase() !== 'UPLOADED') return;
  if (String(before.status || '').toUpperCase() === 'UPLOADED') return;

  await processTutorDocumentRecord({
    docId: event.params.docId,
    data: after,
  });
});

exports.updateGlobalSubjects = onDocumentWritten('users/{uid}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : {};
  const after = event.data.after.exists ? event.data.after.data() : {};
  const wasTutor = before.activeRole === 'tutor' || (before.roles || []).includes('tutor');
  const isTutor = after.activeRole === 'tutor' || (after.roles || []).includes('tutor');

  if (!wasTutor && !isTutor) return;

  const changed = hasArrayChanged(before.activeSubjects, after.activeSubjects)
    || hasArrayChanged(before.qualifiedSubjects, after.qualifiedSubjects);
  if (!changed) return;

  await refreshGlobalSubjects();
});

exports.refreshGlobalSubjectsOnTutorChange = exports.updateGlobalSubjects;

function sanitizeCloudflareIceServers(iceServers) {
  if (!Array.isArray(iceServers)) return [];

  return iceServers
    .map((server) => {
      const urls = Array.isArray(server?.urls)
        ? server.urls.filter(Boolean)
        : [server?.urls].filter(Boolean);

      const filteredUrls = urls.filter((url) => !String(url).includes(':53'));

      if (!filteredUrls.length) return null;

      return {
        urls: filteredUrls,
        ...(server?.username ? { username: server.username } : {}),
        ...(server?.credential ? { credential: server.credential } : {}),
        ...(server?.credentialType ? { credentialType: server.credentialType } : {}),
      };
    })
    .filter(Boolean);
}

function parseTurnTtlSeconds(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_TURN_TTL_SECONDS;
  return Math.max(60, Math.min(172800, Math.floor(parsed)));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmailTemplate({
  eyebrow = 'Claxi',
  title,
  intro,
  details = [],
  tone = 'emerald',
  closing = 'Thanks for learning with Claxi.',
}) {
  const accent = tone === 'rose'
    ? { solid: '#f43f5e', soft: '#ffe4e6', glow: 'rgba(244, 63, 94, 0.22)' }
    : tone === 'sky'
      ? { solid: '#38bdf8', soft: '#e0f2fe', glow: 'rgba(56, 189, 248, 0.22)' }
      : { solid: '#10b981', soft: '#d1fae5', glow: 'rgba(16, 185, 129, 0.22)' };

  const detailMarkup = details.length
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px; border-collapse: separate; border-spacing: 0 10px;">
        ${details.map((item) => `
          <tr>
            <td style="width: 38%; padding: 12px 14px; border-radius: 14px 0 0 14px; background: rgba(255,255,255,0.04); color: #a1a1aa; font-size: 13px; letter-spacing: 0.02em;">
              ${escapeHtml(item.label)}
            </td>
            <td style="padding: 12px 14px; border-radius: 0 14px 14px 0; background: rgba(255,255,255,0.07); color: #f4f4f5; font-size: 13px; font-weight: 600;">
              ${escapeHtml(item.value)}
            </td>
          </tr>
        `).join('')}
      </table>
    `
    : '';

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #09090b; font-family: Inter, Arial, sans-serif; color: #f4f4f5;">
        <div style="background:
          radial-gradient(circle at 12% 20%, ${accent.glow}, transparent 34%),
          radial-gradient(circle at 82% 6%, rgba(99, 102, 241, 0.18), transparent 40%),
          linear-gradient(180deg, #09090b 0%, #0f172a 100%);
          padding: 32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; border-collapse: separate;">
            <tr>
              <td style="padding-bottom: 18px; text-align: center;">
                <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #e4e4e7; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;">
                  ${escapeHtml(eyebrow)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid rgba(255,255,255,0.08); background: rgba(24,24,27,0.88); box-shadow: 0 20px 40px rgba(2,6,23,0.45); border-radius: 28px; padding: 32px;">
                <div style="height: 6px; width: 88px; border-radius: 999px; background: ${accent.solid}; margin-bottom: 22px;"></div>
                <h1 style="margin: 0 0 12px; color: #fafafa; font-size: 28px; line-height: 1.2; font-weight: 800;">
                  ${escapeHtml(title)}
                </h1>
                <p style="margin: 0; color: #d4d4d8; font-size: 15px; line-height: 1.7;">
                  ${escapeHtml(intro)}
                </p>
                ${detailMarkup}
                <div style="margin-top: 28px; padding: 16px 18px; border-radius: 18px; background: ${accent.soft}; color: #111827; font-size: 14px; line-height: 1.6;">
                  ${escapeHtml(closing)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 14px; text-align: center; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                Claxi session notifications
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
}

function buildEmailPayload(eventType, payload) {
  switch (eventType) {
    case 'welcome':
      return {
        to: payload.email,
        subject: `Welcome to Claxi, ${payload.fullName}!`,
        html: renderEmailTemplate({
          eyebrow: 'Welcome',
          title: `Welcome to Claxi, ${payload.fullName || 'there'}`,
          intro: `Your ${payload.role || 'Claxi'} account is ready. You can now manage requests, sessions, and payments from one place.`,
          details: [
            { label: 'Account type', value: payload.role || 'User' },
          ],
        }),
      };
    case 'request_created':
      return {
        to: payload.studentEmail,
        subject: 'Your class request is live',
        html: renderEmailTemplate({
          eyebrow: 'Request live',
          title: 'Your class request is now live',
          intro: `Your ${payload.subject || 'class'} request has been posted and is now visible to tutors.`,
          details: [
            { label: 'Subject', value: payload.subject || 'Class request' },
          ],
        }),
      };
    case 'request_accepted':
      return {
        to: payload.studentEmail,
        subject: 'A tutor accepted your request',
        html: renderEmailTemplate({
          eyebrow: 'Tutor found',
          title: 'A tutor accepted your request',
          intro: `${payload.tutorName || 'A tutor'} accepted your ${payload.subject || 'class'} request.`,
          details: [
            { label: 'Tutor', value: payload.tutorName || 'Tutor' },
            { label: 'Subject', value: payload.subject || 'Class request' },
          ],
        }),
      };
    case 'session_scheduled':
      return {
        to: [payload.studentEmail, payload.tutorEmail],
        subject: `Session scheduled: ${payload.subject}`,
        html: renderEmailTemplate({
          eyebrow: 'Session scheduled',
          title: `Session scheduled: ${payload.subject || 'Class'}`,
          intro: 'Your session has been scheduled and is ready for both participants.',
          details: [
            { label: 'Date', value: payload.scheduledDate || 'To be confirmed' },
            { label: 'Time', value: payload.scheduledTime || 'To be confirmed' },
            { label: 'Link', value: payload.meetingLink || 'To be added' },
          ],
          tone: 'sky',
        }),
      };
    case 'session_updated':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session update: ${payload.subject}`,
        html: renderEmailTemplate({
          eyebrow: 'Session update',
          title: `Session update: ${payload.subject || 'Class'}`,
          intro: `This session has been updated and is now marked as ${payload.status || 'updated'}.`,
          details: [
            { label: 'Status', value: payload.status || 'Updated' },
          ],
          tone: 'sky',
        }),
      };
    case 'session_completed':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session completed: ${payload.subject}`,
        html: renderEmailTemplate({
          eyebrow: 'Session completed',
          title: `Session completed: ${payload.subject || 'Class'}`,
          intro: 'This session has been marked as completed and the billing flow has been finalized.',
          details: [
            { label: 'Topic', value: payload.topic || payload.subject || 'Session' },
            { label: 'Amount', value: `R${Number(payload.amount || 0).toFixed(2)}` },
            { label: 'Payment status', value: payload.paymentStatus || 'Processed' },
          ],
        }),
      };
    case 'cancellation':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session canceled: ${payload.subject}`,
        html: renderEmailTemplate({
          eyebrow: 'Session canceled',
          title: `Session canceled: ${payload.subject || 'Class'}`,
          intro: 'This session has been canceled. Check the app for the latest session status and billing outcome.',
          details: [
            { label: 'Subject', value: payload.subject || 'Class' },
          ],
          tone: 'rose',
          closing: 'If this was unexpected, review the session details in Claxi.',
        }),
      };
    default:
      return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring('Bearer '.length).trim();
}

function normalizeExtractedText(rawText) {
  return String(rawText || '').replace(/\s+/g, ' ').trim();
}

function parseGroupedSecretJson(name, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Grouped secret JSON must be an object.');
    }
    return parsed;
  } catch (error) {
    logger.warn('Grouped secret JSON is missing or invalid; falling back to legacy secrets.', {
      secretName: name,
      error: error.message,
    });
    return {};
  }
}

function pickSecretValue(groupedSecrets, key, fallbackSecret) {
  const groupedValue = groupedSecrets?.[key];
  if (typeof groupedValue === 'string' && groupedValue.trim()) {
    return groupedValue.trim();
  }

  const fallbackValue = fallbackSecret.value();
  if (typeof fallbackValue === 'string' && fallbackValue.trim()) {
    return fallbackValue.trim();
  }

  return '';
}

function assertRequiredSecrets(groupName, secrets, requiredKeys) {
  const missingKeys = requiredKeys.filter((key) => !secrets[key]);
  if (missingKeys.length) {
    throw new Error(`${groupName} is missing required field(s): ${missingKeys.join(', ')}`);
  }
}

function getPaymentsSecrets() {
  const groupedSecrets = parseGroupedSecretJson(
    'CLAXI_PAYMENTS_SECRETS',
    CLAXI_PAYMENTS_SECRETS.value(),
  );
  const secrets = {
    PAYSTACK_SECRET_KEY: pickSecretValue(groupedSecrets, 'PAYSTACK_SECRET_KEY', PAYSTACK_SECRET_KEY),
  };

  assertRequiredSecrets('CLAXI_PAYMENTS_SECRETS', secrets, ['PAYSTACK_SECRET_KEY']);
  return secrets;
}

function getEmailSecrets() {
  const groupedSecrets = parseGroupedSecretJson('CLAXI_EMAIL_SECRETS', CLAXI_EMAIL_SECRETS.value());
  const secrets = {
    RESEND_API_KEY: pickSecretValue(groupedSecrets, 'RESEND_API_KEY', RESEND_API_KEY),
    EMAIL_FROM: pickSecretValue(groupedSecrets, 'EMAIL_FROM', EMAIL_FROM),
  };

  assertRequiredSecrets('CLAXI_EMAIL_SECRETS', secrets, ['RESEND_API_KEY', 'EMAIL_FROM']);
  return secrets;
}

function getRealtimeSecrets() {
  const groupedSecrets = parseGroupedSecretJson(
    'CLAXI_REALTIME_SECRETS',
    CLAXI_REALTIME_SECRETS.value(),
  );
  const secrets = {
    CLOUDFLARE_TURN_KEY_ID: pickSecretValue(
      groupedSecrets,
      'CLOUDFLARE_TURN_KEY_ID',
      CLOUDFLARE_TURN_KEY_ID,
    ),
    CLOUDFLARE_TURN_API_TOKEN: pickSecretValue(
      groupedSecrets,
      'CLOUDFLARE_TURN_API_TOKEN',
      CLOUDFLARE_TURN_API_TOKEN,
    ),
    CLOUDFLARE_TURN_TTL_SECONDS: pickSecretValue(
      groupedSecrets,
      'CLOUDFLARE_TURN_TTL_SECONDS',
      CLOUDFLARE_TURN_TTL_SECONDS,
    ),
  };

  assertRequiredSecrets('CLAXI_REALTIME_SECRETS', secrets, [
    'CLOUDFLARE_TURN_KEY_ID',
    'CLOUDFLARE_TURN_API_TOKEN',
  ]);
  return secrets;
}

function applyFreeMinuteDiscount({ originalPrice, durationMinutes, freeMinutesRemaining }) {
  const safeOriginalPrice = Math.max(0, Number(originalPrice || 0));
  const safeDurationMinutes = Math.max(1, Number(durationMinutes || 1));
  const availableFreeMinutes = Math.max(0, Number(freeMinutesRemaining || 0));
  const freeMinutesApplied = Math.min(availableFreeMinutes, safeDurationMinutes);
  const discountRatio = freeMinutesApplied > 0 ? (freeMinutesApplied / safeDurationMinutes) : 0;
  const discountApplied = Number((safeOriginalPrice * discountRatio).toFixed(2));
  const finalPrice = Number(Math.max(0, safeOriginalPrice - discountApplied).toFixed(2));

  return {
    originalPrice: Number(safeOriginalPrice.toFixed(2)),
    requestedDurationMinutes: safeDurationMinutes,
    freeMinutesApplied: Number(freeMinutesApplied.toFixed(2)),
    discountApplied,
    finalPrice,
    discountSource: freeMinutesApplied > 0 ? 'free_minutes' : null,
  };
}

async function getPricingSignalContext(subject) {
  const [activeRequestsSnap, onlineTutorsSnap, verifiedTutorsSnap] = await Promise.all([
    db.collection('classRequests').where('status', 'in', ['pending', 'matching', 'offered', 'no_tutor_available']).get(),
    db.collection('users').where('activeRole', '==', 'tutor').where('onlineStatus', '==', 'online').get(),
    db.collection('users').where('activeRole', '==', 'tutor').where('tutorProfile.verificationStatus', '==', 'verified').get(),
  ]);

  return {
    now: new Date(),
    subject,
    activeRequests: activeRequestsSnap.size,
    onlineTutors: onlineTutorsSnap.size,
    verifiedTutors: verifiedTutorsSnap.size,
  };
}

exports.getPricingQuote = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const durationMinutes = Math.max(1, Math.floor(Number(req.body?.durationMinutes || 0)));
  const subject = String(req.body?.subject || 'general').trim();
  if (!durationMinutes) {
    res.status(400).json({ success: false, message: 'durationMinutes is required.' });
    return;
  }

  const config = await loadPricingConfig(db, DEFAULT_PRICING_CONFIG);
  const signalContext = await getPricingSignalContext(subject).catch(() => ({ now: new Date(), subject }));
  const quote = computePricingQuote({
    minutes: durationMinutes,
    subject,
    signalContext,
    config,
  });
  const studentSnap = await db.collection('users').doc(decoded.uid).get();
  const studentData = studentSnap.data() || {};
  const freeMinutePreview = applyFreeMinuteDiscount({
    originalPrice: quote.totalAmount,
    durationMinutes,
    freeMinutesRemaining: studentData.freeMinutesRemaining || 0,
  });

  const quotedAt = new Date();
  const lockExpiresAt = new Date(quotedAt.getTime() + (Number(config.quoteTtlSeconds || 300) * 1000));
  const quoteRef = db.collection('pricingQuotes').doc();
  const quotePayload = {
    ...quote,
    ...freeMinutePreview,
    quoteId: quoteRef.id,
    quotedAt: quotedAt.toISOString(),
    lockedAt: quotedAt.toISOString(),
    lockExpiresAt: lockExpiresAt.toISOString(),
    signalContext: {
      activeRequests: signalContext.activeRequests ?? null,
      onlineTutors: signalContext.onlineTutors ?? null,
      verifiedTutors: signalContext.verifiedTutors ?? null,
    },
    requestContext: {
      studentId: decoded.uid,
      durationMinutes,
      subject,
      freeMinutesRemaining: Number(studentData.freeMinutesRemaining || 0),
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(lockExpiresAt),
  };

  await quoteRef.set(quotePayload);
  logger.info('pricing_quote_generated', {
    quoteId: quoteRef.id,
    userId: decoded.uid,
    band: quote.pricingBand,
    totalAmount: quote.totalAmount,
    durationMinutes,
    subject: quote.subject,
    configVersion: quote.configVersion,
  });

  res.status(200).json({ success: true, quote: sanitizePricingSnapshot(quotePayload) });
});

exports.extractImageOcr = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const objectPath = String(req.body?.objectPath || '').trim();
  const fileName = String(req.body?.fileName || '').trim() || null;
  const mimeType = String(req.body?.mimeType || '').trim() || null;
  const imageBase64 = String(req.body?.imageBase64 || '').trim();
  const sourceLabel = objectPath || fileName || 'inline-image';

  logger.info('image_ocr_invoked', {
    uid: decoded.uid,
    source: sourceLabel,
    hasObjectPath: Boolean(objectPath),
    hasInlineImage: Boolean(imageBase64),
    mimeType,
  });

  if (!objectPath && !imageBase64) {
    res.status(400).json({ success: false, message: 'Missing image source for OCR.' });
    return;
  }

  if (objectPath) {
    const [, ownerUid] = objectPath.split('/');
    if (!ownerUid || ownerUid !== decoded.uid) {
      logger.warn('image_ocr_forbidden_path', {
        uid: decoded.uid,
        objectPath,
      });
      res.status(403).json({ success: false, message: 'You are not allowed to OCR this image.' });
      return;
    }
  }

  try {
    let imageBuffer;
    if (objectPath) {
      const bucket = admin.storage().bucket();
      const [bytes] = await bucket.file(objectPath).download();
      imageBuffer = bytes;
    } else {
      imageBuffer = Buffer.from(imageBase64, 'base64');
    }

    const [ocrResponse] = await getVisionClient().documentTextDetection({
      image: { content: imageBuffer },
    });

    const rawText = ocrResponse?.fullTextAnnotation?.text || ocrResponse?.textAnnotations?.[0]?.description || '';
    const extractedText = normalizeExtractedText(rawText);
    const textLength = extractedText.length;

    logger.info('image_ocr_completed', {
      uid: decoded.uid,
      source: sourceLabel,
      success: textLength > 0,
      textLength,
      provider: 'google-vision',
    });

    res.status(200).json({
      success: textLength > 0,
      extractedText,
      textLength,
      extractionMethod: 'ocr',
      provider: 'google-vision',
    });
  } catch (error) {
    logger.error('image_ocr_failed', {
      uid: decoded.uid,
      source: sourceLabel,
      error: error?.message || 'unknown_error',
    });
    res.status(500).json({
      success: false,
      extractedText: '',
      textLength: 0,
      extractionMethod: 'ocr',
      provider: 'google-vision',
      message: 'Image OCR failed.',
    });
  }
});

exports.classifySubject = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const inputText = normalizeExtractedText(req.body?.inputText || '');
  const supportedSubjects = Array.isArray(req.body?.supportedSubjects)
    ? req.body.supportedSubjects
      .map((subject) => ({
        value: normalizeExtractedText(subject?.value || subject),
        label: normalizeExtractedText(subject?.label || subject?.value || subject),
      }))
      .filter((subject) => subject.value)
      .slice(0, 50)
    : [];

  if (!inputText) {
    res.status(400).json({ success: false, message: 'Missing text to classify.' });
    return;
  }

  try {
    const classification = await classifySubjectWithAI({
      inputText,
      supportedSubjects,
    });

    logger.info('subject_classification_completed', {
      uid: decoded.uid,
      provider: 'vertex-gemini',
      subject: classification.subject || '',
      subjectConfidence: classification.subjectConfidence,
      needsManualSubjectSelection: classification.needsManualSubjectSelection,
    });

    res.status(200).json({
      success: true,
      classification,
      provider: 'vertex-gemini',
    });
  } catch (error) {
    logger.error('subject_classification_failed', {
      uid: decoded.uid,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Subject classification failed.',
    });
  }
});

exports.syncStudentGrowth = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const authUser = await admin.auth().getUser(decoded.uid).catch(() => null);
  const emailVerified = Boolean(authUser?.emailVerified || decoded.email_verified);
  const userRef = db.collection('users').doc(decoded.uid);

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) return;
    const userData = userSnap.data() || {};
    const isStudent = (userData.activeRole || userData.role || '').toLowerCase() === 'student';

    const baseUpdates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      referralSlug: userData.referralSlug || `clx-${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      growth: {
        ...(userData.growth || {}),
        completionRequirements: {
          ...((userData.growth || {}).completionRequirements || {}),
          emailVerified,
          studentProfileComplete: isStudent ? hasCompletedStudentProfile(userData) : false,
          phoneVerified: Boolean(((userData.growth || {}).completionRequirements || {}).phoneVerified || false),
        },
        lastGrowthSyncedAt: new Date().toISOString(),
      },
      emailVerified,
      emailVerifiedAt: emailVerified
        ? (userData.emailVerifiedAt || admin.firestore.FieldValue.serverTimestamp())
        : null,
    };

    if (!isStudent) {
      transaction.set(userRef, baseUpdates, { merge: true });
      return;
    }

    const existingFreeMinutes = Number(userData.freeMinutesRemaining ?? DEFAULT_STUDENT_FREE_MINUTES);
    const existingEarned = Number(userData.totalFreeMinutesEarned ?? DEFAULT_STUDENT_FREE_MINUTES);
    transaction.set(userRef, {
      ...baseUpdates,
      freeMinutesRemaining: Number.isFinite(existingFreeMinutes) ? existingFreeMinutes : DEFAULT_STUDENT_FREE_MINUTES,
      totalFreeMinutesEarned: Number.isFinite(existingEarned) ? existingEarned : DEFAULT_STUDENT_FREE_MINUTES,
      totalFreeMinutesUsed: Number(userData.totalFreeMinutesUsed || 0),
      referralRewardCount: Number(userData.referralRewardCount || 0),
    }, { merge: true });

    const alreadyProcessed = Boolean((userData.growth || {}).accountCompletionRewardProcessed);
    const studentProfileComplete = hasCompletedStudentProfile(userData);
    if (!studentProfileComplete || alreadyProcessed) return;

    const pendingReferralSlug = String(userData.pendingReferralSlug || userData.pendingReferralCode || '').trim();
    if (!pendingReferralSlug) {
      transaction.set(userRef, {
        pendingReferralSlug: null,
        pendingReferralCode: null,
        growth: {
          ...(userData.growth || {}),
          accountCompletionRewardProcessed: true,
          accountCompletionQualifiedAt: new Date().toISOString(),
        },
      }, { merge: true });
      return;
    }

    let referrerDoc = null;
    const referrerSlugQuery = db.collection('users').where('referralSlug', '==', pendingReferralSlug).limit(1);
    const referrerSlugSnap = await transaction.get(referrerSlugQuery);
    referrerDoc = referrerSlugSnap.docs[0] || null;

    if (!referrerDoc) {
      const legacyReferrerQuery = db.collection('users').where('referralCode', '==', pendingReferralSlug.toUpperCase()).limit(1);
      const legacyReferrerSnap = await transaction.get(legacyReferrerQuery);
      referrerDoc = legacyReferrerSnap.docs[0] || null;
    }

    const referrerId = referrerDoc?.id || null;
    const referrerData = referrerDoc?.data() || {};
    const referrerIsStudent = (referrerData.activeRole || referrerData.role || '').toLowerCase() === 'student';

    if (!referrerId || referrerId === decoded.uid || !referrerIsStudent) {
      transaction.set(userRef, {
        pendingReferralSlug: null,
        pendingReferralCode: null,
        growth: {
          ...(userData.growth || {}),
          accountCompletionRewardProcessed: true,
          accountCompletionQualifiedAt: new Date().toISOString(),
        },
      }, { merge: true });
      return;
    }

    const referralRef = db.collection('referrals').doc(`${referrerId}_${decoded.uid}`);
    const referralSnap = await transaction.get(referralRef);
    const rewardAlreadyGranted = Boolean(referralSnap.exists && referralSnap.data()?.rewardGranted);

    transaction.set(referralRef, {
      referrerId,
      referredUserId: decoded.uid,
      referralSlug: pendingReferralSlug,
      status: 'completed',
      rewardGranted: true,
      rewardMinutesGranted: REFERRAL_REWARD_MINUTES,
      createdAt: referralSnap.exists ? (referralSnap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!rewardAlreadyGranted) {
      const referrerRef = db.collection('users').doc(referrerId);
      transaction.set(referrerRef, {
        freeMinutesRemaining: admin.firestore.FieldValue.increment(REFERRAL_REWARD_MINUTES),
        totalFreeMinutesEarned: admin.firestore.FieldValue.increment(REFERRAL_REWARD_MINUTES),
        referralRewardCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(userRef, {
      referredBy: referrerId,
      pendingReferralSlug: null,
      pendingReferralCode: null,
      growth: {
        ...(userData.growth || {}),
        accountCompletionRewardProcessed: true,
        accountCompletionQualifiedAt: new Date().toISOString(),
      },
    }, { merge: true });
  });

  const profileSnap = await userRef.get();
  res.status(200).json({ success: true, profile: { uid: decoded.uid, ...(profileSnap.data() || {}) } });
});

exports.getIceConfig = onRequest(
  {
    cors: true,
    secrets: [
      CLAXI_REALTIME_SECRETS,
      CLOUDFLARE_TURN_KEY_ID,
      CLOUDFLARE_TURN_API_TOKEN,
      CLOUDFLARE_TURN_TTL_SECONDS,
    ],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, message: 'Method not allowed' });
      return;
    }

    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Unauthorized request.' });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      logger.warn('Failed to verify Firebase auth token for ICE config.', {
        error: error.message,
      });
      res.status(401).json({ success: false, message: 'Unauthorized request.' });
      return;
    }

    let realtimeSecrets;
    try {
      realtimeSecrets = getRealtimeSecrets();
    } catch (error) {
      logger.error('Cloudflare TURN configuration is unavailable.', {
        error: error.message,
      });
      res.status(500).json({
        success: false,
        message: 'Realtime network configuration unavailable.',
      });
      return;
    }

    const turnKeyId = realtimeSecrets.CLOUDFLARE_TURN_KEY_ID;
    const turnApiToken = realtimeSecrets.CLOUDFLARE_TURN_API_TOKEN;
    const ttl = parseTurnTtlSeconds(realtimeSecrets.CLOUDFLARE_TURN_TTL_SECONDS);

    try {
      const cfResponse = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(
          turnKeyId,
        )}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${turnApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl }),
        },
      );

      const cfPayload = await cfResponse.json().catch(() => null);

      if (!cfResponse.ok) {
        logger.error('Cloudflare TURN credential generation failed.', {
          uid: decodedToken.uid,
          status: cfResponse.status,
        });

        res.status(500).json({
          success: false,
          message: 'Unable to generate realtime network credentials.',
        });
        return;
      }

      const generatedIceServers = sanitizeCloudflareIceServers(cfPayload?.iceServers || []);
      const combinedIceServers = generatedIceServers.length
        ? generatedIceServers
        : [{ urls: DEFAULT_STUN_URLS }];

      const turnServers = combinedIceServers.filter((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => String(url).startsWith('turn:') || String(url).startsWith('turns:'));
      });

      const stunServers = combinedIceServers.filter((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => String(url).startsWith('stun:'));
      });

      logger.info('Generated Cloudflare ICE config for authenticated user.', {
        uid: decodedToken.uid,
        ttlSeconds: ttl,
        serverCount: combinedIceServers.length,
        stunCount: stunServers.reduce(
          (sum, server) => sum + (Array.isArray(server.urls) ? server.urls.length : 1),
          0,
        ),
        turnCount: turnServers.reduce(
          (sum, server) => sum + (Array.isArray(server.urls) ? server.urls.length : 1),
          0,
        ),
      });

      res.status(200).json({
        success: true,
        iceServers: combinedIceServers,
        ttlSeconds: ttl,
      });
    } catch (error) {
      logger.error('Failed to fetch Cloudflare ICE config.', {
        uid: decodedToken.uid,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Unable to generate realtime network credentials.',
      });
    }
  },
);

exports.verifyPaystack = onRequest({ cors: true, secrets: [CLAXI_PAYMENTS_SECRETS, PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  logger.info('verifyPaystack request received.', {
    hasReference: Boolean(body.reference),
    hasUserId: Boolean(body.userId),
    hasNickname: Boolean(body.nickname),
  });

  let paymentsSecrets;
  try {
    paymentsSecrets = getPaymentsSecrets();
  } catch (error) {
    logger.error('Payment configuration is unavailable.', {
      error: error.message,
    });
    res.status(500).json({ success: false, message: 'Payment configuration is unavailable.' });
    return;
  }

  const paystackSecretKey = paymentsSecrets.PAYSTACK_SECRET_KEY;
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    logger.warn('Failed to verify Firebase auth token.', {
      error: error.message,
    });
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const uid = decodedToken.uid;
  const providedUserId = body.userId?.toString().trim();
  const nickname = body.nickname?.toString().trim();
  const reference = body.reference?.toString().trim();

  logger.info('verifyPaystack reference received.', {
    uid,
    providedUserId,
    reference,
    nickname: nickname || null,
  });

  if (!reference) {
    res.status(400).json({ success: false, message: 'Missing transaction reference.' });
    return;
  }

  if (providedUserId && providedUserId !== uid) {
    res.status(400).json({ success: false, message: 'Invalid userId supplied.' });
    return;
  }

  try {
    const verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const verificationPayload = await verificationResponse.json().catch(() => null);

    logger.info('Paystack verify response status.', {
      status: verificationResponse.status,
      ok: verificationResponse.ok,
      reference,
      responseStatus: verificationPayload?.status,
      message: verificationPayload?.message,
      errorCode: verificationPayload?.code || null,
      errorType: verificationPayload?.type || null,
    });

    if (!verificationResponse.ok) {
      const verifyError = new Error(`Paystack verify failed (${verificationResponse.status})`);
      verifyError.response = {
        data: verificationPayload || `HTTP ${verificationResponse.status}`,
      };
      throw verifyError;
    }

    const transactionData = verificationPayload?.data;
    const authorization = transactionData?.authorization;

    logger.info('Paystack verified transaction payload summary.', {
      reference,
      transactionStatus: transactionData?.status || null,
      hasAuthorization: !!authorization,
      authorizationReusable: authorization?.reusable === true,
      authorizationBrand: authorization?.brand || null,
      authorizationLast4: authorization?.last4 || null,
      amount: transactionData?.amount || null,
      currency: transactionData?.currency || null,
    });

    if (!transactionData || transactionData.status !== 'success') {
      res.status(400).json({
        success: false,
        message: 'Transaction verification failed or transaction is not successful.',
      });
      return;
    }

    if (!authorization?.authorization_code) {
      res.status(400).json({
        success: false,
        message: 'Authorization details not available for this transaction.',
      });
      return;
    }

    if (authorization.reusable !== true) {
      res.status(400).json({
        success: false,
        message: 'Card is not reusable. Please use a reusable card.',
      });
      return;
    }

    const usersRef = db.collection('users').doc(uid);
    const userSnap = await usersRef.get();
    const existingMethods = Array.isArray(userSnap.data()?.paymentMethods)
      ? userSnap.data().paymentMethods
      : [];

    const duplicateMethod = existingMethods.find(
      (method) => method.paystackAuthorizationCode === authorization.authorization_code,
    );

    const safeCardRecord = duplicateMethod || {
      id: randomUUID(),
      nickname: nickname || `${(authorization.brand || 'Card').charAt(0).toUpperCase() + (authorization.brand || 'Card').slice(1)} •••• ${authorization.last4 || '----'}`,
      brand: authorization.brand || 'Card',
      last4: authorization.last4 || '----',
      paystackAuthorizationCode: authorization.authorization_code,
      signature: authorization.signature || null,
      reusable: true,
      isDefault: existingMethods.length === 0,
      createdAt: new Date().toISOString(),
    };

    if (!duplicateMethod) {
      await usersRef.set(
        {
          paymentMethods: [...existingMethods, safeCardRecord],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    logger.info('Card saved to Firestore.', {
      uid,
      reference,
      duplicateMethod: !!duplicateMethod,
      cardId: safeCardRecord.id,
      brand: safeCardRecord.brand,
      last4: safeCardRecord.last4,
      reusable: safeCardRecord.reusable,
      isDefault: safeCardRecord.isDefault,
    });

    let refundSucceeded = false;
    let refundMessage = null;

    try {
      const refundResponse = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction: reference }),
      });

      const refundPayload = await refundResponse.json().catch(() => null);

      logger.info('Paystack refund response status.', {
        status: refundResponse.status,
        ok: refundResponse.ok,
        reference,
        responseStatus: refundPayload?.status,
        message: refundPayload?.message,
        errorCode: refundPayload?.code || null,
        errorType: refundPayload?.type || null,
      });

      if (!refundResponse.ok) {
        const refundError = new Error(`Paystack refund failed (${refundResponse.status})`);
        refundError.response = {
          data: refundPayload || `HTTP ${refundResponse.status}`,
        };
        throw refundError;
      }

      refundSucceeded = true;
    } catch (refundError) {
      refundMessage = 'Card saved, but refund is still processing. Please contact support if not reversed shortly.';
      logger.error('Paystack refund failed after successful authorization.', {
        reference,
        uid,
        error: refundError.response?.data || refundError.message,
      });
    }

    res.status(200).json({
      success: true,
      card: {
        id: safeCardRecord.id,
        nickname: safeCardRecord.nickname,
        brand: safeCardRecord.brand,
        last4: safeCardRecord.last4,
        reusable: safeCardRecord.reusable,
        isDefault: safeCardRecord.isDefault,
        signature: safeCardRecord.signature,
        createdAt: safeCardRecord.createdAt,
      },
      refunded: refundSucceeded,
      refundMessage,
    });
  } catch (error) {
    logger.error('verifyPaystack flow failed.', {
      reference,
      uid,
      error: error.response?.data || error.message,
    });

    res.status(500).json({
      success: false,
      message: 'Unable to verify card right now. Please try again.',
    });
  }
});

const BILLING_RULES = {
  PLATFORM_FEE_RATE: 0.3,
  TUTOR_PAYOUT_RATE: 0.7,
};

async function chargeAuthorizationWithPaystack({ paystackSecretKey, email, amount, authorizationCode }) {
  if (!authorizationCode) {
    return { ok: false, reason: 'missing_authorization' };
  }

  const chargeResponse = await fetch('https://api.paystack.co/transaction/charge_authorization', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amount || 0) * 100),
      authorization_code: authorizationCode,
      currency: 'ZAR',
    }),
  });

  const chargePayload = await chargeResponse.json().catch(() => ({}));
  const chargeData = chargePayload?.data || {};
  const succeeded = chargeResponse.ok && chargePayload?.status === true && chargeData?.status === 'success';

  return {
    ok: succeeded,
    reason: succeeded ? null : (chargePayload?.message || 'gateway_declined'),
    transactionId: chargeData?.id ? String(chargeData.id) : null,
  };
}

exports.finalizeSessionBilling = onRequest({ cors: true, secrets: [CLAXI_PAYMENTS_SECRETS, PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const decoded = await admin.auth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) {
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const sessionId = req.body?.sessionId?.toString().trim();
  const closureType = req.body?.closureType === 'canceled_during' ? 'canceled_during' : 'completed';
  const canceledBy = req.body?.canceledBy ? String(req.body.canceledBy) : null;
  const canceledReason = req.body?.canceledReason ? String(req.body.canceledReason).trim() : '';
  if (!sessionId) {
    res.status(400).json({ success: false, message: 'Missing sessionId.' });
    return;
  }

  const sessionRef = db.collection('sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    res.status(404).json({ success: false, message: 'Session not found.' });
    return;
  }

  const session = sessionSnap.data() || {};
  const isParticipant = [session.studentId, session.tutorId].includes(decoded.uid);
  if (!isParticipant) {
    res.status(403).json({ success: false, message: 'Not allowed to close this session.' });
    return;
  }

  if (['completed', 'canceled_during', 'canceled'].includes(session.status)) {
    res.status(200).json({ success: true, session: { id: sessionId, ...session } });
    return;
  }

  const endedAt = Date.now();
  const startedAt = Number(session.billingStartedAt || session.studentJoinedAt || session.callStartedAt || endedAt);
  const billedSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const billedMinutes = Number((billedSeconds / 60).toFixed(2));
  const requestRef = session.requestId ? db.collection('classRequests').doc(session.requestId) : null;
  const requestSnap = requestRef ? await requestRef.get().catch(() => null) : null;
  const requestData = requestSnap?.exists ? (requestSnap.data() || {}) : {};

  const selectedDurationMinutes = Number(
    session.durationMinutes
    || requestData.durationMinutes
    || session.pricingSnapshot?.requestedDurationMinutes
    || requestData.pricingSnapshot?.requestedDurationMinutes
    || session.pricingSnapshot?.durationMinutes
    || requestData.pricingSnapshot?.durationMinutes
    || LEGACY_SAFE_PRICING_SNAPSHOT.durationMinutes,
  );
  const pricingQuoteId = session.pricingQuoteId
    || session.pricingSnapshot?.quoteId
    || requestData.pricingQuoteId
    || requestData.pricingSnapshot?.quoteId
    || null;

  let trustedSnapshot = sanitizePricingSnapshot(session.pricingSnapshot || requestData.pricingSnapshot || null);
  if (pricingQuoteId) {
    const quoteSnap = await db.collection('pricingQuotes').doc(pricingQuoteId).get();
    if (quoteSnap.exists) {
      trustedSnapshot = sanitizePricingSnapshot(quoteSnap.data());
    }
  }

  const snapshot = sanitizePricingSnapshot({
    ...(trustedSnapshot || LEGACY_SAFE_PRICING_SNAPSHOT),
    durationMinutes: Math.max(
      1,
      Math.floor(Number(selectedDurationMinutes || LEGACY_SAFE_PRICING_SNAPSHOT.durationMinutes)),
    ),
  });
  const isLegacySession = !pricingQuoteId && !session.pricingSnapshot && !requestData.pricingSnapshot;

  const settlement = computeFinalAmountFromSnapshot({
    snapshot,
    billedMinutes,
    closureType,
    selectedDurationMinutes,
  });
  const originalPrice = Number(settlement.totalAmount || 0);

  const studentRef = db.collection('users').doc(session.studentId);
  const studentSnap = await studentRef.get();
  const studentData = studentSnap.data() || {};
  const freeMinuteDiscount = applyFreeMinuteDiscount({
    originalPrice,
    durationMinutes: Math.max(0, billedMinutes),
    freeMinutesRemaining: Number(studentData.freeMinutesRemaining || 0),
  });
  const totalAmount = freeMinuteDiscount.finalPrice;
  const tutorAmount = Number((originalPrice * BILLING_RULES.TUTOR_PAYOUT_RATE).toFixed(2));
  const platformAmount = Number((originalPrice * BILLING_RULES.PLATFORM_FEE_RATE).toFixed(2));
  const paymentMethods = studentData.paymentMethods || [];
  const selectedCardId = session.selectedCardId || requestData.selectedCardId || null;
  const selectedCard = paymentMethods.find((card) => card.id === selectedCardId)
    || paymentMethods.find((card) => card.isDefault)
    || paymentMethods[0]
    || null;

  let charge = { ok: true, reason: null, transactionId: 'free-minutes-covered' };
  if (totalAmount > 0) {
    let paymentsSecrets;
    try {
      paymentsSecrets = getPaymentsSecrets();
    } catch (error) {
      logger.error('Payment configuration is unavailable during session billing.', {
        sessionId,
        error: error.message,
      });
      res.status(500).json({ success: false, message: 'Payment configuration is unavailable.' });
      return;
    }

    charge = await chargeAuthorizationWithPaystack({
      paystackSecretKey: paymentsSecrets.PAYSTACK_SECRET_KEY,
      email: studentData.email || session.studentEmail || '',
      amount: totalAmount,
      authorizationCode: selectedCard?.paystackAuthorizationCode || '',
    });
  }

  const paymentStatus = charge.ok ? 'paid' : 'wallet_debt_recorded';
  const wallet = studentData.wallet || { balance: 0, currency: 'ZAR' };
  const nextWalletBalance = charge.ok
    ? Number(wallet.balance || 0)
    : Number((Number(wallet.balance || 0) - totalAmount).toFixed(2));

  const batch = db.batch();
  batch.set(sessionRef, {
    status: closureType,
    endedAt,
    billedSeconds,
    billedMinutes,
    totalAmount,
    originalPrice,
    discountApplied: freeMinuteDiscount.discountApplied,
    finalPrice: freeMinuteDiscount.finalPrice,
    discountSource: freeMinuteDiscount.discountSource,
    freeMinutesApplied: freeMinuteDiscount.freeMinutesApplied,
    requestedDurationMinutes: Number(selectedDurationMinutes || snapshot.durationMinutes || 0),
    selectedCardId,
    canceledBy: closureType === 'canceled_during' ? canceledBy : null,
    canceledReason: closureType === 'canceled_during' ? canceledReason : null,
    pricingSnapshot: {
      ...snapshot,
      billedMinutes,
      originalPrice,
      discountApplied: freeMinuteDiscount.discountApplied,
      finalAmount: freeMinuteDiscount.finalPrice,
      finalPayablePrice: freeMinuteDiscount.finalPrice,
      discountSource: freeMinuteDiscount.discountSource,
      freeMinutesApplied: freeMinuteDiscount.freeMinutesApplied,
      finalizedAt: new Date(endedAt).toISOString(),
      legacyFallbackUsed: isLegacySession,
      closureType,
      earlyCancellation: settlement.isEarlyCancellation,
      earlyCancelThresholdMinutes: settlement.earlyCancelThresholdMinutes,
    },
    payoutBreakdown: {
      platformFeeRate: BILLING_RULES.PLATFORM_FEE_RATE,
      tutorRate: BILLING_RULES.TUTOR_PAYOUT_RATE,
      tutorAmount,
      platformAmount,
    },
    paymentStatus,
    paymentTransactionId: charge.transactionId || null,
    chargedCardLast4: selectedCard?.last4 || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  if (requestRef) {
    batch.set(requestRef, {
      status: closureType === 'canceled_during' ? 'canceled_during' : 'completed',
      statusDetail: closureType === 'canceled_during'
        ? 'Session canceled. Billing completed.'
        : 'Session ended. Billing completed.',
      endedAt,
      canceledBy: closureType === 'canceled_during' ? canceledBy : null,
      canceledReason: closureType === 'canceled_during' ? canceledReason : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  if (freeMinuteDiscount.freeMinutesApplied > 0) {
    batch.set(studentRef, {
      freeMinutesRemaining: Number(Math.max(0, Number(studentData.freeMinutesRemaining || 0) - freeMinuteDiscount.freeMinutesApplied).toFixed(2)),
      totalFreeMinutesUsed: Number((Number(studentData.totalFreeMinutesUsed || 0) + freeMinuteDiscount.freeMinutesApplied).toFixed(2)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  if (!charge.ok) {
    batch.set(studentRef, {
      wallet: {
        ...wallet,
        balance: nextWalletBalance,
        currency: wallet.currency || 'ZAR',
        updatedAt: new Date().toISOString(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();

  const updatedSnap = await sessionRef.get();
  const updatedSession = { id: updatedSnap.id, ...updatedSnap.data() };
  logger.info('pricing_billing_finalized', {
    sessionId,
    requestId: session.requestId || null,
    quoteId: updatedSession?.pricingSnapshot?.quoteId || null,
    configVersion: updatedSession?.pricingSnapshot?.configVersion || null,
    pricingBand: updatedSession?.pricingSnapshot?.pricingBand || null,
    billedMinutes,
    originalPrice,
    totalAmount,
    discountApplied: freeMinuteDiscount.discountApplied,
    freeMinutesApplied: freeMinuteDiscount.freeMinutesApplied,
    paymentStatus,
    legacyFallbackUsed: Boolean(updatedSession?.pricingSnapshot?.legacyFallbackUsed),
    closureType,
    earlyCancellation: settlement.isEarlyCancellation,
  });

  res.status(200).json({
    success: true,
    session: updatedSession,
    charge: { ok: charge.ok, reason: charge.reason || null },
  });
});

exports.sendEmailFromQueue = onDocumentCreated(
  {
    document: 'emailEvents/{eventId}',
    secrets: [CLAXI_EMAIL_SECRETS, RESEND_API_KEY, EMAIL_FROM],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      logger.warn('sendEmailFromQueue received empty event data.', {
        eventId: event.params.eventId,
      });
      return;
    }

    const eventRef = db.collection('emailEvents').doc(event.params.eventId);
    let emailSecrets;
    try {
      emailSecrets = getEmailSecrets();
    } catch (error) {
      logger.warn('Email configuration is unavailable. Skipping email send.', {
        eventId: event.params.eventId,
        eventType: data.eventType || null,
        error: error.message,
      });
      await eventRef.set(
        {
          status: 'skipped',
          reason: 'missing_email_configuration',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const resendApiKey = emailSecrets.RESEND_API_KEY;
    const emailFrom = emailSecrets.EMAIL_FROM;

    const resend = new Resend(resendApiKey);
    const emailPayload = buildEmailPayload(data.eventType, data.payload);

    if (!emailPayload) {
      logger.warn('Unsupported email event type.', {
        eventId: event.params.eventId,
        eventType: data.eventType || null,
      });

      await eventRef.set(
        {
          status: 'ignored',
          reason: 'unsupported_event_type',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    logger.info('Prepared email payload summary.', {
      eventId: event.params.eventId,
      eventType: data.eventType,
      to: emailPayload.to,
      subject: emailPayload.subject,
    });

    try {
      const response = await resend.emails.send({
        from: emailFrom,
        ...emailPayload,
      });

      logger.info('Email sent successfully.', {
        eventId: event.params.eventId,
        provider: 'resend',
        providerMessageId: response.data?.id || null,
      });

      await eventRef.set(
        {
          status: 'sent',
          provider: 'resend',
          providerMessageId: response.data?.id || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      logger.error('Failed to send email.', {
        eventId: event.params.eventId,
        error: error.message,
        response: error.response?.data || null,
      });

      await eventRef.set(
        {
          status: 'failed',
          errorMessage: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  },
);
