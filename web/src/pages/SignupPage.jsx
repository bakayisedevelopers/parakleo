import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LegalLinksInline } from '../components/legal/LegalLinks';
import { clearPendingSignupPortalRole, getPortalRoutes, resolvePostAuthPath, setPendingSignupPortalRole } from '../constants/portal';
import { usePortal } from '../hooks/usePortal';

function Button({ type = 'button', children, className = '', ...props }) {
  return (
    <button
      type={type}
      className={`w-full rounded-2xl bg-brand px-4 py-3 font-bold text-white transition-colors hover:bg-brand-dark ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchParams] = useSearchParams();
  const referralSlug = String(searchParams.get('ref') || '').trim().toLowerCase();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signup, setUser } = useAuth();
  const navigate = useNavigate();
  const portal = usePortal();
  const routes = getPortalRoutes(portal.role);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setIsSubmitting(true);
      setPendingSignupPortalRole(portal.role);
      const user = await signup({
        name,
        email,
        password,
        role: portal.role,
        referralSlug,
        expectedRole: portal.role,
      });
      const nextPath = resolvePostAuthPath({
        fromPath: null,
        portalRole: portal.role,
        activeRole: user?.activeRole || user?.role,
      });
      setUser(user);
      navigate(nextPath, { replace: true });
    } catch (submissionError) {
      clearPendingSignupPortalRole();
      setError(submissionError.message || 'Unable to create account right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-zinc-100 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-brand/15 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          to={routes.landingPath}
          className="mb-8 flex items-center justify-center gap-2 text-zinc-600 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to {portal.label.toLowerCase()} home</span>
        </Link>
        <h2 className="text-center text-4xl font-black tracking-tight text-zinc-900">
          {portal.canSignUp ? `Create your ${portal.label.toLowerCase()} account` : 'Admin access is restricted'}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600">
          {portal.canSignUp ? (
            <>
              Already have an account?{' '}
              <Link to={routes.loginPath} className="font-bold text-brand hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              Admin accounts are provisioned centrally.{' '}
              <Link to={routes.loginPath} className="font-bold text-brand hover:underline">
                Go to login
              </Link>
            </>
          )}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-8 sm:mx-6 sm:w-full sm:max-w-xl md:mx-auto"
      >
        <div className="rounded-[32px] border border-brand/20 bg-white py-10 px-6 shadow-xl sm:px-12">
          {portal.canSignUp ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <p className="rounded-2xl border border-brand/20 bg-brand/5 p-3 text-sm font-medium text-zinc-700">
                You are creating a <span className="font-bold">{portal.label.toLowerCase()}</span> account. The role is inherited from this portal.
              </p>

              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-bold text-zinc-900">
                  Full name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <User className="h-5 w-5 text-zinc-500" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-2xl border border-zinc-300 bg-zinc-50 py-3 pl-11 pr-4 text-zinc-900 placeholder-zinc-400 transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-bold text-zinc-900">
                  Email address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Mail className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-2xl border border-zinc-300 bg-zinc-50 py-3 pl-11 pr-4 text-zinc-900 placeholder-zinc-400 transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              {referralSlug ? (
                <p className="rounded-2xl border border-brand/20 bg-brand/5 p-3 text-sm text-zinc-700">
                  This signup is linked to a student referral. Complete your student profile to activate the referral reward.
                </p>
              ) : null}

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-bold text-zinc-900">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Lock className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-2xl border border-zinc-300 bg-zinc-50 py-3 pl-11 pr-4 text-zinc-900 placeholder-zinc-400 transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <p className="rounded-2xl border border-brand/20 bg-brand/5 p-3 text-xs text-zinc-700">
                By signing up, you agree to our{' '}
                <LegalLinksInline />
              </p>

              {error ? <p className="text-sm text-rose-500">{error}</p> : null}

              <Button type="submit" className="w-full py-4 text-lg" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Admin accounts are provisioned centrally. Use the admin login page to continue.
              </p>
              <Link
                to={routes.loginPath}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Go to admin login
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
