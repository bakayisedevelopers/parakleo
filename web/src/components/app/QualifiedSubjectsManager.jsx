import { useEffect, useMemo, useState } from 'react';
import { SUPPORTED_TUTOR_SUBJECTS } from '../../constants/subjects';
import { updateTutorQualifiedSubjectsAndActiveSubjects } from '../../services/tutorDocumentService';

function buildRows(qualifiedSubjects = [], activeSubjects = []) {
  const safeQualified = Array.isArray(qualifiedSubjects) ? qualifiedSubjects : [];
  const safeActive = new Set(Array.isArray(activeSubjects) ? activeSubjects : []);
  return safeQualified.map((item, index) => ({
    id: `${String(item?.subject || 'subject')}-${index}-${Date.now()}`,
    subject: String(item?.subject || '').trim(),
    mark: Number(item?.mark || 0) || 0,
    active: safeActive.has(String(item?.subject || '').trim()),
  }));
}

export default function QualifiedSubjectsManager({ user, setUser, onMessage }) {
  const qualifiedSubjects = useMemo(() => user?.qualifiedSubjects || [], [user?.qualifiedSubjects]);
  const activeSubjectsFromUser = useMemo(
    () => user?.activeSubjects || user?.subjects || [],
    [user?.activeSubjects, user?.subjects],
  );
  const [rows, setRows] = useState(() => buildRows(qualifiedSubjects, activeSubjectsFromUser));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRows(buildRows(qualifiedSubjects, activeSubjectsFromUser));
  }, [qualifiedSubjects, activeSubjectsFromUser]);

  const updateRow = (id, updates) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const removeRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        subject: '',
        mark: 60,
        active: false,
      },
    ]);
  };

  const saveQualifiedSubjects = async () => {
    setIsSaving(true);
    try {
      const qualifiedPayload = rows
        .map((row) => ({
          subject: String(row.subject || '').trim(),
          mark: Number(row.mark || 0),
        }))
        .filter((row) => row.subject && Number.isFinite(row.mark));
      const activePayload = rows
        .filter((row) => row.active && String(row.subject || '').trim())
        .map((row) => String(row.subject || '').trim());

      const update = await updateTutorQualifiedSubjectsAndActiveSubjects(user.uid, qualifiedPayload, activePayload);
      setUser?.((prev) => ({ ...prev, ...update }));
      onMessage?.('Qualified subjects and active tutor subjects saved.');
    } catch (error) {
      onMessage?.(error.message || 'Unable to save tutor subjects.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <datalist id="supported-tutor-subjects">
        {SUPPORTED_TUTOR_SUBJECTS.map((subject) => (
          <option key={subject} value={subject} />
        ))}
      </datalist>
      <div className="space-y-2">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 md:grid-cols-[1fr_120px_120px_auto] md:items-center">
            <input
              type="text"
              value={row.subject}
              list="supported-tutor-subjects"
              onChange={(event) => updateRow(row.id, { subject: event.target.value })}
              placeholder="Subject name"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={row.mark}
              onChange={(event) => updateRow(row.id, { mark: Number(event.target.value || 0) })}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={Boolean(row.active)}
                onChange={(event) => updateRow(row.id, { active: event.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand"
              />
              Active
            </label>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Remove
            </button>
          </div>
        )) : (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            No qualified subjects yet. You can still add subjects manually and save.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700"
      >
        Add subject row
      </button>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <p className="font-semibold text-zinc-700">Supported subjects:</p>
        <p className="mt-1">{SUPPORTED_TUTOR_SUBJECTS.join(', ')}</p>
      </div>
      <button
        type="button"
        onClick={saveQualifiedSubjects}
        disabled={isSaving}
        className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {isSaving ? 'Saving...' : 'Save subjects'}
      </button>
    </div>
  );
}
