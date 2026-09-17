import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { normalizeSubjectList } from '../../constants/subjects';
import { getTutorOnboardingStatus, isTutorAgreementCurrent } from '../../constants/onboarding';
import { upsertTutorProfile } from '../../services/userService';
import {
  FALLBACK_SOUTH_AFRICAN_BANKS,
  listTutorPayoutBanks,
  verifyTutorPayoutAccount,
} from '../../services/tutorPayoutService';
import {
  deleteTutorResultsDocument,
  normalizeDocumentStatus,
  retryTutorResultsDocument,
  subscribeToTutorResultsDocuments,
  uploadTutorIdDocument,
  uploadTutorPoliceClearanceDocument,
  uploadTutorResultsDocument,
  uploadTutorSelfie,
} from '../../services/tutorDocumentService';
import { colors } from '../../theme/colors';

const STEPS = [
  {
    id: 'agreement',
    eyebrow: 'Tutor agreement',
    title: 'Start with trust',
    subtitle: 'Review and sign the tutor agreement before receiving student offers.',
    icon: 'document-text-outline',
  },
  {
    id: 'profile',
    eyebrow: 'Your tutor profile',
    title: "Let's get to know you",
    subtitle: 'Add the details students and Parakleo use to understand your teaching background.',
    icon: 'person-outline',
  },
  {
    id: 'subjects',
    eyebrow: 'Teaching subjects',
    title: 'Your learning expertise',
    subtitle: 'Select the subjects you are qualified to teach.',
    icon: 'school-outline',
  },
  {
    id: 'clearance',
    eyebrow: 'Safety & ID verification',
    title: 'Confirm your documents',
    subtitle: 'Submit your police clearance and official ID document for admin verification.',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'payout',
    eyebrow: 'Banking details',
    title: 'Set up weekly payouts',
    subtitle: 'Add the bank account where your tutor earnings should be paid.',
    icon: 'wallet-outline',
  },
];

const STEP_INDEX_BY_ID = STEPS.reduce((acc, step, index) => ({ ...acc, [step.id]: index }), {});
const PROCESSING_RETRY_AFTER_MS = 2 * 60 * 1000;

function timestampToMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInitialStepIndex(initialStep, onboardingStatus) {
  const stepId = initialStep || onboardingStatus?.firstMissingStep || 'agreement';
  return STEP_INDEX_BY_ID[stepId] ?? 0;
}

function getInitials(firstName, surname) {
  return `${String(firstName || '').trim().charAt(0)}${String(surname || '').trim().charAt(0)}`.toUpperCase() || 'T';
}

function StepActions({
  activeStep,
  loading,
  continueLabel = 'Continue',
  continueDisabled = false,
  onContinue,
  onBack,
}) {
  return (
    <View style={styles.stepActions}>
      <Button
        variant="primary"
        size="lg"
        onPress={onContinue}
        loading={loading}
        disabled={continueDisabled}
        style={styles.continueBtn}
      >
        {continueLabel}
      </Button>
      <Button
        variant="outline"
        size="md"
        onPress={onBack}
        style={styles.backBtn}
      >
        {activeStep === 0 ? 'Back' : 'Back'}
      </Button>
    </View>
  );
}

export function TutorOnboardingScreen({ route, navigate, goBack }) {
  const { user, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(user), [user]);
  const [activeStep, setActiveStep] = useState(() => getInitialStepIndex(route?.params?.initialStep, onboardingStatus));
  const [loading, setLoading] = useState(false);
  const [uploadingResults, setUploadingResults] = useState(false);
  const [retryingDocumentId, setRetryingDocumentId] = useState('');
  const [deletingDocumentId, setDeletingDocumentId] = useState('');
  const [uploadingClearance, setUploadingClearance] = useState(false);
  const [uploadingIdDocument, setUploadingIdDocument] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [selfieCameraVisible, setSelfieCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [processingClock, setProcessingClock] = useState(Date.now());
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Rejection feedback detection
  const rejectionReason = user?.tutorProfile?.rejectionReason || user?.tutorProfile?.rejectionFeedback || user?.rejectionReason || '';
  const isRejected = (user?.tutorProfile?.verificationStatus || user?.verificationStatus || '').toLowerCase() === 'rejected';

  // Step 2: Profile Fields
  const fullNameParts = String(user?.fullName || user?.displayName || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(user?.firstName || user?.tutorProfile?.firstName || fullNameParts[0] || '');
  const [surname, setSurname] = useState(user?.surname || user?.tutorProfile?.surname || fullNameParts.slice(1).join(' ') || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || user?.tutorProfile?.phone || '');
  const [biography, setBiography] = useState(user?.tutorProfile?.biography || '');
  const [selfieUrl, setSelfieUrl] = useState(user?.selfieUrl || user?.profilePhoto || '');

  // Step 3: Qualified Subjects
  const [resultsDocuments, setResultsDocuments] = useState([]);
  const [teachingSubjects, setTeachingSubjects] = useState(user?.tutorProfile?.teachingSubjects || []);

  // Step 4: Clearance & KYC
  const [policeClearance, setPoliceClearance] = useState(user?.tutorProfile?.policeClearance || null);
  const [idDocument, setIdDocument] = useState(user?.tutorProfile?.idDocument || null);

  // Step 5: Banking / Payout
  const existingPayout =
    (user?.tutorProfile?.payout?.accountNumber ? user?.tutorProfile?.payout : null) ||
    (user?.tutorProfile?.bankingDetails?.accountNumber ? user?.tutorProfile?.bankingDetails : null) ||
    (user?.payout?.accountNumber ? user?.payout : null) ||
    (user?.bankingDetails?.accountNumber ? user?.bankingDetails : null) ||
    user?.tutorProfile?.payout ||
    user?.tutorProfile?.bankingDetails ||
    {};
  const [payoutBanks, setPayoutBanks] = useState(FALLBACK_SOUTH_AFRICAN_BANKS);
  const [selectedBankCode, setSelectedBankCode] = useState(existingPayout?.bankCode || '');
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [accountNumber, setAccountNumber] = useState(existingPayout?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(existingPayout?.accountHolder || user?.fullName || '');
  const [idNumber, setIdNumber] = useState(existingPayout?.idNumber || existingPayout?.documentNumber || '');
  const [accountType] = useState(existingPayout?.accountType || 'personal');
  const [documentType, setDocumentType] = useState(existingPayout?.documentType || 'identityNumber');

  const isAgreementSigned = isTutorAgreementCurrent(user);
  const currentStep = STEPS[activeStep] || STEPS[0];
  const progressPercent = Math.round(((activeStep + 1) / STEPS.length) * 100);

  useEffect(() => {
    setActiveStep(getInitialStepIndex(route?.params?.initialStep, onboardingStatus));
  }, [onboardingStatus.firstMissingStep, route?.params?.initialStep]);

  useEffect(() => {
    listTutorPayoutBanks().then((banks) => {
      if (banks && banks.length > 0) setPayoutBanks(banks);
    });
  }, []);

  useEffect(() => subscribeToTutorResultsDocuments(user?.uid, setResultsDocuments), [user?.uid]);

  useEffect(() => {
    const intervalId = setInterval(() => setProcessingClock(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, []);

  const qualifiedSubjectsFromResults = useMemo(() => {
    const bySubject = new Map();
    resultsDocuments.forEach((document) => {
      if (normalizeDocumentStatus(document.status) !== 'VERIFIED') return;
      (document.qualifiedSubjects || []).forEach((item) => {
        const subject = String(item?.subject || item || '').trim();
        if (!subject) return;
        const mark = Number(item?.mark);
        const existing = bySubject.get(subject);
        if (!existing || mark > Number(existing.mark || 0)) {
          bySubject.set(subject, {
            subject,
            mark: Number.isFinite(mark) ? mark : null,
          });
        }
      });
    });
    return [...bySubject.values()];
  }, [resultsDocuments]);

  useEffect(() => {
    if (!qualifiedSubjectsFromResults.length) return;
    const nextSubjects = qualifiedSubjectsFromResults.map((item) => item.subject);
    setTeachingSubjects((current) => {
      const currentSet = new Set(current);
      const merged = normalizeSubjectList([...current, ...nextSubjects]);
      return merged.length === currentSet.size && merged.every((item) => currentSet.has(item)) ? current : merged;
    });
  }, [qualifiedSubjectsFromResults]);

  const toggleSubject = (subject) => {
    if (teachingSubjects.includes(subject)) {
      setTeachingSubjects(teachingSubjects.filter((s) => s !== subject));
    } else {
      setTeachingSubjects([...teachingSubjects, subject]);
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !surname.trim() || !phoneNumber.trim() || !selfieUrl) {
      setErrorMessage('Name, surname, cell phone, and a profile selfie are required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      const fullName = `${firstName.trim()} ${surname.trim()}`.trim();
      const updated = await upsertTutorProfile(user.uid, {
        firstName: firstName.trim(),
        surname: surname.trim(),
        fullName,
        displayName: fullName,
        phoneNumber: phoneNumber.trim(),
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          firstName: firstName.trim(),
          surname: surname.trim(),
          phone: phoneNumber.trim(),
          biography: biography.trim(),
        },
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setStatusMessage('Profile information saved.');
      setActiveStep(2);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubjects = async () => {
    const qualifiedSubjectNames = qualifiedSubjectsFromResults.map((item) => item.subject);
    const safeSubjects = normalizeSubjectList(teachingSubjects).filter((subject) => qualifiedSubjectNames.includes(subject));

    if (safeSubjects.length === 0) {
      setErrorMessage('Upload your results and wait for AI verification before continuing.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      const updated = await upsertTutorProfile(user.uid, {
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          teachingSubjects: safeSubjects,
        },
        qualifiedSubjects: qualifiedSubjectsFromResults,
        activeSubjects: safeSubjects,
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setStatusMessage('Teaching subjects saved.');
      setActiveStep(3);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to save subjects.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadResults = async () => {
    try {
      setUploadingResults(true);
      setErrorMessage('');
      setStatusMessage('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      await uploadTutorResultsDocument({ uid: user.uid, asset });
      setStatusMessage('Results uploaded. AI verification will update this step automatically.');
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to upload results document.');
    } finally {
      setUploadingResults(false);
    }
  };

  const handleRetryResultsDocument = async (documentId) => {
    try {
      setRetryingDocumentId(documentId);
      setErrorMessage('');
      await retryTutorResultsDocument({ documentId });
      setStatusMessage('AI verification has been queued again.');
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to retry this document.');
    } finally {
      setRetryingDocumentId('');
    }
  };

  const handleDeleteResultsDocument = (document) => {
    Alert.alert(
      'Delete results document?',
      'This will permanently remove the uploaded file and its processing record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingDocumentId(document.id);
              setErrorMessage('');
              await deleteTutorResultsDocument({ documentId: document.id, filePath: document.filePath });
              setStatusMessage('Results document deleted.');
            } catch (err) {
              setErrorMessage(err?.message || 'Unable to delete this results document.');
            } finally {
              setDeletingDocumentId('');
            }
          },
        },
      ],
    );
  };

  const handleOpenSelfieCamera = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission?.granted) {
      setErrorMessage('Camera permission is required to capture your selfie.');
      return;
    }
    setCameraError('');
    setCameraReady(false);
    setSelfieCameraVisible(true);
  };

  const handleCloseSelfieCamera = (force = false) => {
    if (uploadingSelfie && !force) return;
    setSelfieCameraVisible(false);
    setCameraReady(false);
    setCameraError('');
  };

  const handleCaptureSelfie = async () => {
    if (!cameraRef.current || uploadingSelfie) return;
    if (!cameraReady) {
      setCameraError('Camera is still starting. Please wait a moment and try again.');
      return;
    }

    try {
      setUploadingSelfie(true);
      let captureTimeout;
      let photo;
      try {
        photo = await Promise.race([
          cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false }),
          new Promise((_, reject) => {
            captureTimeout = setTimeout(() => reject(new Error('Camera capture timed out. Please close and reopen the camera.')), 15000);
          }),
        ]);
      } finally {
        clearTimeout(captureTimeout);
      }
      if (!photo?.uri || !photo?.width || !photo?.height) {
        throw new Error('The camera did not return a usable photo. Please try again.');
      }
      const side = Math.min(photo.width, photo.height);
      const cropped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: Math.round((photo.width - side) / 2), originY: Math.round((photo.height - side) / 2), width: side, height: side } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      const uploaded = await uploadTutorSelfie({
        uid: user.uid,
        asset: { uri: cropped.uri, name: `selfie-${Date.now()}.jpg`, mimeType: 'image/jpeg' },
      });
      const updated = await upsertTutorProfile(user.uid, {
        selfieUrl: uploaded.fileUrl,
        profilePhoto: uploaded.fileUrl,
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          selfie: {
            fileUrl: uploaded.fileUrl,
            filePath: uploaded.filePath,
            fileName: uploaded.fileName,
            uploadedAt: new Date().toISOString(),
          },
        },
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setSelfieUrl(uploaded.fileUrl);
      handleCloseSelfieCamera(true);
      setStatusMessage('Selfie uploaded.');
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to capture your selfie.');
    } finally {
      setUploadingSelfie(false);
    }
  };

  const handleUploadClearance = async () => {
    try {
      setUploadingClearance(true);
      setErrorMessage('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      const uploaded = await uploadTutorPoliceClearanceDocument({ uid: user.uid, asset });
      const updated = await upsertTutorProfile(user.uid, {
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          policeClearance: {
            documentId: uploaded.id || `${user.uid}-${Date.now()}`,
            fileUrl: uploaded.fileUrl,
            filePath: uploaded.filePath,
            fileName: uploaded.fileName,
            contentType: uploaded.contentType,
            status: 'UPLOADED',
          },
          policeClearanceSubmittedAt: new Date().toISOString(),
        },
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setPoliceClearance(updated?.tutorProfile?.policeClearance || null);
      setStatusMessage('Police clearance uploaded for review.');
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to upload police clearance.');
    } finally {
      setUploadingClearance(false);
    }
  };

  const handleUploadIdDocument = async () => {
    try {
      setUploadingIdDocument(true);
      setErrorMessage('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      const uploaded = await uploadTutorIdDocument({ uid: user.uid, asset });
      const updated = await upsertTutorProfile(user.uid, {
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          idDocument: {
            documentId: uploaded.id || `${user.uid}-${Date.now()}`,
            fileUrl: uploaded.fileUrl,
            filePath: uploaded.filePath,
            fileName: uploaded.fileName,
            contentType: uploaded.contentType,
            status: 'UPLOADED',
          },
          idVerificationUrl: uploaded.fileUrl,
          idDocumentSubmittedAt: new Date().toISOString(),
        },
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setIdDocument(updated?.tutorProfile?.idDocument || null);
      setStatusMessage('ID document uploaded for review.');
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to upload ID document.');
    } finally {
      setUploadingIdDocument(false);
    }
  };

  const handleSaveClearance = () => {
    if (!policeClearance?.fileUrl || !idDocument?.fileUrl) {
      setErrorMessage('Both police clearance and South African ID or passport are required before continuing.');
      return;
    }
    setErrorMessage('');
    setActiveStep(4);
  };

  const handleSavePayout = async () => {
    if (!selectedBankCode || !accountNumber.trim() || !accountHolder.trim() || !idNumber.trim()) {
      setErrorMessage('Select a bank and complete the account holder, account number, and ID or passport details.');
      return;
    }

    const selectedBank = payoutBanks.find((bank) => bank.code === selectedBankCode);
    if (!selectedBank) {
      setErrorMessage('Select a valid bank before continuing.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStatusMessage('Saving banking details and running verification...');

      const payoutData = await verifyTutorPayoutAccount({
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        accountType,
        documentType,
        documentNumber: idNumber.trim(),
      });

      const normalizedPayout = {
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        branchCode: selectedBank.code,
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        accountType,
        documentType,
        documentNumber: idNumber.trim(),
        verified: payoutData?.verified ?? (payoutData?.verificationStatus === 'verified' || true),
        verificationStatus: payoutData?.verificationStatus || 'verified',
        ...(typeof payoutData === 'object' ? payoutData : {}),
      };

      const updated = await upsertTutorProfile(user.uid, {
        payout: normalizedPayout,
        bankingDetails: normalizedPayout,
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          payout: normalizedPayout,
          bankingDetails: normalizedPayout,
        },
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setStatusMessage('Tutor profile & banking setup complete!');
      Alert.alert(
        'Onboarding Submitted for Review',
        'Your tutor profile and right-to-work documents have been submitted for manual admin verification. You will be able to go online once your documents are approved by our compliance team.',
        [{
          text: 'View Status',
          onPress: () => {
            if (typeof navigate === 'function') {
              navigate('ReviewStatus');
            } else if (typeof goBack === 'function') {
              goBack();
            }
          },
        }],
      );
    } catch (err) {
      setErrorMessage(err?.message || 'Unable to save banking details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 12, 24), paddingBottom: Math.max(insets.bottom + 28, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Text style={styles.stepCounter}>Step {activeStep + 1} of {STEPS.length}</Text>
          <Text style={styles.progressText}>{progressPercent}% Complete</Text>
        </View>
        <View style={styles.progressRail}>
          {STEPS.map((step, index) => (
            <Pressable
              key={step.id}
              onPress={() => setActiveStep(index)}
              style={[
                styles.progressSegment,
                index <= activeStep && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.hero}>
          <View style={styles.iconTile}>
            <Ionicons name={currentStep.icon} size={30} color={colors.brandDark} />
          </View>
          <Text style={styles.eyebrow}>{currentStep.eyebrow}</Text>
          <Text style={styles.stepHeader}>{currentStep.title}</Text>
          <Text style={styles.stepDescription}>{currentStep.subtitle}</Text>
        </View>

        {statusMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {isRejected && rejectionReason ? (
          <View style={styles.rejectionBanner}>
            <View style={styles.rejectionBannerHeader}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.rejectionBannerTitle}>Verification Feedback</Text>
            </View>
            <Text style={styles.rejectionBannerText}>{rejectionReason}</Text>
            <Text style={styles.rejectionBannerHint}>
              Please review the feedback above and re-upload the requested documents below.
            </Text>
          </View>
        ) : null}

        {/* STEP 0: Agreement */}
        {activeStep === 0 && (
          <View style={styles.panel}>
            <View style={styles.agreementStatusCard}>
              <View style={styles.agreementRow}>
                <Ionicons
                  name={isAgreementSigned ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={isAgreementSigned ? colors.brand : colors.amber}
                />
                <View style={styles.agreementTextCol}>
                  <Text style={styles.agreementStatusTitle}>
                    {isAgreementSigned ? 'Agreement Signed & Current' : 'Agreement Signature Required'}
                  </Text>
                  <Text style={styles.agreementStatusSubtitle}>
                    Version: {user?.agreements?.tutorAgreementVersion || '1.0.1'}
                  </Text>
                </View>
              </View>
            </View>

            <StepActions
              activeStep={activeStep}
              continueLabel={isAgreementSigned ? 'Continue' : 'Sign Tutor Agreement'}
              onContinue={() => {
                if (isAgreementSigned) {
                  setActiveStep(1);
                  return;
                }
                navigate('Agreement');
              }}
              onBack={goBack}
            />
          </View>
        )}

        {/* STEP 1: Personal Profile */}
        {activeStep === 1 && (
          <View style={styles.panel}>
            <Pressable
              onPress={handleOpenSelfieCamera}
              accessibilityRole="button"
              accessibilityLabel={selfieUrl ? 'Replace profile selfie' : 'Add profile selfie'}
              style={styles.selfieAvatarButton}
            >
              {selfieUrl ? (
                <Image source={{ uri: selfieUrl }} style={styles.selfieAvatarImage} />
              ) : (
                <View style={styles.selfieAvatarPlaceholder}>
                  <Text style={styles.selfieInitials}>{getInitials(firstName, surname)}</Text>
                </View>
              )}
              <View style={[styles.selfieAvatarBadge, selfieUrl && styles.selfieAvatarBadgeSuccess]}>
                <Ionicons name={selfieUrl ? 'checkmark' : 'add'} size={18} color={colors.surface} />
              </View>
            </Pressable>
            <FormField
              label="Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Sipho"
            />

            <FormField
              label="Surname"
              value={surname}
              onChangeText={setSurname}
              placeholder="e.g. Ndlovu"
            />

            <FormField
              label="Cell phone"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="082 123 4567"
              keyboardType="phone-pad"
            />

            <FormField
              label="Bio"
              value={biography}
              onChangeText={setBiography}
              placeholder="Tell students a little about your teaching style and experience."
              multiline
              numberOfLines={4}
            />

            <StepActions
              activeStep={activeStep}
              loading={loading}
              continueLabel="Continue"
              onContinue={handleSaveProfile}
              onBack={() => setActiveStep(Math.max(0, activeStep - 1))}
            />
          </View>
        )}

        {/* STEP 2: Qualified Subjects */}
        {activeStep === 2 && (
          <View style={styles.panel}>
            <Button
              variant="primary"
              size="md"
              onPress={handleUploadResults}
              loading={uploadingResults}
              style={styles.uploadBtn}
            >
              Upload Results
            </Button>

            <View style={styles.documentList}>
              {resultsDocuments.length ? resultsDocuments.map((document) => {
                const status = normalizeDocumentStatus(document.status);
                const isProcessingStuck = status === 'PROCESSING'
                  && (processingClock - timestampToMillis(document.updatedAt) >= PROCESSING_RETRY_AFTER_MS);
                const isRetryable = status === 'FAILED' || isProcessingStuck;
                const isProcessing = status === 'UPLOADED' || status === 'PROCESSING';
                const isRetrying = retryingDocumentId === document.id;
                const isDeleting = deletingDocumentId === document.id;
                return (
                  <View key={document.id} style={styles.documentRow}>
                    <View style={styles.documentIcon}>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.brandDark} />
                      ) : (
                        <Ionicons
                          name={status === 'VERIFIED' ? 'checkmark-circle' : 'close-circle'}
                          size={22}
                          color={status === 'VERIFIED' ? colors.brandDark : colors.danger}
                        />
                      )}
                    </View>
                    <View style={styles.documentTextCol}>
                      <Text style={styles.documentName}>{document.fileName || 'Results document'}</Text>
                      <Text style={styles.documentStatus}>
                        {status === 'VERIFIED'
                          ? 'AI verification complete'
                          : status === 'FAILED'
                            ? document.error || 'AI verification failed'
                            : 'AI verification in progress'}
                      </Text>
                    </View>
                    {isRetryable ? (
                      <View style={styles.documentActions}>
                        <Pressable
                          onPress={() => handleRetryResultsDocument(document.id)}
                          disabled={isRetrying || isDeleting}
                          accessibilityRole="button"
                          accessibilityLabel="Retry document verification"
                          style={[styles.documentActionButton, styles.retryButton, (isRetrying || isDeleting) && styles.documentActionButtonDisabled]}
                        >
                          {isRetrying ? <ActivityIndicator size="small" color={colors.brandDark} /> : <Ionicons name="refresh" size={18} color={colors.brandDark} />}
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteResultsDocument(document)}
                          disabled={isRetrying || isDeleting}
                          accessibilityRole="button"
                          accessibilityLabel="Delete results document"
                          style={[styles.documentActionButton, styles.deleteButton, (isRetrying || isDeleting) && styles.documentActionButtonDisabled]}
                        >
                          {isDeleting ? <ActivityIndicator size="small" color={colors.danger} /> : <Ionicons name="close" size={20} color={colors.danger} />}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              }) : (
                <View style={styles.emptyDocumentState}>
                  <Ionicons name="cloud-upload-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.emptyDocumentTitle}>Upload your latest results</Text>
                  <Text style={styles.emptyDocumentText}>
                    The deployed AI extraction flow will read your document and unlock the subjects you qualify to teach.
                  </Text>
                </View>
              )}
            </View>

            {qualifiedSubjectsFromResults.length ? (
              <>
                <Text style={styles.subHeader}>Qualified subjects from your results</Text>
                <View style={styles.subjectGrid}>
                  {qualifiedSubjectsFromResults.map((item) => {
                    const subject = item.subject;
                    const isSelected = teachingSubjects.includes(subject);
                    return (
                      <Pressable
                        key={subject}
                        onPress={() => toggleSubject(subject)}
                        style={[styles.subjectTile, isSelected && styles.subjectTileSelected]}
                      >
                        <View style={styles.subjectIcon}>
                          <Ionicons name="book-outline" size={22} color={isSelected ? colors.brandDark : colors.textMuted} />
                        </View>
                        <Text style={[styles.subjectTileText, isSelected && styles.subjectTileTextSelected]}>
                          {subject}
                        </Text>
                        {item.mark !== null ? <Text style={styles.subjectMark}>{item.mark}%</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <StepActions
              activeStep={activeStep}
              loading={loading}
              continueLabel="Continue"
              onContinue={handleSaveSubjects}
              onBack={() => setActiveStep(Math.max(0, activeStep - 1))}
              continueDisabled={!qualifiedSubjectsFromResults.length}
            />
          </View>
        )}

        {/* STEP 3: Clearance & KYC */}
        {activeStep === 3 && (
          <View style={styles.panel}>
            <Text style={styles.clearanceDescription}>
              Upload your safety and identity documents. These will be reviewed by our admin team before your tutor profile is verified.
            </Text>

            {/* 1. Police Clearance */}
            <Text style={styles.subHeader}>1. Police Clearance Certificate</Text>
            <Button
              variant="primary"
              size="md"
              onPress={handleUploadClearance}
              loading={uploadingClearance}
              style={styles.uploadBtn}
            >
              Upload Police Clearance
            </Button>

            {policeClearance?.fileUrl ? (
              <View style={styles.clearanceDocumentCard}>
                <View style={styles.documentIcon}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.brandDark} />
                </View>
                <View style={styles.documentTextCol}>
                  <Text style={styles.documentName}>{policeClearance.fileName || 'Police clearance document'}</Text>
                  <Text style={styles.documentStatus}>Uploaded and awaiting review</Text>
                </View>
              </View>
            ) : null}

            {/* 2. Official ID Document */}
            <Text style={[styles.subHeader, { marginTop: 16 }]}>2. South African ID or Passport</Text>
            <Button
              variant="outline"
              size="md"
              onPress={handleUploadIdDocument}
              loading={uploadingIdDocument}
              style={styles.uploadBtn}
            >
              Upload ID Document
            </Button>

            {idDocument?.fileUrl ? (
              <View style={styles.clearanceDocumentCard}>
                <View style={styles.documentIcon}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.brandDark} />
                </View>
                <View style={styles.documentTextCol}>
                  <Text style={styles.documentName}>{idDocument.fileName || 'ID document'}</Text>
                  <Text style={styles.documentStatus}>Uploaded and awaiting review</Text>
                </View>
              </View>
            ) : null}

            <StepActions
              activeStep={activeStep}
              loading={loading}
              continueLabel="Continue"
              onContinue={handleSaveClearance}
              onBack={() => setActiveStep(Math.max(0, activeStep - 1))}
              continueDisabled={!policeClearance?.fileUrl || !idDocument?.fileUrl}
            />
          </View>
        )}

        {/* STEP 4: Payout & Banking Details */}
        {activeStep === 4 && (
          <View style={styles.panel}>
            <Text style={styles.subHeader}>Bank</Text>
            <Pressable
              onPress={() => setBankPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select bank"
              style={styles.bankSelect}
            >
              <Text style={[styles.bankSelectText, !selectedBankCode && styles.bankSelectPlaceholder]}>
                {payoutBanks.find((bank) => bank.code === selectedBankCode)?.name || 'Select a bank'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>

            <FormField
              label="Account Number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="e.g. 1234567890"
              keyboardType="number-pad"
            />

            <FormField
              label="Account Holder Name"
              value={accountHolder}
              onChangeText={setAccountHolder}
              placeholder="e.g. Sipho Ndlovu"
            />

            <FormField
              label={documentType === 'passportNumber' ? 'Passport Number' : 'South African ID Number'}
              value={idNumber}
              onChangeText={setIdNumber}
              placeholder={documentType === 'passportNumber' ? 'Passport number' : '13-digit SA ID number'}
            />

            <Text style={styles.subHeader}>Verification document</Text>
            <View style={styles.documentTypeRow}>
              {[
                { id: 'identityNumber', label: 'South African ID' },
                { id: 'passportNumber', label: 'Passport' },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setDocumentType(option.id)}
                  style={[styles.documentTypeOption, documentType === option.id && styles.documentTypeOptionSelected]}
                >
                  <Text style={[styles.documentTypeText, documentType === option.id && styles.documentTypeTextSelected]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <StepActions
              activeStep={activeStep}
              loading={loading}
              continueLabel="Complete Onboarding"
              onContinue={handleSavePayout}
              onBack={() => setActiveStep(Math.max(0, activeStep - 1))}
            />
          </View>
        )}
      </ScrollView>

      <Modal
        visible={bankPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <Pressable style={styles.bankPickerBackdrop} onPress={() => setBankPickerVisible(false)}>
          <Pressable style={styles.bankPickerSheet} onPress={() => {}}>
            <View style={styles.bankPickerHeader}>
              <Text style={styles.bankPickerTitle}>Select a bank</Text>
              <Pressable onPress={() => setBankPickerVisible(false)} style={styles.bankPickerClose} accessibilityLabel="Close bank list">
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {payoutBanks.map((bank) => {
                const selected = bank.code === selectedBankCode;
                return (
                  <Pressable
                    key={bank.code}
                    onPress={() => {
                      setSelectedBankCode(bank.code);
                      setBankPickerVisible(false);
                    }}
                    style={styles.bankOption}
                  >
                    <Text style={styles.bankOptionText}>{bank.name}</Text>
                    {selected ? <Ionicons name="checkmark" size={20} color={colors.brandDark} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selfieCameraVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseSelfieCamera}
      >
        <View style={styles.cameraModal}>
          <CameraView
            ref={cameraRef}
            active={selfieCameraVisible}
            facing="front"
            onCameraReady={() => {
              setCameraError('');
              setCameraReady(true);
            }}
            onMountError={({ message }) => {
              setCameraReady(false);
              setCameraError(message || 'Unable to start the front camera.');
            }}
            style={styles.cameraPreview}
          />
          {!cameraReady ? (
            <View style={styles.cameraLoadingOverlay}>
              {cameraError ? (
                <>
                  <Ionicons name="alert-circle-outline" size={30} color={colors.surface} />
                  <Text style={styles.cameraErrorText}>{cameraError}</Text>
                </>
              ) : (
                <ActivityIndicator size="large" color={colors.surface} />
              )}
            </View>
          ) : null}
          <View pointerEvents="none" style={styles.cameraOverlay}>
            <View style={styles.selfieGuide} />
            <Text style={styles.cameraGuideText}>Position your face within the frame</Text>
          </View>
          <View style={styles.cameraControls}>
            <Pressable onPress={handleCloseSelfieCamera} style={styles.cameraCloseButton}>
              <Ionicons name="close" size={26} color={colors.surface} />
            </Pressable>
            <Pressable
              onPress={handleCaptureSelfie}
              disabled={!cameraReady || uploadingSelfie}
              style={[styles.captureButton, (!cameraReady || uploadingSelfie) && styles.captureButtonDisabled]}
            >
              {uploadingSelfie ? <ActivityIndicator color={colors.brandDark} /> : <View style={styles.captureButtonInner} />}
            </Pressable>
            <View style={styles.cameraControlSpacer} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  progressRail: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 34,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressSegmentActive: {
    backgroundColor: colors.brand,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 26,
  },
  iconTile: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: colors.brandDark,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brandDark,
    marginBottom: 6,
  },
  stepHeader: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  panel: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  subHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    marginTop: 6,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 24,
  },
  optionPill: {
    width: '48%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1.5,
  },
  optionPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  optionPillTextSelected: {
    color: colors.brandDark,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    marginBottom: 22,
  },
  subjectTile: {
    width: '48%',
    minHeight: 104,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  subjectTileSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1.5,
  },
  subjectIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subjectTileText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subjectTileTextSelected: {
    color: colors.brandDark,
  },
  subjectMark: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brandDark,
    marginTop: 4,
  },
  uploadBtn: {
    borderRadius: 24,
    marginBottom: 16,
  },
  documentList: {
    gap: 10,
    marginBottom: 20,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  documentIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentTextCol: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  documentStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  documentActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  documentActionButtonDisabled: {
    opacity: 0.6,
  },
  retryButton: {
    borderColor: colors.brand,
  },
  deleteButton: {
    borderColor: colors.danger,
  },
  selfieAvatarButton: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignSelf: 'center',
    marginBottom: 22,
  },
  selfieAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 66,
  },
  selfieAvatarPlaceholder: {
    flex: 1,
    borderRadius: 66,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieInitials: {
    color: colors.brandDark,
    fontSize: 36,
    fontWeight: '800',
  },
  selfieAvatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandDark,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieAvatarBadgeSuccess: {
    backgroundColor: colors.success,
  },
  clearanceDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 18,
  },
  clearanceDocumentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  cameraModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 72,
  },
  selfieGuide: {
    width: 282,
    height: 282,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: 141,
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraErrorText: {
    marginTop: 12,
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  cameraGuideText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 18,
  },
  cameraControls: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraCloseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraControlSpacer: {
    width: 48,
    height: 48,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.65,
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: colors.brandDark,
  },
  emptyDocumentState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
  },
  emptyDocumentTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginTop: 10,
  },
  emptyDocumentText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
  },
  bankSelect: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 16,
  },
  bankSelectText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  bankSelectPlaceholder: {
    color: colors.textSubtle,
  },
  documentTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  documentTypeOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  documentTypeOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  documentTypeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  documentTypeTextSelected: {
    color: colors.brandDark,
  },
  bankPickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(24,24,27,0.38)',
  },
  bankPickerSheet: {
    maxHeight: '70%',
    padding: 20,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bankPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bankPickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  bankPickerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  agreementStatusCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agreementTextCol: {
    flex: 1,
  },
  agreementStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  agreementStatusSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  stepActions: {
    marginTop: 14,
    gap: 10,
  },
  continueBtn: {
    borderRadius: 24,
  },
  backBtn: {
    borderRadius: 18,
  },
  successBanner: {
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    fontSize: 13,
    color: colors.brandDark,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  rejectionBanner: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  rejectionBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  rejectionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  rejectionBannerText: {
    fontSize: 13,
    color: '#9f1239',
    lineHeight: 18,
  },
  rejectionBannerHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
});
