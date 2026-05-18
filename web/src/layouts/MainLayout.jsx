import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-zinc-200 bg-zinc-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="mb-4 font-bold text-zinc-900">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-600">
                <li><a href="#features" className="transition-colors hover:text-zinc-900">Features</a></li>
                <li><Link to="/payment-pricing-policy" className="transition-colors hover:text-zinc-900">Pricing</Link></li>
                <li><a href="#" className="transition-colors hover:text-zinc-900">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-zinc-900">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-600">
                <li><a href="#" className="transition-colors hover:text-zinc-900">About</a></li>
                <li><a href="#" className="transition-colors hover:text-zinc-900">Blog</a></li>
                <li><a href="#" className="transition-colors hover:text-zinc-900">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-zinc-900">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-600">
                <li><Link to="/privacy-policy" className="transition-colors hover:text-zinc-900">Privacy Policy</Link></li>
                <li><Link to="/terms" className="transition-colors hover:text-zinc-900">Terms of Service</Link></li>
                <li><Link to="/payment-pricing-policy" className="transition-colors hover:text-zinc-900">Payment and Pricing</Link></li>
                <li><Link to="/refund-policy" className="transition-colors hover:text-zinc-900">Refund Policy</Link></li>
                <li><Link to="/data-voice-policy" className="transition-colors hover:text-zinc-900">Data and Voice Handling</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-zinc-900">Connect</h4>
              <ul className="space-y-2 text-sm text-zinc-600">
                <li><a href="#" className="transition-colors hover:text-zinc-900">Twitter</a></li>
                <li><a href="#" className="transition-colors hover:text-zinc-900">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-8">
            <p className="text-sm text-zinc-600">&copy; 2026 Parakleo. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Parakleo logo"
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-zinc-200"
              />
              <span className="font-bold text-zinc-900">Parakleo</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
