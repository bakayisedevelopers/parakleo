import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import FormField from '../../../components/ui/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { getStudentOnboardingStatus } from '../../../utils/onboarding';

const initialForm = {
  topic: '',
  description: '',
};

export default function RequestClassPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const onboardingStatus = getStudentOnboardingStatus(user);

  const handleSubmit = async (event) => {
    event.preventDefault();
    navigate('/app/student/request', {
      state: {
        topic: form.topic,
        description: form.description,
        cardId: user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || '',
      },
    });
  };

  if (!onboardingStatus.complete) {
    return (
      <div className="space-y-6">
        <PageHeader title="Class Scheduler" description="Complete onboarding before requesting a math session." />
        <SectionCard>
          <p className="text-sm text-amber-700">{onboardingStatus.message}</p>
          <Link to="/app/onboarding?role=student" className="mt-4 inline-flex rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">
            Complete profile
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Class Scheduler" description="Set up your request details before confirming." />

      <SectionCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Topic / Title" name="topic" value={form.topic} onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))} required />
          <FormField
            label="Description"
            as="textarea"
            rows={4}
            name="description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
          />
          <button type="submit" className="inline-flex rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark">
            Continue to request
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
