const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const { randomUUID } = require('crypto');
const {
  DEFAULT_PRICING_CONFIG,
  computePricingQuote,
  computeFinalAmountFromSnapshot,
  loadPricingConfig,
  sanitizePricingSnapshot,
} = require('./pricingEngine');

admin.initializeApp();

const db = admin.firestore();

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
const DEFAULT_STUDENT_FREE_MINUTES = 90;
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
  const rating = Number(tutor?.tutorProfile?.overallRating ?? 0) || 0;
  const recent24h = Number(tutor?.tutorProfile?.completedSessionsLast24Hours ?? 0) || 0;
  const totalSessions = Number(tutor?.tutorProfile?.completedSessionsTotal ?? 0) || 0;
  return (rating * 10000) + (recent24h * 100) + totalSessions;
}

async function getTutorQueueForSubject(subject) {
  const subjectKey = String(subject || 'Mathematics').trim().toLowerCase();
  const snapshot = await db
    .collection('users')
    .where('activeRole', '==', 'tutor')
    .where('onlineStatus', '==', 'online')
    .get();

  return snapshot.docs
    .map((item) => ({ uid: item.id, ...item.data() }))
    .filter((tutor) => {
      const normalizedSubjects = (tutor.subjects || []).map((entry) => String(entry || '').trim().toLowerCase());
      return tutor?.tutorProfile?.verificationStatus === 'verified'
        && !tutor.activeSessionId
        && normalizedSubjects.includes(subjectKey);
    })
    .sort((a, b) => getTutorScore(b) - getTutorScore(a))
    .map((item) => item.uid);
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
    transaction.update(requestRef, {
      status: REQUEST_STATUS.OFFERED,
      statusDetail: 'Tutor notified. Waiting for acceptance.',
      tutorQueue: queue,
      currentOfferTutorId: queue[0],
      offerExpiresAt: Date.now() + OFFER_TIMEOUT_MS,
      offerRevision,
      offerToken: randomUUID(),
      retryOfferGranted: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
});

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

function buildEmailPayload(eventType, payload) {
  switch (eventType) {
    case 'welcome':
      return {
        to: payload.email,
        subject: `Welcome to Claxi, ${payload.fullName}!`,
        html: `<p>Welcome to Claxi. Your ${payload.role} account is ready.</p>`,
      };
    case 'request_created':
      return {
        to: payload.studentEmail,
        subject: 'Your class request is live',
        html: `<p>Your ${payload.subject} request has been posted and is visible to tutors.</p>`,
      };
    case 'request_accepted':
      return {
        to: payload.studentEmail,
        subject: 'A tutor accepted your request',
        html: `<p>${payload.tutorName} accepted your ${payload.subject} request.</p>`,
      };
    case 'session_scheduled':
      return {
        to: [payload.studentEmail, payload.tutorEmail],
        subject: `Session scheduled: ${payload.subject}`,
        html: `<p>Your session is scheduled for ${payload.scheduledDate} at ${payload.scheduledTime}. Link: ${payload.meetingLink || 'to be added'}</p>`,
      };
    case 'session_updated':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session update: ${payload.subject}`,
        html: `<p>Session status changed to ${payload.status || 'updated'}.</p>`,
      };
    case 'session_completed':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session completed: ${payload.subject}`,
        html: '<p>Your session has been marked as completed. Thanks for learning with Claxi.</p>',
      };
    case 'cancellation':
      return {
        to: [payload.studentEmail, payload.tutorEmail].filter(Boolean),
        subject: `Session canceled: ${payload.subject}`,
        html: '<p>This session has been canceled.</p>',
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

function getSafeSecretPreview(value) {
  if (!value || typeof value !== 'string') {
    return {
      exists: false,
      prefix: null,
      length: 0,
    };
  }

  return {
    exists: true,
    prefix: value.slice(0, 10),
    length: value.length,
  };
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
      growth: {
        ...(userData.growth || {}),
        completionRequirements: {
          ...((userData.growth || {}).completionRequirements || {}),
          emailVerified,
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
    if (!emailVerified || alreadyProcessed) return;

    const pendingReferralCode = String(userData.pendingReferralCode || '').trim().toUpperCase();
    if (!pendingReferralCode) {
      transaction.set(userRef, {
        growth: {
          ...(userData.growth || {}),
          accountCompletionRewardProcessed: true,
          accountCompletionQualifiedAt: new Date().toISOString(),
        },
      }, { merge: true });
      return;
    }

    const referrerQuery = db.collection('users').where('referralCode', '==', pendingReferralCode).limit(1);
    const referrerQuerySnap = await transaction.get(referrerQuery);
    const referrerDoc = referrerQuerySnap.docs[0];
    const referrerId = referrerDoc?.id || null;
    if (!referrerId || referrerId === decoded.uid) {
      transaction.set(userRef, {
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
      referralCode: pendingReferralCode,
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

    const turnKeyId = CLOUDFLARE_TURN_KEY_ID.value();
    const turnApiToken = CLOUDFLARE_TURN_API_TOKEN.value();
    const ttl = parseTurnTtlSeconds(CLOUDFLARE_TURN_TTL_SECONDS.value());

    if (!turnKeyId || !turnApiToken) {
      logger.error('Cloudflare TURN secrets missing.', {
        hasTurnKeyId: Boolean(turnKeyId),
        hasTurnApiToken: Boolean(turnApiToken),
      });
      res.status(500).json({
        success: false,
        message: 'Realtime network configuration unavailable.',
      });
      return;
    }

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
          payload: cfPayload || null,
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
        turnHasUsername: turnServers.some((server) => Boolean(server.username)),
        turnHasCredential: turnServers.some((server) => Boolean(server.credential)),
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

exports.verifyPaystack = onRequest({ cors: true, secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  logger.info('verifyPaystack request body received.', { body: req.body || null });

  const paystackSecretKey = PAYSTACK_SECRET_KEY.value();
  const paystackSecretPreview = getSafeSecretPreview(paystackSecretKey);

  logger.info('Paystack secret loaded.', {
    exists: paystackSecretPreview.exists,
    prefix: paystackSecretPreview.prefix,
    length: paystackSecretPreview.length,
  });

  if (!paystackSecretKey) {
    logger.error('PAYSTACK_SECRET_KEY missing.');
    res.status(500).json({ success: false, message: 'Payment configuration is unavailable.' });
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
    logger.warn('Failed to verify Firebase auth token.', {
      error: error.message,
    });
    res.status(401).json({ success: false, message: 'Unauthorized request.' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
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

exports.finalizeSessionBilling = onRequest({ cors: true, secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
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

  let trustedSnapshot = sanitizePricingSnapshot(session.pricingSnapshot || {});
  if (session.pricingSnapshot?.quoteId) {
    const quoteSnap = await db.collection('pricingQuotes').doc(session.pricingSnapshot.quoteId).get();
    if (quoteSnap.exists) {
      trustedSnapshot = sanitizePricingSnapshot(quoteSnap.data());
    }
  }

  const isLegacySession = !trustedSnapshot;
  const fallbackRate = 1.8;
  const snapshot = trustedSnapshot || sanitizePricingSnapshot({
    pricingBand: 'normal',
    baseAmount: 12,
    ratePerMinute: fallbackRate,
    adjustedBaseAmount: 12,
    adjustedRatePerMinute: fallbackRate,
    durationMinutes: Math.max(1, Math.round(billedMinutes)),
    totalAmount: 12 + (fallbackRate * billedMinutes),
    configVersion: 'pricing-v2.0.0-legacy-fallback',
    explanationLabel: 'Legacy fallback pricing',
  });

  const settlement = computeFinalAmountFromSnapshot({
    snapshot,
    billedMinutes,
    closureType,
    selectedDurationMinutes: Number(session.durationMinutes || snapshot.durationMinutes || 0),
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
  const selectedCard = paymentMethods.find((card) => card.id === session.selectedCardId)
    || paymentMethods.find((card) => card.isDefault)
    || paymentMethods[0]
    || null;

  const charge = totalAmount <= 0
    ? { ok: true, reason: null, transactionId: 'free-minutes-covered' }
    : await chargeAuthorizationWithPaystack({
        paystackSecretKey: PAYSTACK_SECRET_KEY.value(),
        email: studentData.email || session.studentEmail || '',
        amount: totalAmount,
        authorizationCode: selectedCard?.paystackAuthorizationCode || '',
      });

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
    requestedDurationMinutes: Number(session.durationMinutes || snapshot.durationMinutes || 0),
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

  batch.set(db.collection('classRequests').doc(session.requestId), {
    status: closureType === 'canceled_during' ? 'canceled_during' : 'completed',
    statusDetail: closureType === 'canceled_during'
      ? 'Session canceled. Billing completed.'
      : 'Session ended. Billing completed.',
    endedAt,
    canceledBy: closureType === 'canceled_during' ? canceledBy : null,
    canceledReason: closureType === 'canceled_during' ? canceledReason : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

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
    secrets: [RESEND_API_KEY, EMAIL_FROM],
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
    const resendApiKey = RESEND_API_KEY.value();
    const emailFrom = EMAIL_FROM.value() || 'noreply@claxi.app';

    const resendPreview = getSafeSecretPreview(resendApiKey);

    logger.info('Email secret/config loaded.', {
      resendKeyExists: resendPreview.exists,
      resendKeyPrefix: resendPreview.prefix,
      resendKeyLength: resendPreview.length,
      emailFrom,
      eventId: event.params.eventId,
      eventType: data.eventType || null,
    });

    if (!resendApiKey) {
      logger.warn('RESEND_API_KEY missing. Skipping email send.');
      await eventRef.set(
        {
          status: 'skipped',
          reason: 'missing_resend_api_key',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

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
      from: emailFrom,
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
