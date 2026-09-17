import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubjectCatalog } from '../../hooks/useSubjectCatalog';
import {
  buildSubjectClassificationInput,
  classifySubjectFromText,
} from '../../services/subjectClassificationService';
import { colors } from '../../theme/colors';

const QUICK_REQUEST_SUGGESTIONS = [
  { label: 'I need help with homework', value: 'I need help with homework.' },
  { label: 'I need help preparing for an exam', value: 'I need help preparing for an exam.' },
  { label: 'I need help with an assignment', value: 'I need help with an assignment.' },
  { label: 'I need a normal lesson', value: 'I need a normal lesson.' },
];

export function DescribeRequestModal({
  visible,
  onClose,
  onSubmit,
  isPreparing = false,
}) {
  const [topic, setTopic] = useState('');
  const [typedSubjectStatus, setTypedSubjectStatus] = useState('');
  const [typedTopicStatus, setTypedTopicStatus] = useState('');
  const [detectedClassification, setDetectedClassification] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const typingClassificationRunRef = useRef(0);
  const { subjectOptions } = useSubjectCatalog();

  // Debounced real-time subject detection
  useEffect(() => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setIsClassifying(false);
      setTypedSubjectStatus('');
      setTypedTopicStatus('');
      setDetectedClassification(null);
      return undefined;
    }

    const runId = typingClassificationRunRef.current + 1;
    typingClassificationRunRef.current = runId;
    setIsClassifying(true);
    setTypedSubjectStatus('Detecting subject from your text...');

    const timeoutId = setTimeout(async () => {
      try {
        const classificationInput = buildSubjectClassificationInput({
          typedText: trimmed,
          attachmentExtractions: [],
          supportedSubjects: subjectOptions,
        });

        const classification = await classifySubjectFromText({
          inputText: classificationInput.combinedText,
          inputPayload: classificationInput.structuredPayload,
          supportedSubjects: subjectOptions,
        });

        if (typingClassificationRunRef.current !== runId) return;

        setDetectedClassification(classification || null);
        setIsClassifying(false);

        if (classification?.unsupportedSubjectRequested && classification?.unsupportedSubject) {
          setTypedSubjectStatus(`Detected: ${classification.unsupportedSubject} (not offered yet).`);
          setTypedTopicStatus(classification.topic ? `Topic: ${classification.topic}` : '');
          return;
        }

        if (classification?.subject) {
          setTypedSubjectStatus(`Detected: ${classification.subject}`);
          setTypedTopicStatus(classification.topic ? `Topic: ${classification.topic}` : '');
          return;
        }

        setTypedSubjectStatus('Subject not detected yet. Keep typing or pick a suggestion.');
      } catch (_err) {
        if (typingClassificationRunRef.current === runId) {
          setIsClassifying(false);
          setTypedSubjectStatus('');
        }
      }
    }, 700);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [topic, subjectOptions]);

  function handleQuickSuggestion(text) {
    setTopic(text);
  }

  const isBusy = isClassifying || isPreparing;
  const isContinueDisabled = !topic.trim() || isBusy;

  function handleContinue() {
    if (!topic.trim() || isBusy) return;
    onSubmit?.({
      topic: topic.trim(),
      classification: detectedClassification,
    });
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalGrabber} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Describe what you need help with</Text>
              <Text style={styles.modalSubtitle}>Enter homework topic, exam questions, or subject</Text>
            </View>
            <Pressable
              accessibilityLabel="Close describe modal"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeIconButton}
            >
              <Ionicons name="close" size={22} color="#0f172a" />
            </Pressable>
          </View>

          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {/* Text Input Area */}
            <View style={styles.inputContainer}>
              <TextInput
                autoFocus
                multiline
                numberOfLines={4}
                onChangeText={setTopic}
                placeholder="Type your question or what you'd like to learn..."
                placeholderTextColor="#94a3b8"
                style={styles.textarea}
                value={topic}
              />
              {topic ? (
                <Pressable
                  accessibilityLabel="Clear text"
                  accessibilityRole="button"
                  onPress={() => setTopic('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>

            {/* Real-time AI Status */}
            {typedSubjectStatus ? (
              <View style={styles.statusRow}>
                <Ionicons name="sparkles" size={14} color="#059669" />
                <Text style={styles.statusText}>{typedSubjectStatus}</Text>
              </View>
            ) : null}
            {typedTopicStatus ? (
              <View style={styles.statusRow}>
                <Ionicons name="bookmark-outline" size={14} color="#0d9488" />
                <Text style={styles.statusText}>{typedTopicStatus}</Text>
              </View>
            ) : null}

            {/* Quick Suggestions Chips */}
            <Text style={styles.suggestionsHeader}>Suggestions</Text>
            <View style={styles.suggestionChipsWrap}>
              {QUICK_REQUEST_SUGGESTIONS.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.label}
                  onPress={() => handleQuickSuggestion(item.value)}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Continue Button */}
          <Pressable
            accessibilityRole="button"
            disabled={isContinueDisabled}
            onPress={handleContinue}
            style={[
              styles.continueButton,
              !isContinueDisabled ? styles.continueButtonActive : styles.continueButtonDisabled,
              isBusy && topic.trim() ? styles.continueButtonBusy : null,
            ]}
          >
            {isBusy ? (
              <View style={styles.continueContent}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.continueTextBusy}>Processing...</Text>
              </View>
            ) : (
              <View style={styles.continueContent}>
                <Text
                  style={[
                    styles.continueText,
                    topic.trim() ? styles.continueTextActive : null,
                  ]}
                >
                  Continue
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={topic.trim() ? '#ffffff' : '#94a3b8'}
                />
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalGrabber: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    height: 4,
    marginBottom: 14,
    width: 38,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  closeIconButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: 110,
    padding: 12,
    position: 'relative',
  },
  textarea: {
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  clearButton: {
    bottom: 8,
    position: 'absolute',
    right: 8,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  statusText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionsHeader: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  suggestionChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  continueButton: {
    alignItems: 'center',
    borderRadius: 24,
    height: 50,
    justifyContent: 'center',
    marginTop: 8,
  },
  continueButtonActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  continueButtonBusy: {
    backgroundColor: '#047857',
    opacity: 0.9,
  },
  continueContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  continueText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  continueTextActive: {
    color: '#ffffff',
  },
  continueTextBusy: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
