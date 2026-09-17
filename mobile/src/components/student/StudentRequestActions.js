import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AttachmentPickerModal } from './AttachmentPickerModal';
import { DescribeRequestModal } from './DescribeRequestModal';
import { useSubjectCatalog } from '../../hooks/useSubjectCatalog';
import { fetchPricingQuote } from '../../services/pricingService';
import { extractAttachments } from '../../services/attachmentExtractionService';
import { buildSubjectClassificationInput, classifySubjectFromText } from '../../services/subjectClassificationService';
import { DEFAULT_LESSON_DURATION } from '../../utils/pricing';

function getAttachmentPayload(file) {
  const dataUrl = String(file?.dataUrl || '');
  const separatorIndex = dataUrl.indexOf(',');
  const base64 = separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : '';
  if (!base64) return null;
  const fileName = String(file?.name || 'attachment');
  const nameLower = fileName.toLowerCase();
  let mimeType = String(file?.type || '').toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    if (nameLower.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (nameLower.endsWith('.png')) mimeType = 'image/png';
    else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else mimeType = 'application/octet-stream';
  }
  return {
    base64,
    mimeType,
    fileName,
  };
}

export function StudentRequestActions({ children, navigate, parentTab, activeRequest, activeSession }) {
  const { subjectOptions } = useSubjectCatalog();

  const [pickerMode, setPickerMode] = useState('');
  const [isDescribeOpen, setIsDescribeOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingReview, setIsPreparingReview] = useState(false);
  const [showProcessingComplete, setShowProcessingComplete] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('Processing your file...');
  const [error, setError] = useState('');

  const processingTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    };
  }, []);

  function resumeExistingLesson() {
    if (activeSession) {
      navigate({ key: 'ActiveSession', params: { sessionId: activeSession.id, session: activeSession, parentTab } });
      return true;
    }
    if (activeRequest) {
      navigate({
        key: 'SessionScreen',
        params: {
          requestId: activeRequest.id,
          activeRequestId: activeRequest.id,
          request: activeRequest,
          subject: activeRequest.subject || 'Lesson',
          topic: activeRequest.topic || '',
          parentTab,
        },
      });
      return true;
    }
    return false;
  }

  async function handlePickedFiles(files) {
    if (!mountedRef.current) return;
    setPickerMode('');
    if (!Array.isArray(files) || !files.length) return;

    setIsProcessing(true);
    setShowProcessingComplete(false);
    setProcessingStatusText('Reading document text...');
    setError('');

    try {
      let attachmentExtractions = [];
      try {
        attachmentExtractions = await extractAttachments(files);
      } catch (_ocrErr) {
        console.warn('[StudentRequestActions] OCR extraction skipped:', _ocrErr);
      }

      setProcessingStatusText('Analyzing worksheet with AI...');
      const classificationInput = buildSubjectClassificationInput({
        typedText: '',
        attachmentExtractions,
        supportedSubjects: subjectOptions,
      });

      const classification = await classifySubjectFromText({
        inputText: classificationInput.combinedText,
        attachments: files.map(getAttachmentPayload).filter(Boolean),
        inputPayload: classificationInput.structuredPayload,
        supportedSubjects: subjectOptions,
      });

      if (!mountedRef.current) return;
      const detectedSubject = classification?.subject || 'Mathematics';
      const detectedTopic = classification?.topic || 'Homework problem';
      const estimatedMinutes = Math.max(10, Number(classification?.estimatedMinutes || DEFAULT_LESSON_DURATION));

      setProcessingStatusText('Calculating price estimate...');
      const quote = await fetchPricingQuote({
        durationMinutes: estimatedMinutes,
        subject: detectedSubject,
      }).catch(() => null);

      if (!mountedRef.current) return;
      setShowProcessingComplete(true);
      setProcessingStatusText('Analysis complete! Opening session review...');

      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
        setShowProcessingComplete(false);
        if (navigate) {
          navigate({
            key: 'SessionScreen',
            params: {
              subject: detectedSubject,
              topic: detectedTopic,
              durationMinutes: estimatedMinutes,
              estimatedMinutes,
              attachments: files,
              quote,
              latestClassification: classification,
              isNewRequest: true,
              parentTab,
            },
          });
        }
      }, 900);
    } catch (err) {
      setError(err.message || 'Unable to analyze files right now. Please try again.');
      setIsProcessing(false);
      setShowProcessingComplete(false);
    }
  }

  async function handleTakeCameraPicture() {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        setError('Camera permission is required to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.fileName || `capture_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      const filePayload = {
        name: fileName,
        type: mimeType,
        size: asset.fileSize || 0,
        uri: asset.uri,
        dataUrl: asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri,
      };

      handlePickedFiles([filePayload]);
    } catch (err) {
      setError(err.message || 'Unable to open camera. Please try again.');
    }
  }

  async function handleDescribeSubmit({ topic, classification }) {
    setIsPreparingReview(true);
    setError('');
    try {
      let resolvedClassification = classification;
      if (!resolvedClassification) {
        const classificationInput = buildSubjectClassificationInput({
          typedText: topic,
          attachmentExtractions: [],
          supportedSubjects: subjectOptions,
        });
        resolvedClassification = await classifySubjectFromText({
          inputText: classificationInput.combinedText,
          inputPayload: classificationInput.structuredPayload,
          supportedSubjects: subjectOptions,
        });
      }

      const detectedSubject = resolvedClassification?.subject || 'Mathematics';
      const detectedTopic = resolvedClassification?.topic || topic || 'General assistance';
      const estimatedMinutes = Math.max(10, Number(resolvedClassification?.estimatedMinutes || DEFAULT_LESSON_DURATION));

      const quote = await fetchPricingQuote({
        durationMinutes: estimatedMinutes,
        subject: detectedSubject,
      }).catch(() => null);

      if (!mountedRef.current) return;
      setIsDescribeOpen(false);
      setIsPreparingReview(false);

      if (navigate) {
        navigate({
          key: 'SessionScreen',
          params: {
            subject: detectedSubject,
            topic: detectedTopic,
            durationMinutes: estimatedMinutes,
            estimatedMinutes,
            attachments: [],
            quote,
            latestClassification: resolvedClassification,
            isNewRequest: true,
            parentTab,
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Unable to process your description.');
      setIsPreparingReview(false);
    }
  }

  return (
    <>
      {children({
        onCapture: () => { if (!resumeExistingLesson()) handleTakeCameraPicture(); },
        onUpload: () => { if (!resumeExistingLesson()) setPickerMode('upload'); },
        onDescribe: () => { if (!resumeExistingLesson()) setIsDescribeOpen(true); },
      })}
      {/* Attachment Picker Modal (Camera / Upload File) */}
      <AttachmentPickerModal
        visible={Boolean(pickerMode)}
        mode={pickerMode}
        onCancel={() => setPickerMode('')}
        onError={(errMsg) => {
          setPickerMode('');
          setError(errMsg);
        }}
        onFilesSelected={handlePickedFiles}
      />

      {/* Describe Request Pop-up Modal */}
      <DescribeRequestModal
        visible={isDescribeOpen}
        onClose={() => setIsDescribeOpen(false)}
        onSubmit={handleDescribeSubmit}
        isPreparing={isPreparingReview}
      />

      {/* Processing / OCR Analyzing Overlay */}
      <Modal animationType="fade" transparent visible={isProcessing} onRequestClose={() => {}}>
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <View style={styles.processingIconBadge}>
              {showProcessingComplete ? (
                <Ionicons name="checkmark-circle" size={36} color="#059669" />
              ) : (
                <ActivityIndicator size="large" color="#059669" />
              )}
            </View>
            <Text style={styles.processingTitle}>
              {showProcessingComplete ? 'Ready for review' : 'Processing Request'}
            </Text>
            <Text style={styles.processingCopy}>{processingStatusText}</Text>
          </View>
        </View>
      </Modal>
      <Modal animationType="fade" transparent visible={Boolean(error)} onRequestClose={() => setError('')}>
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <Text style={styles.processingTitle}>Unable to start request</Text>
            <Text style={styles.processingCopy}>{error}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss request error" onPress={() => setError('')} style={styles.dismissButton}>
              <Ionicons name="close" size={24} color="#047857" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  processingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  processingCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    elevation: 12,
    maxWidth: 320,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: '100%',
  },
  processingIconBadge: {
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    marginBottom: 16,
    width: 64,
  },
  processingTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  processingCopy: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
  },
});
