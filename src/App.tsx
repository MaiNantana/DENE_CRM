import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, LayoutDashboard } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import LineMockup from './components/LineMockup';
import { mockTiers } from './mockData';

function DeneLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 -10 480 140" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 20H90C120 20 140 40 140 70C140 100 120 120 90 120H40V20ZM65 40V100H85C105 100 115 85 115 70C115 55 105 40 85 40H65Z" fill="currentColor"/>
      <path d="M160 20H235V40H185V60H230V80H185V100H235V120H160V20Z" fill="currentColor"/>
      <path d="M255 120V20H285L335 85V20H360V120H330L280 55V120H255Z" fill="currentColor"/>
      <path d="M380 20H455V40H405V60H450V80H405V100H455V120H380V20Z" fill="currentColor"/>
      <path d="M430 5C430 5 440 15 450 15C460 15 460 5 460 5C460 5 450 -5 440 -5C430 -5 430 5 430 5Z" fill="currentColor"/>
      <path d="M420 5C420 5 435 15 455 18C455 18 450 0 420 5Z" fill="currentColor"/>
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<'admin' | 'line'>('admin');
  const [tiers, setTiers] = useState(mockTiers);

  return (
    <div className="min-h-screen bg-japandi-50 text-japandi-900 font-sans flex flex-col relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-japandi-200/50 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-japandi-sage/20 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Top Navigation / Switcher */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-japandi-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-japandi-800 flex items-center h-8">
               <DeneLogo className="h-6 w-auto" />
            </div>
            <span className="text-xs font-semibold text-japandi-500 uppercase tracking-widest pl-2 border-l border-japandi-300">CRM Platform</span>
          </div>
          
          <div className="flex bg-japandi-100 p-1 rounded-xl border border-japandi-200 shadow-inner">
            <button
              onClick={() => setView('admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                view === 'admin' 
                  ? 'bg-white shadow-sm text-japandi-800' 
                  : 'text-japandi-500 hover:text-japandi-700'
              }`}
            >
              <LayoutDashboard size={18} />
              Admin Backend
            </button>
            <button
              onClick={() => setView('line')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                view === 'line' 
                  ? 'bg-white shadow-sm text-[#06c755]' 
                  : 'text-japandi-500 hover:text-japandi-700'
              }`}
            >
              <Smartphone size={18} />
              LINE App Member
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'admin' ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full absolute inset-0 overflow-hidden"
            >
              <AdminDashboard tiers={tiers} setTiers={setTiers} />
            </motion.div>
          ) : (
            <motion.div
              key="line"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full absolute inset-0 overflow-auto flex py-8"
            >
              <LineMockup tiers={tiers} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
