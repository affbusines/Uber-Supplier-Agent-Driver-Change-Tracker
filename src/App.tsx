import { useState, useEffect } from 'react';
import { ActiveTab } from './types';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import ImportHTML from './components/ImportHTML';
import SandboxSimulator from './components/SandboxSimulator';
import FirebaseSetupPanel from './components/FirebaseSetupPanel';
import SettingsPanel from './components/SettingsPanel';
import { listenToAuth, isSimulated, getNotificationSettings, getLastSyncTime, logOutUser } from './firebase';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Laptop, 
  ShieldCheck, 
  Database, 
  Settings, 
  Sun, 
  Moon, 
  Menu, 
  X,
  AlertTriangle,
  LogOut
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Sync warning state
  const [hoursSince, setHoursSince] = useState<number>(0);
  const [reminderHours, setReminderHours] = useState<number>(72);

  // Initialize and track theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark';
    const init = saved || 'light';
    document.documentElement.setAttribute('data-theme', init);
    if (init === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return init;
  });

  useEffect(() => {
    const unsub = listenToAuth((usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Sync / Setting events listener
  const checkSyncAge = () => {
    const lastSyncStr = getLastSyncTime();
    if (lastSyncStr) {
      const ms = Date.now() - new Date(lastSyncStr).getTime();
      setHoursSince(ms / (1000 * 60 * 60));
    } else {
      setHoursSince(0);
    }

    const uid = user?.uid || 'default';
    const notif = getNotificationSettings(uid);
    setReminderHours(notif.sync_reminder ? (notif.sync_reminder_hours || 72) : 999999);
  };

  useEffect(() => {
    checkSyncAge();
    window.addEventListener('driver_db_updated', checkSyncAge);
    window.addEventListener('notif_settings_updated', checkSyncAge);
    
    const syncTheme = () => {
      const current = (localStorage.getItem('theme') || 'light') as 'light' | 'dark';
      setTheme(current);
    };
    window.addEventListener('theme_changed', syncTheme);

    return () => {
      window.removeEventListener('driver_db_updated', checkSyncAge);
      window.removeEventListener('notif_settings_updated', checkSyncAge);
      window.removeEventListener('theme_changed', syncTheme);
    };
  }, [user]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', next);
    setTheme(next);
    // Notify other listeners
    window.dispatchEvent(new Event('theme_changed'));
  };

  const showToast = (type: 'success' | 'info' | 'error', msg: string) => {
    setToast({ type, message: msg });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const tabsInfo = [
    { id: 'dashboard', label: 'Drivers Dashboard', icon: LayoutDashboard },
    { id: 'import', label: 'Paste Row HTML', icon: ClipboardList },
    { id: 'sandbox', label: 'Simulator Sandbox', icon: Laptop },
    { id: 'connection', label: 'Connection & Auth', icon: Database },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ] as const;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-200 text-zinc-900 dark:text-zinc-100 selection:bg-emerald-500 selection:text-black">
      
      {/* GLOBAL SYSTEM BAR / BRAND HEADER */}
      <header className="bg-black text-white px-4 md:px-6 py-4 flex items-center justify-between border-b border-zinc-900 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-black px-2.5 py-1 rounded-sm font-black tracking-tight text-xs uppercase">
            Supplier
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold tracking-tight text-zinc-100">
              Driver Extractor & Change Tracker
            </h1>
            <span className="block text-[9px] md:text-[10px] text-zinc-500 font-mono">
              Internal Corporate Compliance Console
            </span>
          </div>
        </div>

        {/* Global Connection / Mode Status pill */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden md:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 px-2.5 rounded text-[11px] text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold truncate max-w-[120px]">{user.displayName || user.email}</span>
            </div>
          )}
          <div className={`hidden sm:block p-1 px-2.5 rounded text-[10px] font-mono font-bold leading-none uppercase ${
            isSimulated 
              ? 'bg-amber-950/40 text-amber-500 border border-amber-900/40' 
              : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
          }`}>
            {isSimulated ? 'Sandbox' : 'Firestore Synced'}
          </div>

          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            id="theme-toggler"
            className="p-1.5 md:p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px]"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Logout Button */}
          <button
            onClick={logOutUser}
            className="p-1.5 md:p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 transition cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px]"
            title="Log out"
          >
            <LogOut size={15} />
          </button>

          {/* Trigger Hamburger menu for Mobile */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            id="mobile-nav-hamburger"
            className="lg:hidden p-1.5 md:p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px]"
            aria-label="Open Navigation"
          >
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE NAVIGATION - DESKTOP */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            
            {/* Nav Links */}
            <nav className="flex space-x-6 h-full" aria-label="Tabs">
              {tabsInfo.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    id={`tab-${tab.id}`}
                    className={`h-full border-b-2 px-1 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer select-none ${
                        active
                          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                          : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-350'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Offline Sandbox Info indicator */}
            <div className="hidden md:block">
              {isSimulated && (
                <span className="text-[11px] text-amber-805 font-medium bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-2.5 py-1 inline-flex items-center gap-1">
                  <ShieldCheck size={12} className="shrink-0" />
                  <span>Interactive Simulator Mode Active</span>
                </span>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* SLIDE-OUT DRAWER NAVIGATION - MOBILE & TABLET */}
      {mobileMenuOpen && (
        <div 
          id="mobile-navigation-overlay"
          className="lg:hidden fixed inset-0 z-50 bg-black/60 shadow-2xl flex justify-end animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="bg-white dark:bg-zinc-950 w-72 h-full p-6 flex flex-col justify-between border-l border-zinc-200 dark:border-zinc-850 animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-4">
                <div>
                  <h3 className="font-black text-sm tracking-tight text-zinc-850 dark:text-zinc-100 uppercase">Sync Menu</h3>
                  <span className="text-[10px] text-zinc-400 font-mono">Consoles Controls</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 text-zinc-400 hover:text-zinc-800 transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Mobile Drawer List Nav Links */}
              <nav className="flex flex-col gap-2 pt-2">
                {tabsInfo.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as ActiveTab);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full p-3 text-xs font-bold rounded-lg flex items-center gap-3 transition cursor-pointer select-none text-left ${
                        active
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950'
                          : 'bg-transparent text-zinc-650 dark:text-zinc-450 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg space-y-2 border border-zinc-150 dark:border-zinc-900 text-center">
              <span className="text-[10px] font-bold text-zinc-400 block tracking-wider uppercase font-mono">Console Mode</span>
              <div className={`p-1 rounded text-[10px] font-bold tracking-tight inline-block uppercase bg-emerald-50 text-emerald-850 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-950 leading-normal`}>
                {isSimulated ? 'Sandbox' : 'Firestore Live'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP SYNC WARNING BANNER */}
      {hoursSince >= reminderHours && (
        <div 
          id="sync-warning-banner"
          className="bg-amber-400 dark:bg-amber-600 text-zinc-900 dark:text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-sm transition shrink-0 animate-pulse"
        >
          <div className="flex items-center gap-1.5 md:gap-2 pr-4">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="leading-tight">
              সিস্টেম ডেটা দীর্ঘদিন সিঙ্ক করা হয়নি! (শেষ সিঙ্ক: {Math.floor(hoursSince / 24)} দিন আগে)। রিফ্রেশ ডেটা সিঙ্ক করুন।
            </span>
          </div>
          <button 
            onClick={() => setActiveTab('import')} 
            className="shrink-0 bg-black text-white dark:bg-white dark:text-black py-1 px-3 rounded text-[10px] font-black uppercase hover:opacity-85 transition outline-none cursor-pointer"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* PRIMARY VIEWER CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 shrink-0">
        
        {activeTab === 'dashboard' && <Dashboard />}

        {activeTab === 'import' && (
          <ImportHTML onSuccess={() => setActiveTab('dashboard')} />
        )}

        {activeTab === 'sandbox' && <SandboxSimulator />}

        {activeTab === 'connection' && <FirebaseSetupPanel />}

        {activeTab === 'settings' && (
          <SettingsPanel onShowToast={showToast} />
        )}

      </main>

      {/* MINIMAL FOOTER SYSTEM INFORMATION */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-6 px-6 text-center text-zinc-400 dark:text-zinc-500 text-xs shrink-0 select-none">
        <p className="font-semibold text-zinc-500 dark:text-zinc-400">
          Uber Driver Sync Console — internal version 1.2
        </p>
        <p className="mt-1 font-mono text-[9px] md:text-[10px]">
          Uses DOMParser extraction mapping with automated differential change tracking &bull; Powered by Firebase
        </p>
      </footer>

      {/* Global Toast Alert banner */}
      {toast && (
        <div 
          id="global-toast-alert"
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-up max-w-sm ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-850 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900' 
              : toast.type === 'error'
              ? 'bg-red-50 text-red-850 border-red-20 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900'
              : 'bg-zinc-900 text-white border-zinc-850 dark:bg-white dark:text-black'
          }`}
        >
          <span className="text-base">
            {toast.type === 'success' ? '🎉' : toast.type === 'error' ? '❌' : '⚡'}
          </span>
          <p className="text-xs font-bold leading-normal">{toast.message}</p>
        </div>
      )}

    </div>
  );
}
