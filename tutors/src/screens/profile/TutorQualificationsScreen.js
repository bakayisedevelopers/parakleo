import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { ALLOWED_SUBJECTS, normalizeSubjectList } from '../../constants/subjects';
import {
  deleteTutorResultsDocument,
  normalizeDocumentStatus,
  retryTutorResultsDocument,
  subscribeToTutorResultsDocuments,
  uploadTutorResultsDocument,
} from '../../services/tutorDocumentService';
import { upsertTutorProfile } from '../../services/userService';
import { colors } from '../../theme/colors';

export function TutorQualificationsScreen({ navigate, goBack }) {
  const { user, setUser } = useAuth();
  const [resultsDocuments, setResultsDocuments] = useState([]);
  const [activeSubjects, setActiveSubjects] = useState(
    user?.tutorProfile?.teachingSubjects || user?.activeSubjects || []
  );
  const [uploading, setUploading] = useState(false);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [retryingDocId, setRetryingDocId] = useState('');
  const [deletingDocId, setDeletingDocId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    return subscribeToTutorResultsDocuments(user?.uid, setResultsDocuments);
  }, [user?.uid]);

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

  const handleToggleSubject = async (subject) => {
    let nextList;
    if (activeSubjects.includes(subject)) {
      nextList = activeSubjects.filter((s) => s !== subject);
    } else {
      nextList = [...activeSubjects, subject];
    }
    setActiveSubjects(nextList);

    try {
      setSavingSubjects(true);
      const normalized = normalizeSubjectList(nextList);
      const updated = await upsertTutorProfile(user.uid, {
        activeSubjects: normalized,
        qualifiedSubjects: normalized,
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          teachingSubjects: normalized,
        },
      });
      setUser((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      console.error('Failed to save active subjects:', err);
    } finally {
      setSavingSubjects(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);
      setErrorMessage('');
      setStatusMessage('');

      await uploadTutorResultsDocument({ uid: user.uid, asset });
      setStatusMessage('Document uploaded successfully. AI processing will extract your subjects.');
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (fileUrl) => {
    if (!fileUrl) {
      Alert.alert('Unavailable', 'Document URL is not available.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open document link on this device.');
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to open document: ' + (err?.message || ''));
    }
  };

  const handleDeleteDocument = (doc) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to remove "${doc.fileName || 'this document'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingDocId(doc.id);
              await deleteTutorResultsDocument({
                documentId: doc.id,
                filePath: doc.filePath,
              });
              setStatusMessage('Document deleted.');
            } catch (err) {
              setErrorMessage(err?.message || 'Failed to delete document.');
            } finally {
              setDeletingDocId('');
            }
          },
        },
      ]
    );
  };

  const handleRetryDocument = async (doc) => {
    try {
      setRetryingDocId(doc.id);
      await retryTutorResultsDocument({ documentId: doc.id });
      setStatusMessage('Document queued for re-processing.');
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to retry document processing.');
    } finally {
      setRetryingDocId('');
    }
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeDocumentStatus(status);
    switch (normalized) {
      case 'VERIFIED':
        return <Badge variant="emerald">Verified</Badge>;
      case 'PROCESSING':
        return <Badge variant="amber">Processing</Badge>;
      case 'FAILED':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="sky">Uploaded</Badge>;
    }
  };

  return (
    <View style={styles.safeArea}>
      <Header
        title="Subjects & Qualifications"
        subtitle="Manage teaching qualifications and academic records"
        onBack={goBack}
        backIconName="chevron-back"
        transparentBackButton
        rightElement={
          <Pressable
            onPress={() => navigate('Notifications')}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="notifications-outline" size={20} color="#18181b" />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {statusMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.brandDark} />
            <Text style={styles.successBannerText}>{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Overview Stats */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeSubjects.length}</Text>
              <Text style={styles.summaryLabel}>Active Subjects</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{resultsDocuments.length}</Text>
              <Text style={styles.summaryLabel}>Uploaded Records</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {resultsDocuments.filter((d) => normalizeDocumentStatus(d.status) === 'VERIFIED').length}
              </Text>
              <Text style={styles.summaryLabel}>Verified Documents</Text>
            </View>
          </View>
        </Card>

        {/* Active Teaching Subjects Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Teaching Subjects</Text>
              <Text style={styles.sectionSubtitle}>
                Tap to toggle subjects you want to receive class requests for
              </Text>
            </View>
            {savingSubjects ? <ActivityIndicator size="small" color={colors.brand} /> : null}
          </View>

          <View style={styles.chipGrid}>
            {ALLOWED_SUBJECTS.map((subject) => {
              const isSelected = activeSubjects.includes(subject);
              return (
                <Pressable
                  key={subject}
                  onPress={() => handleToggleSubject(subject)}
                  style={({ pressed }) => [
                    styles.subjectChip,
                    isSelected && styles.subjectChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                    size={16}
                    color={isSelected ? colors.brandDark : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.subjectChipText,
                      isSelected && styles.subjectChipTextActive,
                    ]}
                  >
                    {subject}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Uploaded Documents List */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Uploaded Academic Records</Text>
              <Text style={styles.sectionSubtitle}>
                Matric certificates, university transcripts, or qualifications
              </Text>
            </View>
          </View>

          <Button
            variant="outline"
            size="md"
            onPress={handlePickDocument}
            loading={uploading}
            style={styles.uploadButton}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={colors.brandDark} style={{ marginRight: 6 }} />
            Upload New Document
          </Button>

          {resultsDocuments.length === 0 ? (
            <View style={styles.emptyDocState}>
              <Ionicons name="document-text-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyDocTitle}>No Documents Uploaded</Text>
              <Text style={styles.emptyDocSubtitle}>
                Upload your matric certificate or academic transcript for automatic AI qualification verification.
              </Text>
            </View>
          ) : (
            <View style={styles.docList}>
              {resultsDocuments.map((doc) => {
                const normalized = normalizeDocumentStatus(doc.status);
                const isRetrying = retryingDocId === doc.id;
                const isDeleting = deletingDocId === doc.id;

                return (
                  <View key={doc.id} style={styles.docItem}>
                    <View style={styles.docTopRow}>
                      <View style={styles.docIconCircle}>
                        <Ionicons name="document-text" size={20} color={colors.brandDark} />
                      </View>
                      <View style={styles.docInfo}>
                        <Text style={styles.docFileName} numberOfLines={1}>
                          {doc.fileName || 'Academic Record'}
                        </Text>
                        <Text style={styles.docMeta}>
                          {doc.contentType || 'Document'}
                        </Text>
                      </View>
                      {getStatusBadge(doc.status)}
                    </View>

                    {/* Extracted Subjects */}
                    {(doc.qualifiedSubjects || []).length > 0 ? (
                      <View style={styles.extractedSubjectsRow}>
                        <Text style={styles.extractedTitle}>Verified Subjects:</Text>
                        <View style={styles.extractedBadges}>
                          {doc.qualifiedSubjects.map((sub, idx) => (
                            <Badge key={idx} variant="emerald" style={styles.miniBadge}>
                              {typeof sub === 'object' ? `${sub.subject} (${sub.mark}%)` : sub}
                            </Badge>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {/* Actions */}
                    <View style={styles.docActionsRow}>
                      {doc.fileUrl ? (
                        <Pressable
                          onPress={() => handleViewDocument(doc.fileUrl)}
                          style={styles.actionLink}
                        >
                          <Ionicons name="eye-outline" size={16} color={colors.brandDark} />
                          <Text style={styles.actionLinkText}>View Document</Text>
                        </Pressable>
                      ) : null}

                      {normalized === 'FAILED' ? (
                        <Pressable
                          onPress={() => handleRetryDocument(doc)}
                          disabled={isRetrying}
                          style={styles.actionLink}
                        >
                          <Ionicons name="refresh-outline" size={16} color={colors.amber} />
                          <Text style={[styles.actionLinkText, { color: colors.amber }]}>
                            {isRetrying ? 'Retrying...' : 'Retry'}
                          </Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        onPress={() => handleDeleteDocument(doc)}
                        disabled={isDeleting}
                        style={styles.actionLink}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        <Text style={[styles.actionLinkText, { color: colors.danger }]}>
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successBannerText: {
    fontSize: 13,
    color: colors.brandDark,
    fontWeight: '700',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
  },
  sectionCard: {
    padding: 18,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  subjectChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: '#a7f3d0',
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  subjectChipTextActive: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  uploadButton: {
    marginBottom: 16,
  },
  emptyDocState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyDocTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  emptyDocSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  docList: {
    gap: 12,
  },
  docItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  docIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docFileName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  docMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  extractedSubjectsRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  extractedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  extractedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniBadge: {
    marginRight: 4,
  },
  docActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandDark,
  },
});
