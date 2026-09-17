import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Globe,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../hooks/useAuth';
import {
  getPortalLabel,
  getPortalRoutes,
  normalizePortalRole,
  persistPortalRole,
  STUDENT_APP_DOWNLOAD_URL,
  TUTOR_APP_DOWNLOAD_URL,
} from '../../constants/portal';

function CTAButton({
  children,
  variant = 'primary',
  href,
  isExternal = false,
  className = '',
  ...props
}) {
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark shadow-lg shadow-brand/30'
      : 'border border-brand/30 bg-brand/10 text-brand hover:bg-brand/20';

  const classes = `inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold transition ${styles} ${className}`;

  if (href) {
    if (isExternal || href.startsWith('http')) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
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
    badge: 'In-Person Tutoring',
    title: 'Request verified in-person tutors near you.',
    subtitle:
      'Connect with qualified tutors for one-on-one, in-person academic support. Download the Parakleo Student mobile app to request a lesson, track arrival in real time, and verify meeting with a secure 4-digit PIN.',
    aboutTitle: 'About Parakleo for students',
    aboutBody:
      'Parakleo is dedicated exclusively to in-person tutoring. When you need help with a school subject, use the Parakleo Student mobile app to request a tutor nearby. Our proximity dispatch matches you with verified tutors, provides 3-second live GPS travel tracking, and unlocks the lesson only after 4-digit PIN confirmation on physical meeting.',
    primaryCta: {
      label: 'Download Student App',
      href: STUDENT_APP_DOWNLOAD_URL,
      icon: Download,
      isExternal: true,
    },
    secondaryCta: {
      label: 'Teach on Parakleo',
      href: '/tutor',
      variant: 'secondary',
    },
    chips: ['Android mobile app', 'Live GPS travel tracking', 'Verified background checks'],
    features: [
      { icon: Zap, title: 'Proximity Matching', description: 'Request help and match with top-rated verified tutors teaching nearby.' },
      { icon: ShieldCheck, title: 'Background Verified', description: 'Every tutor undergoes thorough transcript checks and police clearance verification.' },
      { icon: Globe, title: 'Live Route Tracking', description: 'Watch your tutor approach with 3-second realtime GPS location updates.' },
      { icon: Calendar, title: '4-Digit Arrival PIN', description: 'Meet safely. Confirm physical arrival with a one-time PIN before billing begins.' },
    ],
    steps: [
      { step: '01', title: 'Download Student App', text: 'Install the Parakleo Student mobile app on your Android device.' },
      { step: '02', title: 'Request an in-person tutor', text: 'Select your subject, describe your problem, and confirm your location.' },
      { step: '03', title: 'Verify arrival PIN & learn', text: 'Enter the tutor’s 4-digit PIN upon arrival to start your lesson.' },
    ],
  },
  tutor: {
    badge: 'Teach in Person',
    title: 'Teach on your schedule and earn fairly.',
    subtitle:
      'Accept nearby in-person tutoring requests, navigate directly with built-in GPS, and get paid 73% of lesson fees plus 100% of the travel surcharge. Download the Parakleo Tutors mobile app to apply and go online.',
    aboutTitle: 'About Parakleo for tutors',
    aboutBody:
      'The Parakleo Tutors mobile app is your in-person teaching companion. Set your availability, receive direct proximity dispatch offers with audio chimes, navigate directly to students, verify meetings with a 4-digit arrival PIN, and receive automated, transparent payouts.',
    primaryCta: {
      label: 'Download Tutor App',
      href: TUTOR_APP_DOWNLOAD_URL,
      icon: Download,
      isExternal: true,
    },
    secondaryCta: {
      label: 'Looking for a Tutor?',
      href: '/',
      variant: 'secondary',
    },
    chips: ['Android mobile app', '73% tutor revenue split', '100% travel surcharge payout'],
    features: [
      { icon: BookOpen, title: 'Radial Proximity Offers', description: 'Receive direct 45-second timed lesson offers from nearby students when online.' },
      { icon: Sparkles, title: 'Built-in GPS Navigation', description: 'Turn-by-turn navigation guided directly to the student’s meeting address.' },
      { icon: Wallet, title: 'Fair, Guaranteed Payouts', description: 'Keep 73% of lesson earnings, plus 100% of fuel/transit travel surcharges.' },
      { icon: ShieldCheck, title: '4-Digit Meeting PIN', description: 'Display your unique one-time PIN on arrival to confirm physical meeting.' },
    ],
    steps: [
      { step: '01', title: 'Download Tutor App', text: 'Get the Parakleo Tutors mobile app on your Android device.' },
      { step: '02', title: 'Complete Verification', text: 'Upload your academic transcripts and police clearance PDF for admin review.' },
      { step: '03', title: 'Go Online & Teach', text: 'Toggle your online status, accept nearby requests, and navigate to students.' },
    ],
  },
  admin: {
    badge: 'Platform Operations',
    title: 'Operate the platform from one control room.',
    subtitle:
      'Review tutor verification documents, manage legal agreements, and monitor payout batches without exposing student or tutor tools.',
    aboutTitle: 'About platform administration',
    aboutBody:
      'The Parakleo Admin portal is the operational control center. Dedicated administrators use this web workspace to review uploaded tutor qualifications, inspect police clearance certificates, verify applicants, and oversee platform financials.',
    primaryCta: { label: 'Admin Login', href: '/login', icon: ShieldCheck },
    secondaryCta: null,
    chips: ['Restricted access', 'Tutor verification queue', 'Manual payout tracking'],
    features: [
      { icon: ShieldCheck, title: 'Tutor Verification', description: 'Inspect academic transcripts and police clearance certificates.' },
      { icon: Wallet, title: 'Payment Management', description: 'Audit lesson revenues, travel surcharges, and approve tutor payouts.' },
      { icon: Globe, title: 'Platform Oversight', description: 'Monitor active tutor density, subject requests, and service health.' },
      { icon: Sparkles, title: 'Legal & Agreements', description: 'Manage tutor agreement versions and terms compliance.' },
    ],
    steps: [
      { step: '01', title: 'Authenticate securely', text: 'Sign in with authorized administrative credentials.' },
      { step: '02', title: 'Inspect verification queue', text: 'Review pending tutor documentation and police clearances.' },
      { step: '03', title: 'Manage operations', text: 'Approve qualified tutors and manage manual payout batches.' },
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

  useEffect(() => {
    persistPortalRole(role);
  }, [role]);

  if (!isInitializing && user && rememberMe && role === 'admin' && normalizePortalRole(user?.activeRole || user?.role) === 'admin') {
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
              <CTAButton
                href={portal.primaryCta.href}
                isExternal={portal.primaryCta.isExternal}
              >
                <portal.primaryCta.icon className="mr-2 h-4 w-4" />
                {portal.primaryCta.label}
              </CTAButton>
              {portal.secondaryCta ? (
                <CTAButton
                  href={portal.secondaryCta.href}
                  isExternal={portal.secondaryCta.isExternal}
                  variant={portal.secondaryCta.variant || 'secondary'}
                >
                  {portal.secondaryCta.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </CTAButton>
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
