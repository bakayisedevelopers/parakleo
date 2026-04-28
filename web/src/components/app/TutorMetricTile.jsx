export default function TutorMetricTile({ label, value }) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-emerald-50/60 px-5 py-4">
      <p className="min-w-0 text-xs font-bold uppercase tracking-[0.2em] text-brand">
        {label}
      </p>
      <div className="shrink-0 text-right text-xl font-black text-zinc-900">{value}</div>
    </article>
  );
}
