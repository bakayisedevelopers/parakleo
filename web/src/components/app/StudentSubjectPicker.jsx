import { SOUTH_AFRICAN_SUBJECTS, normalizeSubjectList } from '../../constants/subjects';

export default function StudentSubjectPicker({ value = [], onChange }) {
  const selected = normalizeSubjectList(value);

  const toggleSubject = (subject) => {
    const normalized = String(subject || '').trim();
    if (!normalized) return;
    if (selected.includes(normalized)) {
      onChange(selected.filter((item) => item !== normalized));
      return;
    }
    onChange([...selected, normalized]);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SOUTH_AFRICAN_SUBJECTS.map((subject) => {
          const active = selected.includes(subject);
          return (
            <button
              key={subject}
              type="button"
              onClick={() => toggleSubject(subject)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                active
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {subject}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        Pick the subjects you want Parakleo to use for your learning profile.
      </p>
    </div>
  );
}
