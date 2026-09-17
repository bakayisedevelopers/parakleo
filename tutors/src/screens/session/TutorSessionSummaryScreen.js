import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { subscribeToRequestById } from '../../services/classRequestService';
import {
  submitSessionRating,
  subscribeToSessionById,
} from '../../services/sessionService';

const STUDENT_COMPLIMENT_TAGS = [
  'Eager to Learn',
  'Polite & Respectful',
  'Well Prepared',
  'Asked Great Questions',
  'Focused & Engaged',
  'Punctual',
];

const STAR_DESCRIPTIONS = {
  1: 'Poor • Unprepared or disruptive',
  2: 'Fair • Could engage more',
  3: 'Good • Cooperative student',
  4: 'Very Good • Focused & engaged',
  5: 'Outstanding • Pleasure to teach!',
};

function formatRand(amount) {
  return `R${Number(amount || 0).toFixed(2)}`;
}

export function TutorSessionSummaryScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const params = route?.params || {};
  const sessionId = String(params.sessionId || '').trim();
  const requestId = String(params.requestId || '').trim();

  const [session, setSession] = useState(params.session || null);
  const [request, setRequest] = useState(params.request || null);
  const [loading, setLoading] = useState(!params.session);

  // Rating State
  const [ratingStars, setRatingStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Subscribe to live session document
  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToSessionById(
      sessionId,
      (item) => {
        if (item) {
          setSession(item);
          setLoading(false);
        }
      },
      () => setLoading(false),
    );
    return () => unsub?.();
  }, [sessionId]);

  // Subscribe to class request document if available
  const effectiveRequestId = requestId || session?.requestId || '';
  useEffect(() => {
    if (!effectiveRequestId) return;
    const unsub = subscribeToRequestById(
      effectiveRequestId,
      (item) => {
        if (item) setRequest(item);
      },
      () => {},
    );
    return () => unsub?.();
  }, [effectiveRequestId]);

  const sessionStatus = String(session?.status || request?.status || 'completed').toLowerCase();
  const isCanceled = ['canceled', 'canceled_during', 'expired'].includes(sessionStatus);
  const isCompleted = !isCanceled;

  // Existing rating check
  const existingRating = session?.ratings?.tutor || (session?.ratingStatus?.tutor === 'submitted' ? session?.ratings?.tutor : null);

  // Student metadata
  const studentName = session?.studentName || request?.studentName || 'Student';
  const studentInitial = studentName.charAt(0).toUpperCase();
  const studentPhoto = session?.studentPhoto || request?.studentPhoto || null;
  const studentRating = Number(session?.studentRating || request?.studentRating || 5.0);
  const studentGrade = session?.studentGrade || request?.studentGrade || request?.grade || '';
  const subject = session?.subject || request?.subject || 'Mathematics';
  const topic = session?.topic || request?.topic || 'In-Person Lesson';

  // Earnings calculations
  const snapshot = session?.pricingSnapshot || {};
  const ratePerMinute = Number(snapshot?.ratePerMinute || session?.ratePerMinute || 3.0);
  const billedMinutes = Math.max(
    0,
    Number(
      session?.billedMinutes
      || session?.durationMinutes
      || snapshot?.durationMinutes
      || request?.durationMinutes
      || (isCanceled ? 0 : 30),
    ),
  );
  const travelFee = Number(
    session?.travelFee
    ?? session?.payoutBreakdown?.travelFee
    ?? snapshot?.travelFee
    ?? request?.travelFee
    ?? snapshot?.transferFee
    ?? (isCanceled && billedMinutes === 0 ? 0 : 40),
  );
  const rawLessonFee = Number((billedMinutes * ratePerMinute).toFixed(2));
  const tutorTuitionShare = Number(
    session?.payoutBreakdown?.tutorTuitionShare
    ?? (typeof session?.payoutBreakdown?.tuitionAmount === 'number'
      ? Number((session.payoutBreakdown.tuitionAmount * 0.73).toFixed(2))
      : Number((rawLessonFee * 0.73).toFixed(2)))
  );

  const tutorEarnings = useMemo(() => {
    if (typeof session?.payoutBreakdown?.tutorAmount === 'number') {
      return Math.max(0, session.payoutBreakdown.tutorAmount);
    }
    if (isCanceled && billedMinutes === 0) return 0;
    return Number((tutorTuitionShare + travelFee).toFixed(2));
  }, [session, isCanceled, billedMinutes, tutorTuitionShare, travelFee]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmitRating = async () => {
    if (!session?.id && !sessionId) return;
    const currentSession = session || { id: sessionId, requestId: effectiveRequestId };
    setIsSubmittingRating(true);
    try {
      await submitSessionRating(currentSession, 'tutor', {
        overall: ratingStars,
        comment: comment.trim(),
        tags: selectedTags,
      });
      setRatingSuccess(true);
      Alert.alert('Review Submitted', 'Thank you! Your feedback on the student has been recorded.');
    } catch (err) {
      Alert.alert('Error', err?.message || 'Unable to submit review right now.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleGoHome = () => {
    navigate?.('Dashboard');
  };

  const handleGoClasses = () => {
    navigate?.('MyClasses');
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading lesson summary...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />

      <SafeAreaView style={styles.safeContainer}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleGoHome}
            style={styles.headerIconButton}
          >
            <Ionicons name="close" size={22} color="#064e3b" />
          </Pressable>

          <Text style={styles.headerTitle}>
            {isCanceled ? 'Lesson Cancelled' : 'Lesson Summary'}
          </Text>

          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Status Hero Banner */}
          {isCompleted ? (
            <View style={styles.completedHeroCard}>
              <View style={styles.completedIconWrap}>
                <Ionicons name="checkmark-circle" size={44} color="#059669" />
              </View>
              <Text style={styles.completedHeroTitle}>Lesson Completed!</Text>
              <Text style={styles.completedHeroSubtitle}>
                Great job! You tutored {billedMinutes} minutes of {subject} with {studentName}.
              </Text>
            </View>
          ) : (
            <View style={styles.canceledHeroCard}>
              <View style={styles.canceledIconWrap}>
                <Ionicons name="alert-circle" size={44} color="#e11d48" />
              </View>
              <Text style={styles.canceledHeroTitle}>Session Cancelled</Text>
              <Text style={styles.canceledHeroSubtitle}>
                {session?.canceledReason || 'This lesson was ended early or cancelled.'}
              </Text>
            </View>
          )}

          {/* 2. Student Mini-Profile */}
          <View style={styles.studentCard}>
            {studentPhoto ? (
              <Image source={{ uri: studentPhoto }} style={styles.studentAvatar} />
            ) : (
              <View style={styles.studentAvatarFallback}>
                <Text style={styles.studentAvatarText}>{studentInitial}</Text>
              </View>
            )}
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{studentName}</Text>
              <Text style={styles.studentSubject}>
                {studentGrade ? `${studentGrade} • ` : ''}{subject} • {topic}
              </Text>
            </View>
            <View style={styles.studentRatingBadge}>
              <Ionicons name="star" size={13} color="#f59e0b" />
              <Text style={styles.studentRatingValue}>{studentRating.toFixed(1)}</Text>
            </View>
          </View>

          {/* 3. Earnings & Breakdown Card */}
          <View style={styles.pricingCard}>
            <View style={styles.pricingHeaderRow}>
              <View>
                <Text style={styles.pricingSectionLabel}>TUTOR EARNINGS</Text>
                <Text style={styles.pricingMainTotal}>{formatRand(tutorEarnings)}</Text>
              </View>
              <View style={styles.payoutBadge}>
                <Ionicons name="wallet-outline" size={15} color="#059669" />
                <Text style={styles.payoutBadgeText}>Direct Payout</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.breakdownHeaderTitle}>Earnings Breakdown</Text>

            {/* Row: Duration & Rate */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelWithHint}>
                <Text style={styles.breakdownLabel}>
                  Lesson Tuition (73% share • {billedMinutes} mins)
                </Text>
                <Text style={styles.breakdownSubhint}>
                  Gross lesson fee: {formatRand(rawLessonFee)}
                </Text>
              </View>
              <Text style={styles.breakdownValue}>{formatRand(tutorTuitionShare)}</Text>
            </View>

            {/* Row: In-person Travel Fee */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelWithHint}>
                <Text style={styles.breakdownLabel}>In-Person Travel Reimbursement</Text>
                <Text style={styles.breakdownSubhint}>100% allocated to tutor</Text>
              </View>
              <Text style={styles.breakdownValue}>{formatRand(travelFee)}</Text>
            </View>

            <View style={styles.divider} />

            {/* Net Total Row */}
            <View style={styles.breakdownTotalRow}>
              <Text style={styles.breakdownTotalLabel}>Total Earnings</Text>
              <Text style={styles.breakdownTotalValue}>{formatRand(tutorEarnings)}</Text>
            </View>
          </View>

          {/* 4. Rating Section DIRECTLY on this page */}
          <View style={styles.ratingCard}>
            {existingRating || ratingSuccess ? (
              <View style={styles.ratingSubmittedWrap}>
                <View style={styles.ratingSubmittedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={styles.ratingSubmittedBadgeText}>Review Submitted</Text>
                </View>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= (existingRating?.overall || ratingStars) ? 'star' : 'star-outline'}
                      size={28}
                      color="#f59e0b"
                      style={styles.starIcon}
                    />
                  ))}
                </View>

                {existingRating?.comment || comment ? (
                  <View style={styles.submittedCommentBox}>
                    <Text style={styles.submittedCommentText}>
                      "{existingRating?.comment || comment}"
                    </Text>
                  </View>
                ) : null}

                {(existingRating?.tags || selectedTags)?.length ? (
                  <View style={styles.submittedTagsRow}>
                    {(existingRating?.tags || selectedTags).map((tag) => (
                      <View key={tag} style={styles.submittedTagPill}>
                        <Text style={styles.submittedTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.ratingThanksText}>
                  Thank you for keeping Parakleo tutoring safe, encouraging, and high-quality!
                </Text>
              </View>
            ) : (
              <View style={styles.ratingFormWrap}>
                <Text style={styles.ratingSectionTitle}>
                  Rate Your Experience with {studentName}
                </Text>
                <Text style={styles.ratingSectionSubtitle}>
                  How was the lesson? Tap a star to rate.
                </Text>

                {/* Star Selector */}
                <View style={styles.starPickerRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      accessibilityRole="button"
                      onPress={() => setRatingStars(star)}
                      style={styles.starPressTarget}
                    >
                      <Ionicons
                        name={star <= ratingStars ? 'star' : 'star-outline'}
                        size={36}
                        color={star <= ratingStars ? '#f59e0b' : '#cbd5e1'}
                      />
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.starDescriptorText}>
                  {STAR_DESCRIPTIONS[ratingStars] || 'Tap to select'}
                </Text>

                {/* Compliment Tags */}
                <Text style={styles.complimentsHeader}>What went well?</Text>
                <View style={styles.tagsContainer}>
                  {STUDENT_COMPLIMENT_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        accessibilityRole="button"
                        onPress={() => toggleTag(tag)}
                        style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                      >
                        {isSelected ? (
                          <Ionicons name="checkmark" size={14} color="#ffffff" style={styles.tagChipIcon} />
                        ) : null}
                        <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Optional Comment Input */}
                <Text style={styles.commentHeader}>Feedback or notes (optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  numberOfLines={3}
                  placeholder={`Write feedback for ${studentName}...`}
                  placeholderTextColor="#94a3b8"
                  value={comment}
                  onChangeText={setComment}
                  maxLength={300}
                />

                {/* Submit Rating Button */}
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmittingRating}
                  onPress={handleSubmitRating}
                  style={[styles.submitRatingButton, isSubmittingRating && styles.buttonDisabled]}
                >
                  {isSubmittingRating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#ffffff" />
                      <Text style={styles.submitRatingButtonText}>Submit Review</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* 5. Navigation Buttons */}
          <View style={styles.bottomActions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleGoHome}
              style={styles.primaryHomeButton}
            >
              <Ionicons name="home-outline" size={18} color="#ffffff" />
              <Text style={styles.primaryHomeButtonText}>Back to Dashboard</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleGoClasses}
              style={styles.secondaryClassesButton}
            >
              <Ionicons name="calendar-outline" size={18} color="#059669" />
              <Text style={styles.secondaryClassesButtonText}>View All Classes</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  safeContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 0,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#064e3b',
    fontWeight: '500',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#064e3b',
  },
  headerRightSpacer: {
    width: 40,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  completedHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  completedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  completedHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#064e3b',
    marginBottom: 6,
  },
  completedHeroSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  canceledHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffe4e6',
  },
  canceledIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  canceledHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#9f1239',
    marginBottom: 6,
  },
  canceledHeroSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
  },
  studentAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  studentAvatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  studentSubject: {
    fontSize: 13,
    color: '#64748b',
  },
  studentRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  studentRatingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    marginLeft: 3,
  },
  pricingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pricingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pricingSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  pricingMainTotal: {
    fontSize: 32,
    fontWeight: '800',
    color: '#064e3b',
    marginTop: 2,
  },
  payoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  payoutBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  breakdownHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabelWithHint: {
    flex: 1,
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
  },
  breakdownSubhint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
  },
  ratingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ratingSubmittedWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  ratingSubmittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  ratingSubmittedBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 6,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  starIcon: {
    marginHorizontal: 3,
  },
  submittedCommentBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  submittedCommentText: {
    fontSize: 14,
    color: '#334155',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  submittedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  submittedTagPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  submittedTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  ratingThanksText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  ratingFormWrap: {},
  ratingSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  ratingSectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  starPressTarget: {
    padding: 6,
  },
  starDescriptorText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
    marginBottom: 16,
  },
  complimentsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  tagChipIcon: {
    marginRight: 4,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tagChipTextSelected: {
    color: '#ffffff',
  },
  commentHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitRatingButton: {
    backgroundColor: '#059669',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitRatingButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomActions: {
    gap: 10,
    marginTop: 6,
  },
  primaryHomeButton: {
    backgroundColor: '#064e3b',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryHomeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondaryClassesButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  secondaryClassesButtonText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});
