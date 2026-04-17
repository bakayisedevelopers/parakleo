export default function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-[24px] border border-white/10 bg-zinc-900/75 p-4 shadow-[0_16px_35px_rgba(2,6,23,0.4)] backdrop-blur md:rounded-[28px] md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-xl font-black tracking-tight text-zinc-100 md:text-2xl">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
