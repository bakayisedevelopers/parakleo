import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <footer className="bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-bold mb-4 text-zinc-900 dark:text-white">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-zinc-900 dark:text-white">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-zinc-900 dark:text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link to="/privacy-policy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-zinc-900 dark:text-white">Connect</h4>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8 flex items-center justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">© 2025 Claxi. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
                <span className="text-white font-black text-sm">C</span>
              </div>
              <span className="font-bold text-zinc-900 dark:text-white">Claxi</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
