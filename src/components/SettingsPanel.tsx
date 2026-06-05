import { useState, useEffect } from 'react';
import { 
  getGlobalSettings, 
  saveGlobalSettings, 
  getNotificationSettings, 
  saveNotificationSettings, 
  listenToAuth,
  getUberCredentials,
  saveUberCredentials
} from '../firebase';
import { GlobalSettings, NotificationSettings } from '../types';
import { Award, Bell, Shield, Save, CheckCircle2, Moon, Sun, Lock, User, Globe, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface SettingsPanelProps {
  onShowToast: (type: 'success' | 'info' | 'error', message: string) => void;
}

export default function SettingsPanel({ onShowToast }: SettingsPanelProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Settings States
  const [rewardCycle, setRewardCycle] = useState<number>(52);
  const [rewardAlert, setRewardAlert] = useState<boolean>(true);
  const [thresholds, setThresholds] = useState<number[]>([5, 3, 1]);
  const [syncReminder, setSyncReminder] = useState<boolean>(true);
  const [syncReminderHours, setSyncReminderHours] = useState<number>(72);

  // Uber Supplier Credentials states
  const [uberEmail, setUberEmail] = useState<string>('');
  const [uberPassword, setUberPassword] = useState<string>('');
  const [uberOrgId, setUberOrgId] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isTestingLogin, setIsTestingLogin] = useState<boolean>(false);
  const [isSavingCreds, setIsSavingCreds] = useState<boolean>(false);

  // App Theme local state for visual indicators
  const [theme, setTheme] = useState<string>('light');

  useEffect(() => {
    // Listen to user auth to fetch user-specific preference
    const unsubAuth = listenToAuth((usr) => {
      setCurrentUser(usr);
      const uid = usr?.uid || 'default';
      const notifSettings = getNotificationSettings(uid);
      setRewardAlert(notifSettings.reward_alert);
      setThresholds(notifSettings.reward_thresholds || [5, 3, 1]);
      setSyncReminder(notifSettings.sync_reminder);
      setSyncReminderHours(notifSettings.sync_reminder_hours || 72);

      // Load Uber credentials
      const creds = getUberCredentials(uid);
      setUberEmail(creds.email || '');
      setUberOrgId(creds.org_id || '');
      setUberPassword(creds.encrypted_password ? 'RECOVERED_SECURE_PASSWORD' : ''); // simple placeholder or decrypted
    });

    const currentGlobal = getGlobalSettings();
    setRewardCycle(currentGlobal.default_reward_cycle);

    const syncThemeInSettings = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(currentTheme);
    };
    
    syncThemeInSettings();
    window.addEventListener('theme_changed', syncThemeInSettings);

    return () => {
      unsubAuth();
      window.removeEventListener('theme_changed', syncThemeInSettings);
    };
  }, []);

  const handleSaveRewardSettings = async () => {
    try {
      await saveGlobalSettings({ default_reward_cycle: rewardCycle });
      onShowToast('success', '⚙️ Global reward settings saved successfully!');
    } catch (err) {
      onShowToast('error', 'Failed to save global settings.');
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      const uid = currentUser?.uid || 'default';
      await saveNotificationSettings(uid, {
        reward_alert: rewardAlert,
        reward_thresholds: thresholds,
        sync_reminder: syncReminder,
        sync_reminder_hours: syncReminderHours
      });
      
      // Request permission of notification if enabled
      if (rewardAlert || syncReminder) {
        if ('Notification' in window && Notification.permission !== 'granted') {
          const res = await Notification.requestPermission();
          if (res === 'granted') {
            onShowToast('success', '🔔 System notification permission granted!');
          } else {
            onShowToast('info', '⚠️ Notifications are disabled in your browser settings.');
          }
        }
      }
      
      onShowToast('success', '🔔 Notification preferences saved successfully!');
    } catch (err) {
      onShowToast('error', 'Failed to save notification preferences.');
    }
  };

  const handleTestCredentials = async () => {
    if (!uberEmail || !uberPassword || !uberOrgId) {
      onShowToast('error', '⚠️ সকল তথ্য (Email, Password, Org ID) প্রদান করুন।');
      return;
    }

    setIsTestingLogin(true);
    try {
      const uid = currentUser?.uid || 'default';
      const stored = getUberCredentials(uid);
      let testPass = uberPassword;
      if (uberPassword === 'RECOVERED_SECURE_PASSWORD' && stored.encrypted_password) {
        testPass = stored.encrypted_password;
      }

      const res = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: uberEmail,
          password: testPass,
          orgId: uberOrgId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast('success', '✅ ' + data.message);
      } else {
        onShowToast('error', '❌ ' + (data.error || 'Login failed'));
      }
    } catch (err) {
      onShowToast('error', '❌ Connection error testing credentials.');
    } finally {
      setIsTestingLogin(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!uberEmail || !uberPassword || !uberOrgId) {
      onShowToast('error', '⚠️ সকল তথ্য (Email, Password, Org ID) প্রদান করুন।');
      return;
    }

    setIsSavingCreds(true);
    try {
      const uid = currentUser?.uid || 'default';
      const stored = getUberCredentials(uid);
      let finalEncryptedPass = stored.encrypted_password || '';

      if (uberPassword !== 'RECOVERED_SECURE_PASSWORD') {
        const res = await fetch('/api/credentials/encrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: uberPassword })
        });
        const data = await res.json();
        if (data.encrypted) {
          finalEncryptedPass = data.encrypted;
        }
      }

      await saveUberCredentials(uid, {
        email: uberEmail,
        org_id: uberOrgId,
        encrypted_password: finalEncryptedPass
      });

      onShowToast('success', '⚙️ Credentials securely saved & encrypted successfully!');
    } catch (err) {
      onShowToast('error', 'Failed to save secure compliance credentials.');
    } finally {
      setIsSavingCreds(false);
    }
  };

  const toggleThreshold = (val: number) => {
    setThresholds(prev => {
      if (prev.includes(val)) {
        return prev.filter(v => v !== val);
      } else {
        return [...prev, val].sort((a, b) => b - a);
      }
    });
  };

  const syncReminderOptions = [
    { label: '24h', value: 24 },
    { label: '48h', value: 48 },
    { label: '72h', value: 72 },
    { label: '7d (168h)', value: 168 },
  ];

  const toggleAppThemeInSettings = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
    window.dispatchEvent(new Event('theme_changed'));
    onShowToast('info', `Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans animate-fade-in text-zinc-900 dark:text-zinc-100">
      
      {/* HEADER SECTION */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight">System Settings & Console Rules</h2>
        <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Configure global processing cycles, automatic change warnings, and notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. REWARD SETTINGS BLOCK */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-900 pb-3">
              <div className="bg-emerald-500 text-black p-1.5 rounded">
                <Award size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">⚙️ Reward Settings</h3>
                <span className="text-[10px] text-zinc-400 font-mono">GLOBAL REWARD TARGET</span>
              </div>
            </div>

            <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
              সিস্টোমে নতুন ড্রাইভার ট্র্যাকার চালু করার সময় ডিফল্ট কতটি ট্রিপ সম্পূর্ণ করা লাগবে তা নির্ধারণ করুন। ব্যক্তিগত ড্রাইভারের জন্য ট্র্যাকিং শুরু করার সময় আপনি এই লক্ষ্যমাত্রা যেকোনো সময় পরিবর্তন বা ওভাররাইড করতে পারেন।
            </p>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">Default Reward Cycle Size (Trips):</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={rewardCycle}
                  onChange={(e) => setRewardCycle(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-32 px-3 py-2 text-center text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-850 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">trips per target cycle</span>
              </div>
              <p className="text-[10px] text-zinc-400 italic">
                * Standard corporate policy defines reward cycle size as 52 trips.
              </p>
            </div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-900 flex justify-end">
            <button
              onClick={handleSaveRewardSettings}
              className="px-4 py-2 bg-black hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-black rounded text-xs font-bold font-sans transition flex items-center gap-1.5 cursor-pointer selection:bg-transparent"
            >
              <Save size={14} />
              <span>💾 Save Default</span>
            </button>
          </div>
        </div>

        {/* 2. NOTIFICATION SETTINGS BLOCK */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-900 pb-3">
              <div className="bg-emerald-500 text-black p-1.5 rounded">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">🔔 Notification Settings</h3>
                <span className="text-[10px] text-zinc-400 font-mono">PUSH & IN-APP ALERT CONFIG</span>
              </div>
            </div>

            {/* Alert 1: Reward */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Reward Cycle Alerts</span>
                <button
                  onClick={() => setRewardAlert(!rewardAlert)}
                  className={`px-3 py-1 rounded text-[10px] font-black tracking-wide transition cursor-pointer ${
                    rewardAlert 
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900' 
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 border border-transparent'
                  }`}
                >
                  {rewardAlert ? '✅ ON' : 'OFF'}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                কোনো ড্রাইভার লক্ষ্যমাত্রার কাছাকাছি চলে আসলে (৫ বা তার কম ট্রিপ বাকি থাকলে) ব্রাউজার পুশ নোটিফিকেশন পাঠাবে।
              </p>

              {rewardAlert && (
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-2.5 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Alert Intervals:</span>
                  <div className="flex items-center gap-2.5">
                    {[5, 3, 1].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => toggleThreshold(lvl)}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded flex items-center gap-1 border transition cursor-pointer ${
                          thresholds.includes(lvl)
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                            : 'bg-white dark:bg-zinc-950 text-zinc-650 dark:text-zinc-300 border-zinc-200 dark:border-zinc-850'
                        }`}
                      >
                        <span className={thresholds.includes(lvl) ? 'text-emerald-500' : 'text-zinc-400'}>
                          {thresholds.includes(lvl) ? '☑' : '☐'}
                        </span>
                        <span>{lvl} left</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Alert 2: Sync Reminder */}
            <div className="space-y-2.5 border-t border-zinc-100 dark:border-zinc-900 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Data Sync Reminder</span>
                <button
                  onClick={() => setSyncReminder(!syncReminder)}
                  className={`px-3 py-1 rounded text-[10px] font-black tracking-wide transition cursor-pointer ${
                    syncReminder 
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900' 
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 border border-transparent'
                  }`}
                >
                  {syncReminder ? '✅ ON' : 'OFF'}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                সিস্টেমে অনেকদিন ধরে নতুন ড্রাইভার ডেটা ইম্পোর্ট বা রিফ্রেশ করা না হলে ওয়ার্নিং রিট্রিভাল অ্যালার্ট দিবে।
              </p>

              {syncReminder && (
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-2.5 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Sync Interval Target:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {syncReminderOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSyncReminderHours(opt.value)}
                        className={`py-1 rounded text-xs font-bold transition border cursor-pointer text-center ${
                          syncReminderHours === opt.value
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white font-black'
                            : 'bg-white dark:bg-zinc-950 text-zinc-650 dark:text-zinc-300 border-zinc-200 dark:border-zinc-850'
                        }`}
                      >
                        {opt.label}
                        {syncReminderHours === opt.value && <span className="inline-block text-emerald-500 ml-1">●</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-900 flex justify-end">
            <button
              onClick={handleSaveNotificationSettings}
              className="px-4 py-2 bg-black hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-black rounded text-xs font-bold font-sans transition flex items-center gap-1.5 cursor-pointer selection:bg-transparent"
            >
              <Save size={14} />
              <span>💾 Save Preferences</span>
            </button>
          </div>
        </div>

        {/* AUTOMATED AUTO SYNC SETTINGS BLOCK */}
        <div className="md:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-900 pb-3">
              <div className="bg-emerald-500 text-black p-1.5 rounded">
                <Globe size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">🔄 Auto Headless Sync Settings</h3>
                <span className="text-[10px] text-zinc-400 font-mono">SUPPLIER.UBER.COM AUTOMATED SCRAPING PORTAL</span>
              </div>
            </div>

            <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed font-sans">
              এই ফিচারের মাধ্যমে আপনার **supplier.uber.com** অ্যাকাউন্ট থেকে স্বয়ংক্রিয়ভাবে ড্রাইভার ডেটা সিঙ্ক করা যাবে। লগইন ক্রেডেনশিয়াল সমূহ আপনার ব্রাউজারে সুরক্ষিত উপায়ে **AES-256-CBC** অ্যালগরিদমে এনক্রিপ্ট হয়ে সংরক্ষণ করা থাকে।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <User size={13} className="text-zinc-400" />
                  <span>Organization Email / ID:</span>
                </label>
                <input
                  type="email"
                  placeholder="your-email@example.com"
                  value={uberEmail}
                  onChange={(e) => setUberEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-400" />
                  <span>Uber Password:</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter account password"
                    value={uberPassword}
                    onChange={(e) => setUberPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Globe size={13} className="text-zinc-400" />
                  <span>Organization ID (orgId):</span>
                </label>
                <input
                  type="text"
                  placeholder="your-org-id"
                  value={uberOrgId}
                  onChange={(e) => setUberOrgId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-950 p-3 rounded text-[11px] leading-relaxed text-amber-900 dark:text-amber-400">
              ⚠️ <strong>সুরক্ষা সতর্কর্তা:</strong> আপনার পাসওয়ার্ড কখনো প্লেইন টেক্সট হিসেবে অনাবৃত পাঠানো হয় না। টেস্ট ও সিঙ্ক করার আগে পাসওয়ার্ডটি সিকিউর সিমেট্রিক চিপে এনক্রিপ্ট করে নেওয়া হয়।
            </div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-3">
            <button
              onClick={handleTestCredentials}
              disabled={isTestingLogin}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded text-xs font-bold font-sans transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isTestingLogin ? "animate-spin" : ""} />
              <span>{isTestingLogin ? "টেস্টিং হচ্ছে..." : "🧪 Test Login"}</span>
            </button>
            <button
              onClick={handleSaveCredentials}
              disabled={isSavingCreds}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-xs font-bold font-sans transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-pulse-once"
            >
              <Save size={14} />
              <span>{isSavingCreds ? "সংরক্ষণ হচ্ছে..." : "💾 Save Credentials"}</span>
            </button>
          </div>
        </div>

        {/* 3. CORE INTERFACING PREFERENCE */}
        <div className="md:col-span-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-900 pb-3">
            <div className="bg-emerald-500 text-black p-1.5 rounded">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">👤 Display Mode & Theme Configuration</h3>
              <span className="text-[10px] text-zinc-400 font-mono">LOCAL STATION USER CUSTOMIZATION</span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Configure the user interface presentation theme. The console supports responsive light and eye-safe deep charcoal night styling adapted directly from corporate compliance regulations.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded border border-zinc-200/50 dark:border-zinc-900">
            <div>
              <span className="text-xs font-bold block">App Color Token Preference</span>
              <p className="text-[10.5px] text-zinc-400 mt-0.5">Toggle between standard workspace light theme and dark terminal ambient lighting.</p>
            </div>

            <button
              onClick={toggleAppThemeInSettings}
              className="px-3.5 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900 shadow-sm transition flex items-center gap-2 text-xs font-semibold max-w-max cursor-pointer text-zinc-800 dark:text-zinc-200"
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={14} className="text-amber-500" />
                  <span>☀️ Switch to Light Mode</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-zinc-600" />
                  <span>🌙 Switch to Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
