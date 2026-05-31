import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/States';
import { StudentRequestComposer } from '../../components/student/StudentRequestComposer';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentRequests } from '../../services/classRequestService';
import { subscribeToStudentSessions } from '../../services/sessionService';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function DashboardScreen({ navigate }) {
  const { user } = useAuth();
  const onboardingStatus = getStudentOnboardingStatus(user);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [composerStage, setComposerStage] = useState('input');
  const [shareFeedback, setShareFeedback] = useState('');
  const referralSlug = String(user?.referralSlug || user?.referralCode || '').trim();
  const referralLink = referralSlug ? `https://parakleo.bakayise.com/signup?ref=${encodeURIComponent(referralSlug)}` : '';
  const referralPreview = referralLink.length > 42 ? `${referralLink.slice(0, 42)}...` : referralLink;

  useEffect(() => subscribeToStudentRequests(
    user?.uid,
    (items) => {
      setRequests(items);
      setLoadingRequests(false);
    },
    () => setLoadingRequests(false),
  ), [user?.uid]);

  useEffect(() => subscribeToStudentSessions(
    user?.uid,
    (items) => {
      setSessions(items);
      setLoadingSessions(false);
    },
    () => setLoadingSessions(false),
  ), [user?.uid]);

  if (loadingRequests || loadingSessions) {
    return <LoadingState label="Loading dashboard" />;
  }

  const handleShareReferral = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        title: 'Join Parakleo',
        message: `Use my Parakleo referral link to sign up and start learning.\n${referralLink}`,
        url: referralLink,
      });
      setShareFeedback('Link shared.');
    } catch (_error) {
      setShareFeedback('Unable to share link.');
    }
  };

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.kicker}>Student dashboard</Text>
        <Text style={styles.title}>Hi {user?.displayName || 'there'}</Text>
      </View>
      <StudentRequestComposer navigate={navigate} requests={requests} sessions={sessions} user={user} onStageChange={setComposerStage} />
      {referralLink && composerStage !== 'review' ? (
        <Card style={styles.referralCard}>
          <Text style={styles.referralIntro}>
            Get free 30 minutes when a student joins and completes their profile using your link.
          </Text>
          <View style={styles.referralLinkCard}>
            <Text style={styles.referralLabel}>Referral link</Text>
            <Text style={styles.referralPreview} numberOfLines={2}>{referralPreview}</Text>
            <Text selectable style={styles.referralLink}>{referralLink}</Text>
          </View>
          <View style={styles.referralActions}>
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(referralLink)} style={styles.referralGhostButton}>
              <Text style={styles.referralGhostButtonText}>Open</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleShareReferral} style={styles.referralShareButton}>
              <Text style={styles.referralShareButtonText}>Share</Text>
            </Pressable>
          </View>
          {shareFeedback ? <Text style={styles.referralFeedback}>{shareFeedback}</Text> : null}
        </Card>
      ) : null}
      {!onboardingStatus.complete ? (
        <Card>
          <Text style={styles.copy}>{onboardingStatus.message}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  kicker: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  referralCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
    gap: 10,
  },
  referralIntro: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 22,
  },
  referralLinkCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: '#bbf7d0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  referralLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  referralPreview: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '700',
  },
  referralLink: {
    color: '#52525b',
    fontSize: 11,
  },
  referralActions: {
    flexDirection: 'row',
    gap: 8,
  },
  referralGhostButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  referralGhostButtonText: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '800',
  },
  referralShareButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 14,
    flex: 1,
    paddingVertical: 10,
  },
  referralShareButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  referralFeedback: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
});
