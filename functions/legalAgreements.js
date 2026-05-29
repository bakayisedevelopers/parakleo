const { createHash, randomUUID } = require('crypto');
const PDFDocument = require('pdfkit');

const LEGAL_ENTITY_NAME = 'Parakleo, operated by Jabu Msiza';
const TUTOR_AGREEMENT_DOCUMENT_ID = 'tutor_agreement';
const TUTOR_AGREEMENT_TITLE = 'Tutor Agreement';
const TUTOR_AGREEMENT_DEFAULT_VERSION = '1.0.0';
const TUTOR_AGREEMENT_VERSION_PREFIX = 'tutor_agreement_';
const TUTOR_AGREEMENT_STATUS = {
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
};

// Starter legal template for MVP use only. It must be reviewed by a South African attorney
// before public launch or any production rollout.
function buildTutorAgreementMarkdown() {
  return `# Tutor Agreement

**Parties**

This Tutor Agreement is entered into between **${LEGAL_ENTITY_NAME}** ("Parakleo") and the tutor accepting this agreement.

**1. Independent contractor status**

- The tutor is an independent contractor and not an employee, partner, agent, or representative of Parakleo.
- The tutor is responsible for all taxes, statutory obligations, registrations, and filings arising from tutoring activity.
- Parakleo does not guarantee work, request volume, earnings, or any minimum income.
- The tutor chooses their availability subject to platform rules, safety requirements, and accepted session obligations.

**2. Tutor eligibility and profile accuracy**

- The tutor must provide accurate identity, qualifications, subjects, experience, banking details, and any other required profile information.
- The tutor must keep their profile up to date and promptly correct any inaccurate or outdated information.

**3. Tutor conduct**

- The tutor must behave professionally and communicate respectfully with students, parents, and Parakleo.
- Harassment, discrimination, abuse, threats, exploitation, misleading conduct, or inappropriate behavior is prohibited.
- The tutor must not create, share, request, or encourage explicit, sexual, violent, hateful, or unsafe content.
- The tutor must not mislead students or parents about qualifications, availability, pricing, or outcomes.

**4. Student safety and minors**

- The tutor must act appropriately with minors and must maintain safe, professional boundaries at all times.
- Private inappropriate contact, grooming, manipulation, romantic or sexual communication, and unsafe conduct are prohibited.
- Parakleo may investigate safety concerns and suspend access immediately where necessary to protect users.

**5. Platform use**

- Accepted sessions must be conducted using Parakleo systems and workflows.
- The tutor must not bypass Parakleo to take accepted sessions off-platform.
- The tutor must not ask students to pay directly outside Parakleo.
- The tutor must not solicit students to move off-platform or use Parakleo only to discover students for direct private arrangements.

**6. Lessons, online sessions, and whiteboard**

- The tutor must be punctual and prepared for sessions.
- The tutor must provide reasonable educational support and may not misuse live session tools.
- The tutor must not record, screenshot, publish, or share sessions unless Parakleo policy and the relevant consent permit it.

**7. Uploaded documents and student content**

- The tutor may only use student-uploaded material for the purpose of the lesson and related platform support.
- The tutor may not download, share, sell, publish, or reuse student documents outside the tutoring context.
- The tutor must protect confidential student information and limit access to what is necessary for the lesson.

**8. POPIA, privacy, and data protection**

- The tutor must protect personal information and process student data only for tutoring purposes.
- The tutor must follow applicable privacy, security, and data-handling requirements.
- The tutor must report suspected data misuse, loss, or breach to Parakleo promptly.

**9. AI and platform tools**

- Parakleo may use AI-assisted tools for extraction, classification, whiteboard preparation, lesson support, or moderation.
- The tutor must not rely blindly on AI output and remains responsible for checking educational correctness during lessons.

**10. Payouts and fees**

- Tutor payout percentages and rules are determined by Parakleo and may be displayed in-product or communicated separately.
- Payouts may be subject to refunds, disputes, chargebacks, cancellations, platform fees, payment processor fees, fraud checks, or policy violations.
- The tutor is responsible for all taxes and associated obligations.

**11. Cancellations, disputes, refunds, and chargebacks**

- Parakleo may adjust payouts where a lesson is cancelled, disputed, refunded, fraudulent, incomplete, or against policy.

**12. Suspension and termination**

- Parakleo may suspend, restrict, or remove tutor access for breach, safety risk, fraud, poor conduct, legal risk, student complaints, or platform abuse.

**13. Reviews, quality control, and moderation**

- Parakleo may review relevant logs, reports, uploaded content metadata, session metadata, and account activity to investigate disputes or safety concerns.

**14. Intellectual property**

- The tutor retains ownership of their pre-existing teaching material.
- Student-uploaded content remains the student’s or rightful owner’s content.
- Parakleo may store and process lesson-related content to provide, improve, moderate, and secure the platform.

**15. Limitation of liability**

- Parakleo operates as a platform and does not guarantee tutor income, student outcomes, uninterrupted availability, or specific results.

**16. Updates to this agreement**

- Parakleo may update this agreement by publishing a new version.
- Tutors must accept the current active version before continuing as verified, active, searchable, or bookable tutors.

**17. Acceptance**

- Checking the acceptance box and typing the tutor's full legal name constitutes electronic acceptance.
- Acceptance records capture the date, time, version, tutor identity, and available metadata.

**Version note**

This is a starter legal template for MVP use only and must be reviewed by a South African attorney before public launch.
`;
}

function normalizeVersionInput(version = '') {
  return String(version || '').trim();
}

function makeVersionDocId(version) {
  return `${TUTOR_AGREEMENT_VERSION_PREFIX}${normalizeVersionInput(version).replace(/\s+/g, '_')}`;
}

function computeContentHash(contentMarkdown = '') {
  return createHash('sha256').update(String(contentMarkdown || ''), 'utf8').digest('hex');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const millis = toMillis(value);
  if (!millis) return '';
  return new Date(millis).toISOString();
}

function toPlainText(markdown = '') {
  return String(markdown || '')
    .replace(/^#\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\-\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildAgreementPdfBuffer({
  title,
  version,
  effectiveDate,
  legalEntityName,
  contentMarkdown,
  acceptance,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: {
        Title: `${title} ${version}`,
        Author: legalEntityName,
        Subject: `${title} acceptance record`,
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .fillColor('#059669')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Parakleo', { align: 'center' });

    doc
      .moveDown(0.3)
      .fillColor('#111827')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(title, { align: 'center' });

    doc
      .moveDown(0.2)
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#374151')
      .text(legalEntityName, { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(11).fillColor('#111827');
    doc.text(`Version: ${version}`);
    doc.text(`Effective date: ${effectiveDate || 'Not specified'}`);
    doc.text(`Accepted by: ${acceptance.typedSignatureName || acceptance.acceptedByFullName || 'Unknown'}`);
    doc.text(`Accepted by email: ${acceptance.acceptedByEmail || 'Unknown'}`);
    doc.text(`User ID: ${acceptance.userId || 'Unknown'}`);
    doc.text(`Signature type: ${acceptance.signatureType || 'checkbox_and_typed_name'}`);
    doc.text(`Accepted at: ${acceptance.acceptedAt || ''}`);

    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Accepted contract text');
    doc.moveDown(0.35);
    doc.font('Helvetica');

    const paragraphs = toPlainText(contentMarkdown).split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    paragraphs.forEach((paragraph) => {
      doc.text(paragraph, {
        width: 500,
        align: 'left',
      });
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Acceptance metadata');
    doc.font('Helvetica');
    doc.text(`Checkbox accepted: ${acceptance.checkboxAccepted ? 'true' : 'false'}`);
    doc.text(`Typed signature name: ${acceptance.typedSignatureName || ''}`);
    doc.text(`Content hash: ${acceptance.contentHash || ''}`);
    doc.text(`Legal entity: ${legalEntityName}`);
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#4b5563').text(
      'This PDF represents the agreement version accepted by the tutor on the acceptance date shown above.',
      { align: 'left' },
    );

    doc.end();
  });
}

async function ensureTutorAgreementSeeded({ db, admin, now = new Date() }) {
  const documentRef = db.collection('legalDocuments').doc(TUTOR_AGREEMENT_DOCUMENT_ID);
  const versionId = makeVersionDocId(TUTOR_AGREEMENT_DEFAULT_VERSION);
  const versionRef = db.collection('legalDocumentVersions').doc(versionId);

  await db.runTransaction(async (transaction) => {
    const documentSnap = await transaction.get(documentRef);
    const versionSnap = await transaction.get(versionRef);

    if (!versionSnap.exists) {
      const contentMarkdown = buildTutorAgreementMarkdown();
      transaction.set(versionRef, {
        documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
        version: TUTOR_AGREEMENT_DEFAULT_VERSION,
        title: TUTOR_AGREEMENT_TITLE,
        effectiveDate: formatDate(now),
        status: TUTOR_AGREEMENT_STATUS.ACTIVE,
        contentMarkdown,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system',
        legalEntityName: LEGAL_ENTITY_NAME,
        changeSummary: 'Initial tutor agreement template.',
        contentHash: computeContentHash(contentMarkdown),
      }, { merge: true });
    }

    if (!documentSnap.exists) {
      transaction.set(documentRef, {
        documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
        title: TUTOR_AGREEMENT_TITLE,
        currentVersion: TUTOR_AGREEMENT_DEFAULT_VERSION,
        currentVersionId: versionId,
        status: TUTOR_AGREEMENT_STATUS.ACTIVE,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'system',
        legalEntityName: LEGAL_ENTITY_NAME,
      }, { merge: true });
    }
  });

  return {
    documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
    version: TUTOR_AGREEMENT_DEFAULT_VERSION,
    versionId,
  };
}

async function getTutorAgreementBundle({ db, admin, userId = '' } = {}) {
  await ensureTutorAgreementSeeded({ db, admin });
  const documentRef = db.collection('legalDocuments').doc(TUTOR_AGREEMENT_DOCUMENT_ID);
  const documentSnap = await documentRef.get();
  const documentData = documentSnap.exists ? documentSnap.data() : {};
  const activeVersionId = documentData.currentVersionId || makeVersionDocId(documentData.currentVersion || TUTOR_AGREEMENT_DEFAULT_VERSION);
  const activeVersionSnap = await db.collection('legalDocumentVersions').doc(activeVersionId).get();
  const activeVersionData = activeVersionSnap.exists ? activeVersionSnap.data() : null;

  const versionsSnap = await db.collection('legalDocumentVersions').get();
  const versions = versionsSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.documentId === TUTOR_AGREEMENT_DOCUMENT_ID)
    .sort((a, b) => {
      const aTime = toMillis(a.createdAt || a.effectiveDate);
      const bTime = toMillis(b.createdAt || b.effectiveDate);
      return bTime - aTime;
    });

  let acceptances = [];
  if (userId) {
    const acceptancesSnap = await db.collection('userAgreementAcceptances').where('userId', '==', userId).get();
    acceptances = acceptancesSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.documentId === TUTOR_AGREEMENT_DOCUMENT_ID)
      .sort((a, b) => toMillis(b.acceptedAt) - toMillis(a.acceptedAt));
  }

  return {
    document: documentSnap.exists ? { id: documentSnap.id, ...documentData } : null,
    activeVersion: activeVersionData ? { id: activeVersionSnap.id, ...activeVersionData } : null,
    versions,
    acceptances,
  };
}

function isTutorAgreementCurrent(user = {}) {
  const tutorAgreement = user?.tutorAgreement || {};
  const requiredVersion = normalizeVersionInput(tutorAgreement.requiredVersion || TUTOR_AGREEMENT_DEFAULT_VERSION);
  const acceptedVersion = normalizeVersionInput(tutorAgreement.acceptedVersion || '');
  const acceptedCurrentVersion = tutorAgreement.currentVersionAccepted === true || tutorAgreement.acceptedCurrentVersion === true;
  return Boolean(
    acceptedCurrentVersion
      && requiredVersion
      && acceptedVersion
      && requiredVersion === acceptedVersion,
  );
}

function buildUserAgreementSnapshot({
  userId,
  tutorId,
  user,
  activeVersion,
  acceptanceId,
  pdfUrl = '',
}) {
  const acceptanceUserId = tutorId || userId;
  return {
    tutorAgreement: {
      ...(user?.tutorAgreement || {}),
      documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
      title: activeVersion?.title || TUTOR_AGREEMENT_TITLE,
      legalEntityName: LEGAL_ENTITY_NAME,
      requiredVersion: activeVersion?.version || TUTOR_AGREEMENT_DEFAULT_VERSION,
      requiredVersionId: activeVersion?.id || makeVersionDocId(activeVersion?.version || TUTOR_AGREEMENT_DEFAULT_VERSION),
      currentVersion: activeVersion?.version || TUTOR_AGREEMENT_DEFAULT_VERSION,
      currentVersionId: activeVersion?.id || makeVersionDocId(activeVersion?.version || TUTOR_AGREEMENT_DEFAULT_VERSION),
      currentVersionEffectiveDate: activeVersion?.effectiveDate || '',
      currentVersionContentHash: activeVersion?.contentHash || computeContentHash(activeVersion?.contentMarkdown || ''),
      currentVersionAccepted: true,
      acceptedCurrentVersion: true,
      acceptedVersion: activeVersion?.version || TUTOR_AGREEMENT_DEFAULT_VERSION,
      acceptedAt: new Date().toISOString(),
      acceptanceId,
      latestAcceptedVersion: activeVersion?.version || TUTOR_AGREEMENT_DEFAULT_VERSION,
      latestAcceptedAt: new Date().toISOString(),
      latestAcceptanceId: acceptanceId,
      latestAcceptancePdfUrl: pdfUrl || '',
      acceptedByUserId: acceptanceUserId,
    },
  };
}

async function uploadAgreementPdf({
  admin,
  acceptanceId,
  userId,
  version,
  documentTitle,
  effectiveDate,
  contentMarkdown,
  acceptance,
}) {
  const bucket = admin.storage().bucket();
  const pdfBuffer = await buildAgreementPdfBuffer({
    title: documentTitle,
    version,
    effectiveDate,
    legalEntityName: LEGAL_ENTITY_NAME,
    contentMarkdown,
    acceptance,
  });
  const filePath = `tutor-agreements/${userId}/${version}/${acceptanceId}.pdf`;
  const file = bucket.file(filePath);
  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=0, no-store',
      metadata: {
        userId,
        version,
        acceptanceId,
        documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
      },
    },
  });
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: '01-01-2500',
  });
  return signedUrl;
}

async function acceptTutorAgreement({
  db,
  admin,
  user,
  typedSignatureName,
  checkboxAccepted,
  ipAddress = '',
  userAgent = '',
}) {
  if (!user?.uid) {
    throw new Error('You must be signed in to accept the Tutor Agreement.');
  }

  const activeBundle = await getTutorAgreementBundle({ db, admin, userId: user.uid });
  const activeVersion = activeBundle.activeVersion;
  if (!activeVersion) {
    throw new Error('The active Tutor Agreement is not available right now.');
  }

  const tutorAgreement = user?.tutorAgreement || {};
  const requiredVersion = normalizeVersionInput(tutorAgreement.requiredVersion || activeVersion.version);
  if (normalizeVersionInput(activeVersion.version) !== requiredVersion) {
    throw new Error('Please refresh and review the latest Tutor Agreement before accepting.');
  }

  const signatureName = String(typedSignatureName || '').trim();
  if (!checkboxAccepted) {
    throw new Error('You must confirm that you accept the Tutor Agreement.');
  }

  if (!signatureName) {
    throw new Error('Please type your full legal name to sign the Tutor Agreement.');
  }

  const acceptanceId = `${user.uid}_${activeVersion.version}`;
  const acceptanceRef = db.collection('userAgreementAcceptances').doc(acceptanceId);
  const acceptanceSnap = await acceptanceRef.get();
  const existingAcceptance = acceptanceSnap.exists ? acceptanceSnap.data() : null;
  if (existingAcceptance?.pdfUrl) {
    const userSnapshot = buildUserAgreementSnapshot({
      userId: user.uid,
      tutorId: user.tutorId || user.uid,
      user,
      activeVersion,
      acceptanceId,
      pdfUrl: existingAcceptance.pdfUrl,
    });

    await db.collection('users').doc(user.uid).set({
      ...userSnapshot,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      acceptanceId,
      acceptance: {
        id: acceptanceId,
        ...existingAcceptance,
        createdAt: existingAcceptance.createdAt || null,
        updatedAt: existingAcceptance.updatedAt || null,
      },
      pdfUrl: existingAcceptance.pdfUrl,
      activeVersion: { id: activeVersion.id, ...activeVersion },
    };
  }

  const nowIso = new Date().toISOString();
  const acceptance = {
    userId: user.uid,
    tutorId: user.tutorId || user.uid,
    documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
    version: activeVersion.version,
    acceptedAt: nowIso,
    acceptedByFullName: String(user.fullName || user.displayName || '').trim() || signatureName,
    acceptedByEmail: String(user.email || '').trim(),
    ipAddress: String(ipAddress || '').trim(),
    userAgent: String(userAgent || '').trim(),
    signatureType: 'checkbox_and_typed_name',
    typedSignatureName: signatureName,
    checkboxAccepted: true,
    legalEntityName: LEGAL_ENTITY_NAME,
    documentTitle: activeVersion.title || TUTOR_AGREEMENT_TITLE,
    documentEffectiveDate: activeVersion.effectiveDate || '',
    contentHash: activeVersion.contentHash || computeContentHash(activeVersion.contentMarkdown || ''),
    immutableContentSnapshot: activeVersion.contentMarkdown || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const pdfUrl = await uploadAgreementPdf({
    admin,
    acceptanceId,
    userId: user.uid,
    version: activeVersion.version,
    documentTitle: activeVersion.title || TUTOR_AGREEMENT_TITLE,
    effectiveDate: activeVersion.effectiveDate || '',
    contentMarkdown: activeVersion.contentMarkdown || '',
    acceptance,
  });

  acceptance.pdfUrl = pdfUrl;

  await db.runTransaction(async (transaction) => {
    transaction.set(acceptanceRef, {
      ...acceptance,
      pdfUrl,
    }, { merge: true });

    transaction.set(
      db.collection('users').doc(user.uid),
      {
        ...buildUserAgreementSnapshot({
          userId: user.uid,
          tutorId: user.tutorId || user.uid,
          user,
          activeVersion,
          acceptanceId,
          pdfUrl,
        }),
        tutorProfile: {
          ...(user.tutorProfile || {}),
          verificationStatus: user.tutorProfile?.verificationStatus || 'pending',
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return {
    acceptanceId,
    acceptance: {
      id: acceptanceId,
      ...acceptance,
      createdAt: nowIso,
      updatedAt: nowIso,
      pdfUrl,
    },
    pdfUrl,
    activeVersion: { id: activeVersion.id, ...activeVersion },
  };
}

async function publishTutorAgreementVersion({
  db,
  admin,
  version,
  title = TUTOR_AGREEMENT_TITLE,
  effectiveDate = '',
  contentMarkdown = '',
  changeSummary = '',
  updatedBy = 'admin',
  status = TUTOR_AGREEMENT_STATUS.ACTIVE,
}) {
  const normalizedVersion = normalizeVersionInput(version);
  if (!normalizedVersion) {
    throw new Error('Version is required.');
  }

  const versionId = makeVersionDocId(normalizedVersion);
  const documentRef = db.collection('legalDocuments').doc(TUTOR_AGREEMENT_DOCUMENT_ID);
  const versionRef = db.collection('legalDocumentVersions').doc(versionId);
  const content = String(contentMarkdown || buildTutorAgreementMarkdown()).trim();
  const contentHash = computeContentHash(content);
  const now = new Date();
  const isActivePublish = status === TUTOR_AGREEMENT_STATUS.ACTIVE;

  await db.runTransaction(async (transaction) => {
    const documentSnap = await transaction.get(documentRef);
    const existingDocument = documentSnap.exists ? documentSnap.data() : {};
    const previousVersionId = existingDocument.currentVersionId || null;

    transaction.set(versionRef, {
      documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
      version: normalizedVersion,
      title,
      effectiveDate: effectiveDate || now.toISOString(),
      status,
      contentMarkdown: content,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: updatedBy || 'admin',
      legalEntityName: LEGAL_ENTITY_NAME,
      changeSummary: String(changeSummary || '').trim(),
      contentHash,
    }, { merge: true });

    if (isActivePublish && previousVersionId && previousVersionId !== versionId) {
      transaction.set(db.collection('legalDocumentVersions').doc(previousVersionId), {
        status: TUTOR_AGREEMENT_STATUS.ARCHIVED,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy,
      }, { merge: true });
    }

    if (isActivePublish) {
      transaction.set(documentRef, {
        documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
        title,
        currentVersion: normalizedVersion,
        currentVersionId: versionId,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy,
        legalEntityName: LEGAL_ENTITY_NAME,
      }, { merge: true });
    }
  });

  if (isActivePublish) {
    const tutorsSnap = await db.collection('users').where('activeRole', '==', 'tutor').get();
    const docs = tutorsSnap.docs;
    const batchSize = 400;
    for (let index = 0; index < docs.length; index += batchSize) {
      const batch = db.batch();
      docs.slice(index, index + batchSize).forEach((item) => {
        batch.set(item.ref, {
          tutorAgreement: {
            ...(item.data()?.tutorAgreement || {}),
            documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
            title,
            legalEntityName: LEGAL_ENTITY_NAME,
            requiredVersion: normalizedVersion,
            requiredVersionId: versionId,
            currentVersion: normalizedVersion,
            currentVersionId: versionId,
            currentVersionEffectiveDate: effectiveDate || now.toISOString(),
            currentVersionContentHash: contentHash,
            currentVersionAccepted: false,
            acceptedCurrentVersion: false,
            acceptedVersion: item.data()?.tutorAgreement?.acceptedVersion || '',
            acceptedAt: item.data()?.tutorAgreement?.acceptedAt || null,
            acceptanceId: item.data()?.tutorAgreement?.acceptanceId || '',
            latestAcceptedVersion: item.data()?.tutorAgreement?.latestAcceptedVersion || '',
            latestAcceptedAt: item.data()?.tutorAgreement?.latestAcceptedAt || null,
            latestAcceptanceId: item.data()?.tutorAgreement?.latestAcceptanceId || '',
            latestAcceptancePdfUrl: item.data()?.tutorAgreement?.latestAcceptancePdfUrl || '',
          },
          tutorProfile: {
            ...(item.data()?.tutorProfile || {}),
            verificationStatus: 'pending',
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    }
  }

  return {
    version: normalizedVersion,
    versionId,
    title,
    effectiveDate: effectiveDate || now.toISOString(),
    status,
    contentMarkdown: content,
    contentHash,
    legalEntityName: LEGAL_ENTITY_NAME,
  };
}

module.exports = {
  LEGAL_ENTITY_NAME,
  TUTOR_AGREEMENT_DOCUMENT_ID,
  TUTOR_AGREEMENT_TITLE,
  TUTOR_AGREEMENT_DEFAULT_VERSION,
  TUTOR_AGREEMENT_STATUS,
  buildTutorAgreementMarkdown,
  computeContentHash,
  ensureTutorAgreementSeeded,
  getTutorAgreementBundle,
  isTutorAgreementCurrent,
  acceptTutorAgreement,
  publishTutorAgreementVersion,
  makeVersionDocId,
};
