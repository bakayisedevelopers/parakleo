import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Globe,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../hooks/useAuth';
import { getPortalLabel, getPortalRoutes, normalizePortalRole } from '../../constants/portal';

function CTAButton({ children, variant = 'primary', ...props }) {
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark shadow-lg shadow-brand/30'
      : 'border border-brand/30 bg-brand/10 text-brand hover:bg-brand/20';

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold transition ${styles}`}
      {...props}
    >
      {children}
    </button>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <article className="rounded-[28px] border border-brand/20 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 inline-flex rounded-2xl border border-brand/20 bg-brand/10 p-3 text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-black text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600">{description}</p>
    </article>
  );
}

const PORTAL_COPY = {
  student: {
    badge: 'Student Portal',
    title: 'Request help in minutes.',
    subtitle:
      'Discover verified tutors, submit a request quickly, and follow your session flow from one polished workspace.',
    aboutTitle: 'About the student portal',
    aboutBody:
      'The student portal is built for fast access to help. It keeps requests, payments, session progress, and follow-up in one place so students can move from problem to live support without friction.',
    primaryCta: { label: 'Request Class Now', href: '/signup', icon: Zap },
    secondaryCta: { label: 'Student Login', href: '/login', variant: 'secondary' },
    chips: ['Verified tutors only', 'Secure card authorization', 'Flexible live sessions'],
    features: [
      { icon: Zap, title: 'Instant Requests', description: 'Submit a topic in seconds and notify online tutors immediately.' },
      { icon: ShieldCheck, title: 'Verified Tutors', description: 'Tutor profile checks and qualification thresholds for safer matching.' },
      { icon: Globe, title: 'Learn Anywhere', description: 'Join sessions from mobile or desktop with live status tracking.' },
      { icon: Calendar, title: 'Flexible Sessions', description: 'Start now or schedule around your day with minimal setup.' },
    ],
    steps: [
      { step: '01', title: 'Complete profile', text: 'Set up your student details once.' },
      { step: '02', title: 'Request help', text: 'Describe the work you need and confirm your subject.' },
      { step: '03', title: 'Join and learn', text: 'Track the session and pay from the same workspace.' },
    ],
  },
  tutor: {
    badge: 'Tutor Portal',
    title: 'Teach on your schedule.',
    subtitle:
      'Accept live requests, manage classes, track payments, and keep your tutoring workflow in one place.',
    aboutTitle: 'About the tutor portal',
    aboutBody:
      'The tutor portal is a focused workspace for accepting requests, managing availability, reviewing agreements, and following live sessions from one control surface.',
    primaryCta: { label: 'Create Tutor Account', href: '/signup', icon: UserCheck },
    secondaryCta: { label: 'Tutor Login', href: '/login', variant: 'secondary' },
    chips: ['Tutor-only access', 'Live request dispatch', 'Payout tracking'],
    features: [
      { icon: BookOpen, title: 'Qualified Requests', description: 'See class requests that match your subject and availability.' },
      { icon: Sparkles, title: 'Agreement Flow', description: 'Review tutor terms and onboarding steps before you go live.' },
      { icon: Wallet, title: 'Payments', description: 'Monitor earnings and payout activity from your dashboard.' },
      { icon: ShieldCheck, title: 'Role enforced access', description: 'This portal only accepts tutor accounts and routes them to tutor tools.' },
    ],
    steps: [
      { step: '01', title: 'Create tutor profile', text: 'Register as a tutor and complete your details.' },
      { step: '02', title: 'Go online', text: 'Switch availability on to receive class requests.' },
      { step: '03', title: 'Accept and teach', text: 'Open the session room and manage the class from one flow.' },
    ],
  },
  admin: {
    badge: 'Admin Portal',
    title: 'Operate the platform from one control room.',
    subtitle:
      'Review tutors, monitor payments, and manage agreements and subject demand without exposing student tools.',
    aboutTitle: 'About the admin portal',
    aboutBody:
      'The admin portal exists for platform operations. It keeps governance, tutoring oversight, payment review, and policy work separate from student and tutor workflows.',
    primaryCta: { label: 'Admin Login', href: '/login', icon: ShieldCheck },
    secondaryCta: null,
    chips: ['Restricted access', 'Platform oversight', 'Operational tools only'],
    features: [
      { icon: ShieldCheck, title: 'Access control', description: 'Keep admin-only tools separate from tutor and student flows.' },
      { icon: Wallet, title: 'Payments', description: 'Monitor payouts and billing status across the platform.' },
      { icon: Globe, title: 'Platform visibility', description: 'Track operational health across tutors and students.' },
      { icon: Sparkles, title: 'Policy management', description: 'Manage agreements and unsupported subjects centrally.' },
    ],
    steps: [
      { step: '01', title: 'Authenticate securely', text: 'Sign in with an approved admin account.' },
      { step: '02', title: 'Review operations', text: 'Inspect tutors, agreements, and payments from the dashboard.' },
      { step: '03', title: 'Act on exceptions', text: 'Resolve issues without exposing student or tutor tools.' },
    ],
  },
};

function getLandingCopy(role) {
  return PORTAL_COPY[normalizePortalRole(role)] || PORTAL_COPY.student;
}

export default function PortalLandingPage({ portalRole }) {
  const { user, isInitializing, rememberMe } = useAuth();
  const role = normalizePortalRole(portalRole);
  const portal = getLandingCopy(role);
  const routes = getPortalRoutes(role);

  if (!isInitializing && user && rememberMe && normalizePortalRole(user?.activeRole || user?.role) === role) {
    return <Navigate to={routes.dashboardPath} replace />;
  }

  return (
    <MainLayout>
      <div className="bg-gradient-to-b from-emerald-50 via-zinc-50 to-white pb-20">
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[36px] border border-brand/20 bg-white p-8 shadow-xl md:p-12"
          >
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />

            <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand">{portal.badge}</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] text-zinc-900 md:text-7xl">
              {portal.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-600">
              {portal.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={portal.primaryCta.href}>
                <CTAButton>
                  <portal.primaryCta.icon className="mr-2 h-4 w-4" />
                  {portal.primaryCta.label}
                </CTAButton>
              </Link>
              {portal.secondaryCta ? (
                <Link to={portal.secondaryCta.href}>
                  <CTAButton variant={portal.secondaryCta.variant || 'secondary'}>
                    {portal.secondaryCta.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </CTAButton>
                </Link>
              ) : null}
            </div>

            <div className="mt-8 grid gap-3 text-sm text-zinc-700 sm:grid-cols-3">
              {portal.chips.map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand/5 px-3 py-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-brand" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-zinc-600">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="font-bold text-brand underline">Terms of Service</Link>,{' '}
              <Link to="/privacy-policy" className="font-bold text-brand underline">Privacy Policy</Link>, and{' '}
              <Link to="/payment-pricing-policy" className="font-bold text-brand underline">Payment Policy</Link>.
            </p>
          </motion.div>
        </section>

        <section id="about" className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-brand/20 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="text-3xl font-black text-zinc-900">{portal.aboutTitle}</h2>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600">
              {portal.aboutBody}
            </p>
          </div>
        </section>

        <section id="features" className="mx-auto mt-10 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {portal.features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </section>

        <section id="how-it-works" className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-brand/20 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              <h2 className="text-3xl font-black text-zinc-900">How {getPortalLabel(role)} works</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {portal.steps.map((item) => (
                <article key={item.step} className="rounded-2xl border border-brand/20 bg-emerald-50/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{item.step}</p>
                  <h3 className="mt-2 text-xl font-black text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
