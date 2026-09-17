import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { GUARDIAN_RELATIONSHIPS, GENDER_OPTIONS } from '../../constants/safety';
import { getStudentOnboardingStatus, STUDENT_PROFILE_STEPS } from '../../utils/onboarding';
import { colors } from '../../theme/colors';

export function OnboardingScreen() {
  const { setUser, user } = useAuth();
  const [grade, setGrade] = useState(String(user?.studentProfile?.grade || ''));
  const [curriculum, setCurriculum] = useState(user?.studentProfile?.curriculum || '');
  const [discoverySource, setDiscoverySource] = useState(user?.studentProfile?.discoverySource || '');
  const [subjects, setSubjects] = useState(normalizeSubjectList(user?.subjects || []));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Safety & Guardian Form State (REQ-011)
  const existingSafety = user?.studentProfile?.safety || user?.safety || {};
  const [learnerType, setLearnerType] = useState(existingSafety.learnerType || (existingSafety.isMinor ? 'minor' : 'adult'));
  const [guardianName, setGuardianName] = useState(existingSafety.guardian?.name || '');
  const [guardianRelationship, setGuardianRelationship] = useState(existingSafety.guardian?.relationship || 'Parent');
  const [guardianPhone, setGuardianPhone] = useState(existingSafety.guardian?.phoneNumber || '');
  const [guardianEmail, setGuardianEmail] = useState(existingSafety.guardian?.email || '');
  const [guardianConsentAccepted, setGuardianConsentAccepted] = useState(Boolean(existingSafety.guardian?.consentAcceptedAt));
  const [preferSameGenderTutor, setPreferSameGenderTutor] = useState(Boolean(existingSafety.preferences?.preferSameGenderTutor));
  const [preferPublicMeetingPlace, setPreferPublicMeetingPlace] = useState(Boolean(existingSafety.preferences?.preferPublicMeetingPlace));
  const [studentGender, setStudentGender] = useState(user?.gender || existingSafety.gender || '');

  useEffect(() => {
    setGrade(String(user?.studentProfile?.grade || ''));
    setCurriculum(user?.studentProfile?.curriculum || '');
    setDiscoverySource(user?.studentProfile?.discoverySource || '');
    setSubjects(normalizeSubjectList(user?.subjects || []));

    const s = user?.studentProfile?.safety || user?.safety || {};
    setLearnerType(s.learnerType || (s.isMinor ? 'minor' : 'adult'));
    setGuardianName(s.guardian?.name || '');
    setGuardianRelationship(s.guardian?.relationship || 'Parent');
    setGuardianPhone(s.guardian?.phoneNumber || '');
    setGuardianEmail(s.guardian?.email || '');
    setGuardianConsentAccepted(Boolean(s.guardian?.consentAcceptedAt));
    setPreferSameGenderTutor(Boolean(s.preferences?.preferSameGenderTutor));
    setPreferPublicMeetingPlace(Boolean(s.preferences?.preferPublicMeetingPlace));
    setStudentGender(user?.gender || s.gender || '');
  }, [user?.uid]);

  const status = useMemo(() => getStudentOnboardingStatus({ ...user, subjects }), [subjects, user]);
  const currentProgress = user?.onboardingProgress?.student || {};

  useEffect(() => {
    if (!user?.uid) return;

    const desiredStep = status.complete ? null : status.step;
    if (String(currentProgress.currentStep || '') === String(desiredStep || '')
      && Boolean(currentProgress.complete) === Boolean(status.complete)) {
      return;
    }

    updateUserProfile(user.uid, {
      onboardingProgress: {
        ...(user?.onboardingProgress || {}),
        student: {
          ...currentProgress,
          currentStep: desiredStep,
          complete: status.complete,
          updatedAt: new Date().toISOString(),
        },
      },
    })
      .then((profile) => setUser((prev) => ({ ...prev, ...profile })))
      .catch(() => null);
  }, [currentProgress, setUser, status.complete, status.step, user]);

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

  async function saveSafetyProfile() {
    setSaving(true);
    setMessage('');
    try {
      const isMinor = learnerType === 'minor';
      const updates = {
        gender: studentGender.trim().toLowerCase(),
        studentProfile: {
          ...(user?.studentProfile || {}),
          gender: studentGender.trim().toLowerCase(),
          safety: {
            learnerType: isMinor ? 'minor' : 'adult',
            isMinor,
            guardian: isMinor ? {
              name: guardianName.trim(),
              relationship: guardianRelationship.trim(),
              phoneNumber: guardianPhone.trim(),
              email: guardianEmail.trim(),
              consentAcceptedAt: guardianConsentAccepted ? new Date().toISOString() : null,
            } : {
              name: '',
              relationship: '',
              phoneNumber: '',
              email: '',
              consentAcceptedAt: null,
            },
            preferences: {
              preferSameGenderTutor: Boolean(preferSameGenderTutor),
              preferPublicMeetingPlace: Boolean(preferPublicMeetingPlace),
              guardianPresenceRequired: isMinor,
            },
          },
        },
      };
      const profile = await updateUserProfile(user.uid, updates);
      setUser((prev) => ({ ...prev, ...profile }));
      setMessage('Safety and guardian settings saved.');
    } catch (error) {
      setMessage(error.message || 'Unable to save safety profile.');
    } finally {
      setSaving(false);
    }
  }

  const canSaveAcademic = Number(grade) >= 1
    && Number(grade) <= 12
    && curriculum.trim()
    && discoverySource.trim()
    && subjects.length;

  const canSaveSafety = learnerType === 'adult'
    || (learnerType === 'minor' && guardianName.trim() && guardianRelationship.trim() && guardianPhone.trim() && guardianConsentAccepted);

  const isAcademicDone = status.complete || status.step !== STUDENT_PROFILE_STEPS.ACADEMIC;
  const isSafetyDone = status.complete || (status.step !== STUDENT_PROFILE_STEPS.ACADEMIC && status.step !== STUDENT_PROFILE_STEPS.SAFETY);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <StatusBadge label={status.complete ? 'Complete' : 'In progress'} tone={status.complete ? 'success' : 'warning'} />
      </View>
      <Text style={styles.copy}>Profile, safety, and payment setup are required before live requests and tutoring.</Text>
      <Text style={styles.copy}>{status.message}</Text>
      {message ? <Card><Text style={styles.message}>{message}</Text></Card> : null}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Onboarding steps</Text>
        <View style={styles.stepRow}>
          <View style={[styles.stepPill, isAcademicDone ? styles.stepPillComplete : styles.stepPillActive]}>
            <Text style={styles.stepPillText}>1. Profile</Text>
          </View>
          <View style={[styles.stepPill, isSafetyDone ? styles.stepPillComplete : status.step === STUDENT_PROFILE_STEPS.SAFETY ? styles.stepPillActive : styles.stepPillMuted]}>
            <Text style={styles.stepPillText}>2. Safety</Text>
          </View>
          <View style={[styles.stepPill, status.complete ? styles.stepPillComplete : status.step === STUDENT_PROFILE_STEPS.PAYMENT ? styles.stepPillActive : styles.stepPillMuted]}>
            <Text style={styles.stepPillText}>3. Payment</Text>
          </View>
        </View>
      </Card>

      {status.complete ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Profile complete</Text>
          <Text style={styles.copy}>You can now request classes from the dashboard.</Text>
        </Card>
      ) : null}

      {status.complete || status.step === STUDENT_PROFILE_STEPS.PAYMENT ? (
        <PaymentMethodsManager user={user} setUser={setUser} onMessage={setMessage} />
      ) : status.step === STUDENT_PROFILE_STEPS.SAFETY ? (
        <Card style={styles.section}>
          <View style={styles.safetyHeaderRow}>
            <Ionicons name="shield-checkmark" size={22} color="#059669" />
            <Text style={styles.sectionTitle}>Safety & Guardian Mode</Text>
          </View>
          <Text style={styles.copy}>
            Parakleo prioritizes learner safety. Please select learner age category to ensure safe in-person sessions.
          </Text>

          {/* Learner Type Selector */}
          <Text style={styles.fieldLabel}>Learner Category</Text>
          <View style={styles.toggleRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLearnerType('adult')}
              style={[styles.toggleBtn, learnerType === 'adult' && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, learnerType === 'adult' && styles.toggleBtnTextActive]}>
                Adult Learner (18+)
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLearnerType('minor')}
              style={[styles.toggleBtn, learnerType === 'minor' && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleBtnText, learnerType === 'minor' && styles.toggleBtnTextActive]}>
                Minor Learner (&lt;18)
              </Text>
            </Pressable>
          </View>

          {learnerType === 'minor' ? (
            <View style={styles.minorNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#b45309" />
              <Text style={styles.minorNoticeText}>
                For learners under 18, a parent or guardian must be present during in-person sessions.
              </Text>
            </View>
          ) : null}

          {learnerType === 'minor' ? (
            <>
              <FormField
                label="Parent / Guardian Full Name *"
                value={guardianName}
                onChangeText={setGuardianName}
                placeholder="e.g. Sarah Mokoena"
              />
              <FormField
                label="Relationship to Learner *"
                value={guardianRelationship}
                onChangeText={setGuardianRelationship}
                placeholder="e.g. Mother, Father, Legal Guardian"
              />
              <FormField
                label="Guardian Phone Number *"
                keyboardType="phone-pad"
                value={guardianPhone}
                onChangeText={setGuardianPhone}
                placeholder="e.g. 082 123 4567"
              />
              <FormField
                label="Guardian Email (Optional)"
                keyboardType="email-address"
                value={guardianEmail}
                onChangeText={setGuardianEmail}
                placeholder="guardian@example.com"
              />

              {/* Mandatory Consent for Minors */}
              <Pressable
                accessibilityRole="button"
                onPress={() => setGuardianConsentAccepted((prev) => !prev)}
                style={styles.checkboxRow}
              >
                <Ionicons
                  name={guardianConsentAccepted ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={guardianConsentAccepted ? '#059669' : colors.muted}
                />
                <Text style={styles.checkboxText}>
                  I confirm that a parent or legal guardian has provided consent and will be present at the lesson venue.
                </Text>
              </Pressable>
            </>
          ) : null}

          {/* Safety Preferences */}
          <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Safety Preferences</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setPreferPublicMeetingPlace((prev) => !prev)}
            style={styles.checkboxRow}
          >
            <Ionicons
              name={preferPublicMeetingPlace ? 'checkbox' : 'square-outline'}
              size={22}
              color={preferPublicMeetingPlace ? '#059669' : colors.muted}
            />
            <Text style={styles.checkboxText}>
              Prefer public meeting place (e.g. school library, university campus, community center)
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setPreferSameGenderTutor((prev) => !prev)}
            style={styles.checkboxRow}
          >
            <Ionicons
              name={preferSameGenderTutor ? 'checkbox' : 'square-outline'}
              size={22}
              color={preferSameGenderTutor ? '#059669' : colors.muted}
            />
            <Text style={styles.checkboxText}>
              Prefer same-gender tutor (soft preference where available; verified tutors offered as fallback)
            </Text>
          </Pressable>

          {/* Optional Learner Gender to support soft preference matching */}
          <Text style={styles.fieldLabel}>Learner Gender (Optional for matching)</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((opt) => (
              <Pressable
                accessibilityRole="button"
                key={opt.value}
                onPress={() => setStudentGender(opt.value)}
                style={[styles.genderChip, studentGender === opt.value && styles.genderChipActive]}
              >
                <Text style={[styles.genderChipText, studentGender === opt.value && styles.genderChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button disabled={saving || !canSaveSafety} onPress={saveSafetyProfile}>
            {saving ? 'Saving...' : 'Save Safety Profile & Continue'}
          </Button>
        </Card>
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Student profile</Text>
          <FormField label="Grade" keyboardType="number-pad" value={grade} onChangeText={setGrade} placeholder="11" />
          <FormField label="Curriculum" value={curriculum} onChangeText={setCurriculum} placeholder="CAPS" />
          <FormField label="How did you hear about us?" value={discoverySource} onChangeText={setDiscoverySource} placeholder="Instagram" />
          <SubjectPicker value={subjects} onChange={setSubjects} />
          <Button disabled={saving || !canSaveAcademic} onPress={saveProfile}>
            {saving ? 'Saving...' : 'Save student profile'}
          </Button>
        </Card>
      )}
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
  stepRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stepPillActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  stepPillComplete: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  stepPillMuted: {
    backgroundColor: '#f8fafc',
    borderColor: colors.border,
  },
  stepPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  safetyHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  toggleBtnActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  toggleBtnText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#065f46',
    fontWeight: '800',
  },
  minorNoticeBox: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  minorNoticeText: {
    color: '#92400e',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  checkboxText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  genderChip: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  genderChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  genderChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
