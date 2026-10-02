import { useState, useEffect } from 'react';
import { CrowdDashboard } from './components/CrowdDashboard';
import { PersonIdentification } from './components/PersonIdentification';
import { 
  LayoutDashboard, 
  BarChart3, 
  FileText, 
  Settings, 
  Shield, 
  Bell, 
  BellOff 
} from 'lucide-react';

export default function App() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'analytics' | 'logs' | 'settings'>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' (UTC)');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased">
      
      {/* ============================================================
           1. LEFT SIDEBAR (Dark Navy / Indigo)
           ============================================================ */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen z-40">
        
        {/* Brand Header */}
        <div className="h-[70px] px-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-white leading-tight">CROWD SENTRY</div>
            <div className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">AI OPS</div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-4 flex flex-col gap-1.5 flex-1">
          <button
            onClick={() => setActiveNav('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
              activeNav === 'dashboard'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveNav('analytics')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
              activeNav === 'analytics'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>

          <button
            onClick={() => setActiveNav('logs')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
              activeNav === 'logs'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            Logs
          </button>

          <button
            onClick={() => setActiveNav('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
              activeNav === 'settings'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span>Zone Node #1 Active</span>
        </div>
      </aside>

      {/* ============================================================
           MAIN WRAPPER (Top Header + Dashboard Content)
           ============================================================ */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
        
        {/* 2. TOP HEADER */}
        <header className="h-[70px] px-8 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">CROWD SENTRY AI</div>
              <div className="text-xs text-slate-500 font-medium">Real-Time Crowd Dynamics & Threat Intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Green SYSTEM ACTIVE status */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              SYSTEM ACTIVE
            </div>

            {/* Current Timestamp */}
            <div className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
              {currentTime}
            </div>

            {/* Notification / Siren toggle */}
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
              title={soundEnabled ? "Mute Siren" : "Unmute Siren"}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* User Profile Avatar */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-9 h-9 rounded-lg bg-slate-900 border border-indigo-900/60 text-indigo-300 font-bold text-xs flex items-center justify-center shadow-inner">
                SA
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">SecAdmin</div>
                <div className="text-[10px] text-slate-500 font-medium">Operations</div>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="p-8 flex-1 max-w-[1720px] w-full mx-auto">
          {activeNav === 'dashboard' && <CrowdDashboard />}
          {activeNav === 'analytics' && <PersonIdentification />}
          {activeNav === 'logs' && <CrowdDashboard />}
          {activeNav === 'settings' && <PersonIdentification />}
        </main>
      </div>

    </div>
  );
}
