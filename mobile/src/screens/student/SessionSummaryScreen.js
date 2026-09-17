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
import { NotificationsButton } from '../../components/navigation/NotificationsButton';
import { useAuth } from '../../context/AuthContext';
import { subscribeToRequestById } from '../../services/classRequestService';
import {
  submitSessionRating,
  subscribeToSessionById,
} from '../../services/sessionService';
import {
  formatRand,
  computeTravelFee,
  computeBookingFee,
  LEGACY_SAFE_PRICING_SNAPSHOT,
} from '../../utils/pricing';

const COMPLIMENT_TAGS = [
  'Patient & Friendly',
  'Clear Explanations',
  'On Time',
  'Helped Me Understand',
  'Great Problem Solver',
  'Encouraging',
];

const STAR_DESCRIPTIONS = {
  1: 'Poor • Needed improvement',
  2: 'Fair • Could be better',
  3: 'Good • Helpful session',
  4: 'Very Good • Great tutor',
  5: 'Outstanding • Highly recommended!',
};

export function SessionSummaryScreen({ route, navigate, goBack, unreadCount = 0 }) {
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
  const existingRating = session?.ratings?.student || (session?.ratingStatus?.student === 'submitted' ? session?.ratings?.student : null);

  // Tutor metadata
  const tutorName = session?.tutorName || request?.tutorName || 'Your Tutor';
  const tutorInitial = tutorName.charAt(0).toUpperCase();
  const tutorPhoto = session?.tutorPhoto || request?.tutorPhoto || null;
  const tutorRating = Number(session?.tutorRating || request?.tutorRating || 4.9);
  const subject = session?.subject || request?.subject || 'Mathematics';
  const topic = session?.topic || request?.topic || 'In-Person Lesson';

  // Pricing calculations
  const snapshot = session?.pricingSnapshot || {};
  const ratePerMinute = Number(
    snapshot?.adjustedRatePerMinute
    || snapshot?.ratePerMinute
    || session?.ratePerMinute
    || LEGACY_SAFE_PRICING_SNAPSHOT.adjustedRatePerMinute,
  );
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
  const transferFee = Number(
    session?.travelFee
    ?? snapshot?.travelFee
    ?? session?.pricingSnapshot?.travelFee
    ?? request?.travelFee
    ?? snapshot?.transferFee
    ?? (isCanceled && billedMinutes === 0 ? 0 : computeTravelFee(session?.travelDistanceKm || session?.distanceKm || 0)),
  );
  const rawLessonFee = Number((billedMinutes * ratePerMinute).toFixed(2));
  const durationDiscount = Number(session?.discountApplied || snapshot?.discountApplied || 0);
  const freeMinutesApplied = Number(session?.freeMinutesApplied || snapshot?.freeMinutesApplied || 0);
  const freeMinutesDiscount = Number((freeMinutesApplied * ratePerMinute).toFixed(2));
  const bookingFee = Number(
    session?.bookingFeeAmount
    || snapshot?.bookingFeeAmount
    || snapshot?.bookingFee
    || (isCanceled && billedMinutes === 0 ? 0 : computeBookingFee(rawLessonFee)),
  );

  const finalPrice = useMemo(() => {
    if (typeof session?.finalPrice === 'number') return Math.max(0, session.finalPrice);
    if (typeof session?.totalAmount === 'number') return Math.max(0, session.totalAmount);
    if (typeof snapshot?.finalPrice === 'number') return Math.max(0, snapshot.finalPrice);
    if (isCanceled && billedMinutes === 0) return 0;
    return Math.max(0, rawLessonFee + transferFee - durationDiscount - freeMinutesDiscount + bookingFee);
  }, [session, snapshot, isCanceled, billedMinutes, rawLessonFee, transferFee, durationDiscount, freeMinutesDiscount, bookingFee]);

  const paymentLast4 = session?.selectedCardLast4 || session?.cardLast4 || request?.cardLast4 || '';
  const isCash = session?.isCash || request?.paymentMethod === 'cash';
  const paymentStatus = session?.paymentStatus || request?.paymentStatus || 'paid';
  const isWalletDebt = paymentStatus === 'wallet_debt_recorded';

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmitRating = async () => {
    if (!session?.id) return;
    setIsSubmittingRating(true);
    try {
      await submitSessionRating(session, 'student', {
        overall: ratingStars,
        comment: comment.trim(),
        tags: selectedTags,
      });
      setRatingSuccess(true);
      Alert.alert('Review Submitted', 'Thank you! Your rating has been shared with your tutor.');
    } catch (err) {
      Alert.alert('Error', err?.message || 'Unable to submit review right now.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleGoHome = () => {
    navigate?.('Dashboard');
  };

  const handleGoSessions = () => {
    navigate?.('Sessions');
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

          <NotificationsButton navigate={navigate} unreadCount={unreadCount} />
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
                Great job! You attended {billedMinutes} minutes of {subject} with {tutorName}.
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

          {/* 2. Tutor Mini-Profile */}
          <View style={styles.tutorCard}>
            {tutorPhoto ? (
              <Image source={{ uri: tutorPhoto }} style={styles.tutorAvatar} />
            ) : (
              <View style={styles.tutorAvatarFallback}>
                <Text style={styles.tutorAvatarText}>{tutorInitial}</Text>
              </View>
            )}
            <View style={styles.tutorInfo}>
              <Text style={styles.tutorName}>{tutorName}</Text>
              <Text style={styles.tutorSubject}>{subject} • {topic}</Text>
            </View>
            <View style={styles.tutorRatingBadge}>
              <Ionicons name="star" size={13} color="#f59e0b" />
              <Text style={styles.tutorRatingValue}>{tutorRating.toFixed(1)}</Text>
            </View>
          </View>

          {/* 3. Final Price & Detailed Breakdown */}
          <View style={styles.pricingCard}>
            <View style={styles.pricingHeaderRow}>
              <View>
                <Text style={styles.pricingSectionLabel}>FINAL AMOUNT</Text>
                <Text style={styles.pricingMainTotal}>{formatRand(finalPrice)}</Text>
              </View>
              <View style={[
                styles.paymentMethodPill,
                isWalletDebt && styles.paymentMethodPillDebt,
              ]}>
                <Ionicons
                  name={isWalletDebt ? 'alert-circle-outline' : isCash ? 'cash-outline' : 'card-outline'}
                  size={15}
                  color={isWalletDebt ? '#b45309' : '#059669'}
                />
                <Text style={[
                  styles.paymentMethodText,
                  isWalletDebt && styles.paymentMethodTextDebt,
                ]}>
                  {isWalletDebt ? 'Wallet Debt' : isCash ? 'Cash Payment' : paymentLast4 ? `•••• ${paymentLast4}` : 'Card'}
                </Text>
              </View>
            </View>

            {isWalletDebt ? (
              <View style={styles.debtNoticeBanner}>
                <Ionicons name="alert-circle" size={16} color="#b45309" />
                <Text style={styles.debtNoticeText}>
                  Payment was recorded as a wallet debt (card declined or unconfigured). Please settle in your Wallet.
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.breakdownHeaderTitle}>Price Breakdown</Text>

            {/* Row: Duration & Rate */}
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Lesson Fee ({billedMinutes} mins @ {formatRand(ratePerMinute)}/min)
              </Text>
              <Text style={styles.breakdownValue}>{formatRand(rawLessonFee)}</Text>
            </View>

            {/* Row: In-person Transfer Fee */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelWithHint}>
                <Text style={styles.breakdownLabel}>In-Person Tutor Travel Fee</Text>
                <Text style={styles.breakdownSubhint}>Standard travel reimbursement</Text>
              </View>
              <Text style={styles.breakdownValue}>{formatRand(transferFee)}</Text>
            </View>

            {/* Row: Duration Discount */}
            {durationDiscount > 0 ? (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelDiscount}>Duration Discount</Text>
                <Text style={styles.breakdownValueDiscount}>-{formatRand(durationDiscount)}</Text>
              </View>
            ) : null}

            {/* Row: Free Minutes Applied */}
            {freeMinutesApplied > 0 ? (
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLabelWithHint}>
                  <Text style={styles.breakdownLabelDiscount}>
                    Bonus Free Minutes ({freeMinutesApplied}m)
                  </Text>
                  <Text style={styles.breakdownSubhint}>Applied from referral rewards</Text>
                </View>
                <Text style={styles.breakdownValueDiscount}>-{formatRand(freeMinutesDiscount)}</Text>
              </View>
            ) : null}

            {/* Row: Booking Fee */}
            {bookingFee > 0 ? (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Platform Booking Fee</Text>
                <Text style={styles.breakdownValue}>{formatRand(bookingFee)}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            {/* Net Total Row */}
            <View style={styles.breakdownTotalRow}>
              <Text style={styles.breakdownTotalLabel}>Net Total Charged</Text>
              <Text style={styles.breakdownTotalValue}>{formatRand(finalPrice)}</Text>
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
                  Thank you for helping keep Parakleo tutoring top-quality!
                </Text>
              </View>
            ) : (
              <View style={styles.ratingFormWrap}>
                <Text style={styles.ratingSectionTitle}>
                  Rate Your Experience with {tutorName}
                </Text>
                <Text style={styles.ratingSectionSubtitle}>
                  How was your lesson? Tap a star to rate.
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
                  {COMPLIMENT_TAGS.map((tag) => {
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
                <Text style={styles.commentHeader}>Feedback or compliments (optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  numberOfLines={3}
                  placeholder={`Write a note for ${tutorName}...`}
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
              <Text style={styles.primaryHomeButtonText}>Back to Home</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleGoSessions}
              style={styles.secondarySessionsButton}
            >
              <Ionicons name="calendar-outline" size={18} color="#059669" />
              <Text style={styles.secondarySessionsButtonText}>View All Sessions</Text>
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
    marginBottom: 8,
  },
  completedHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 4,
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
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  canceledIconWrap: {
    marginBottom: 8,
  },
  canceledHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#be123c',
    marginBottom: 4,
  },
  canceledHeroSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  tutorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tutorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  tutorAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tutorAvatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  tutorInfo: {
    flex: 1,
  },
  tutorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  tutorSubject: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  tutorRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tutorRatingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    marginLeft: 3,
  },
  pricingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pricingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  pricingSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  pricingMainTotal: {
    fontSize: 30,
    fontWeight: '800',
    color: '#064e3b',
  },
  paymentMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  paymentMethodPillDebt: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
    marginLeft: 6,
  },
  paymentMethodTextDebt: {
    color: '#b45309',
  },
  debtNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  debtNoticeText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  breakdownHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  breakdownLabelWithHint: {
    flex: 1,
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
    marginLeft: 8,
  },
  breakdownLabelDiscount: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  breakdownValueDiscount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 8,
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064e3b',
  },
  ratingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  ratingSubmittedWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  ratingSubmittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
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
    justifyContent: 'center',
    marginBottom: 12,
  },
  starIcon: {
    marginHorizontal: 3,
  },
  submittedCommentBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  submittedCommentText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  submittedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  submittedTagPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  submittedTagText: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '600',
  },
  ratingThanksText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  ratingFormWrap: {},
  ratingSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  ratingSectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 14,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  starPressTarget: {
    padding: 6,
  },
  starDescriptorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
    textAlign: 'center',
    marginBottom: 16,
  },
  complimentsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
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
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitRatingButton: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
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
  bottomActions: {
    gap: 12,
    marginTop: 4,
  },
  primaryHomeButton: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryHomeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondarySessionsButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  secondarySessionsButtonText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
