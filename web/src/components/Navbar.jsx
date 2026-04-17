import { Link } from 'react-router-dom';
import Button from './Button';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center group-hover:shadow-lg group-hover:shadow-brand/40 transition-shadow">
              <span className="text-white font-black text-lg">C</span>
            </div>
            <span className="text-xl font-black text-zinc-900 dark:text-white">Claxi</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium">
              Features
            </a>
            <a href="#how-it-works" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium">
              How it Works
            </a>
            <a href="#features" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium">
              Become a Tutor
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="secondary" size="sm">
                Login
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
