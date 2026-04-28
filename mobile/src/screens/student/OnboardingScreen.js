import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PaymentMethodsManager } from '../../components/student/PaymentMethodsManager';
import { SubjectPicker } from '../../components/student/SubjectPicker';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';
import { syncStudentGrowth } from '../../services/studentGrowthService';
import { normalizeSubjectList } from '../../constants/subjects';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function OnboardingScreen() {
  const { setUser, user } = useAuth();
  const [grade, setGrade] = useState(String(user?.studentProfile?.grade || ''));
  const [curriculum, setCurriculum] = useState(user?.studentProfile?.curriculum || '');
  const [discoverySource, setDiscoverySource] = useState(user?.studentProfile?.discoverySource || '');
  const [subjects, setSubjects] = useState(normalizeSubjectList(user?.subjects || []));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGrade(String(user?.studentProfile?.grade || ''));
    setCurriculum(user?.studentProfile?.curriculum || '');
    setDiscoverySource(user?.studentProfile?.discoverySource || '');
    setSubjects(normalizeSubjectList(user?.subjects || []));
  }, [user?.uid]);

  const status = useMemo(() => getStudentOnboardingStatus({ ...user, subjects }), [subjects, user]);

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    try {
      const profile = await updateUserProfile(user.uid, {
        studentProfile: {
          ...(user?.studentProfile || {}),
          grade: Number(grade) || null,
          curriculum: curriculum.trim(),
          discoverySource: discoverySource.trim(),
        },
        subjects,
      });
      const syncedProfile = await syncStudentGrowth().catch(() => null);
      setUser((prev) => ({ ...prev, ...profile, ...(syncedProfile || {}) }));
      setMessage('Student profile details saved.');
    } catch (error) {
      setMessage(error.message || 'Unable to save student profile.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = Number(grade) >= 1
    && Number(grade) <= 12
    && curriculum.trim()
    && discoverySource.trim()
    && subjects.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <StatusBadge label={status.complete ? 'Complete' : 'In progress'} tone={status.complete ? 'success' : 'warning'} />
      </View>
      <Text style={styles.copy}>Profile and payment completion is required before live requests and tutoring.</Text>
      <Text style={styles.copy}>{status.message}</Text>
      {message ? <Card><Text style={styles.message}>{message}</Text></Card> : null}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Student profile</Text>
        <FormField label="Grade" keyboardType="number-pad" value={grade} onChangeText={setGrade} placeholder="11" />
        <FormField label="Curriculum" value={curriculum} onChangeText={setCurriculum} placeholder="CAPS" />
        <FormField label="How did you hear about us?" value={discoverySource} onChangeText={setDiscoverySource} placeholder="Instagram" />
        <SubjectPicker value={subjects} onChange={setSubjects} />
        <Button disabled={saving || !canSave} onPress={saveProfile}>
          {saving ? 'Saving...' : 'Save student profile'}
        </Button>
      </Card>

      <PaymentMethodsManager user={user} setUser={setUser} onMessage={setMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  message: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
