export default function EmptyState({ title, description, action, compact = false }) {
  return (
    <div className={`rounded-3xl border border-zinc-800 bg-zinc-900/70 text-center ${compact ? 'p-5' : 'p-8'}`}>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
