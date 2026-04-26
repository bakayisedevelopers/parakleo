import { useEffect, useMemo, useState } from 'react';
import { updateTutorActiveSubjects } from '../../services/tutorDocumentService';

export default function QualifiedSubjectsManager({ user, setUser, onMessage }) {
  const qualifiedSubjects = useMemo(() => user?.qualifiedSubjects || [], [user?.qualifiedSubjects]);
  const qualifiedNames = useMemo(
    () => qualifiedSubjects.map((item) => item.subject).filter(Boolean),
    [qualifiedSubjects],
  );
  const [activeSubjects, setActiveSubjects] = useState(user?.activeSubjects || user?.subjects || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setActiveSubjects((user?.activeSubjects || user?.subjects || []).filter((subject) => qualifiedNames.includes(subject)));
  }, [qualifiedNames, user?.activeSubjects, user?.subjects]);

  const toggleSubject = (subject) => {
    setActiveSubjects((current) => (
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    ));
  };

  const saveActiveSubjects = async () => {
    setIsSaving(true);
    try {
      const update = await updateTutorActiveSubjects(user.uid, activeSubjects, qualifiedSubjects);
      setUser?.((prev) => ({ ...prev, ...update }));
      onMessage?.('Active tutor subjects saved.');
    } catch (error) {
      onMessage?.(error.message || 'Unable to save active subjects.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!qualifiedSubjects.length) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        No qualified subjects yet. Upload your results and Claxi will list subjects where your mark is at least 60%.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {qualifiedSubjects.map((item) => (
          <label key={item.subject} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-zinc-900">{item.subject}</span>
              <span className="text-xs text-zinc-500">
                {Number(item.mark || 0).toFixed(0)}% qualified
              </span>
            </span>
            <input
              type="checkbox"
              checked={activeSubjects.includes(item.subject)}
              onChange={() => toggleSubject(item.subject)}
              className="h-5 w-5 rounded border-zinc-300 text-brand focus:ring-brand"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={saveActiveSubjects}
        disabled={isSaving}
        className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {isSaving ? 'Saving...' : 'Save active subjects'}
      </button>
    </div>
  );
}
