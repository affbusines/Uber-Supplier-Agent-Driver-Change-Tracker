import { useState, useEffect } from 'react';
import { isSimulated, logInWithGoogle, logOutUser, listenToAuth, resetDatabase } from '../firebase';
import { ShieldCheck, LogIn, LogOut, Check } from 'lucide-react';

export default function FirebaseSetupPanel() {
  const [user, setUser] = useState<any>(null);
  const [copiedRule, setCopiedRule] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    return listenToAuth((usr) => {
      setUser(usr);
    });
  }, []);

  const handleLogin = async () => {
    try {
      await logInWithGoogle();
    } catch (e) {
      alert('Login Mismatch: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleLogout = () => {
    logOutUser();
  };

  const handleResetData = async () => {
    if (confirm('আপনি কি নিশ্চিত যে আপনি স্থানীয় ডাটাবেস সম্পূর্ণ রিসেট করতে চান? এটি পূর্বের এক্সট্র্যাক্ট করা সব হিস্ট্রি মুছে ফেলবে।')) {
      setResetting(true);
      await resetDatabase();
      setTimeout(() => {
        setResetting(false);
        alert('ডাটাবেস সফলভাবে পরিষ্কার করা হয়েছে!');
      }, 600);
    }
  };

  const firestoreRulesSample = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    
    match /drivers/{driverUUID} {
      allow read, write: if request.auth != null;
    }
  }
}`;

  const copyRules = () => {
    navigator.clipboard.writeText(firestoreRulesSample);
    setCopiedRule(true);
    setTimeout(() => {
      setCopiedRule(false);
    }, 2000);
  };

  return (
    <div id="connection-status-view" className="space-y-6">
      
      {/* 1. Connection Header Profile Box */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-zinc-900 font-bold text-lg mb-2">Internal Supplier Portal Authentication</h3>
        <p className="text-zinc-600 text-xs sm:text-sm mb-6 leading-relaxed">
          নিরাপত্তা নিশ্চিত করার লক্ষ্যে শুধুমাত্র অনুমোদিত এবং ভেরিফাইড টিম মেম্বারদের জন্য ড্রাইভার তালিকা ও পরিবর্তিত ডাটা এক্সেস অনুমোদিত।
        </p>

        <div className="p-5 bg-zinc-50 border border-zinc-150 rounded-lg flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              user ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-500'
            }`}>
              {user ? (
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.displayName}`} 
                  alt={user.displayName}
                  className="w-full h-full rounded-full border border-emerald-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ShieldCheck size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-800 text-sm">
                  {user ? user.displayName : 'Guest User (Not Authenticated)'}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded leading-none ${
                  user ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                }`}>
                  {user ? 'Verified Team' : 'Guest'}
                </span>
              </div>
              <p className="text-zinc-500 text-xs mt-0.5">
                {user ? user.email : 'লগইন না থাকলে হিস্ট্রি বা ড্রাইভার ডাটা মডিফিকেশন সম্ভব নয়।'}
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full sm:w-auto">
            {user ? (
              <button
                onClick={handleLogout}
                id="btn-trigger-logout"
                className="w-full sm:w-auto px-5 py-2 hover:bg-zinc-100 border border-zinc-350 text-zinc-700 font-bold text-xs rounded transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={13} />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                onClick={handleLogin}
                id="btn-trigger-login"
                className="w-full sm:w-auto px-6 py-2.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs rounded transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn size={13} />
                <span>Access Team Console</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Sandbox fallbacks / database reset */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Run Mode Check */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-zinc-800 font-bold text-sm mb-1">Central Sync Server Connection</h4>
            <p className="text-zinc-500 text-[11px] mb-4">রিয়েল-টাইম ডাটা সিঙ্ক ইঞ্জিনের বর্তমান সংকেত ও কন্ডিশন।</p>

            <div className="p-3.5 rounded border mb-4 space-y-2 text-xs bg-emerald-50/60 border-emerald-150">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span>Active Browser Sandbox Engine is Online</span>
              </div>
              <p className="text-emerald-950/80 leading-relaxed text-[11px]">
                বর্তমানে অ্যাপটি <strong>Offline-First Browser Sandbox</strong> মুডে সক্রিয়। আপনার সব এক্সট্র্যাক্ট লগ ব্রাউজারে সুরক্ষিত রয়েছে। গুগল ক্রাউড বা ফায়ারবেস কানেকশন সেটআপ শেষ হলে এটি অটোমেটিক সিঙ্ক হবে।
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-4">
            <span className="text-[11px] text-zinc-500">
              রিসেট ডাটাবেস সম্পূর্ণ মক এবং লোকাল ডাটা ক্লিয়ার করবে।
            </span>
            <button
              onClick={handleResetData}
              disabled={resetting}
              id="btn-reset-db"
              className="px-4 py-2 hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs rounded transition shrink-0 cursor-pointer"
            >
              {resetting ? 'Resetting...' : 'Reset Database'}
            </button>
          </div>
        </div>

        {/* Firestore Rules Guideline */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-zinc-800 font-bold text-sm mb-1">Corporate Security Rules Configuration</h4>
            <p className="text-zinc-500 text-[11px] mb-4 font-mono">firestore.rules layout reference</p>

            <p className="text-zinc-600 text-xs mb-3 leading-relaxed">
              PII সিকিউরিটি এবং Uber ড্রাইভারদের ইমেইল ও ফোন লিকেজ ঠেকাতে নিম্নের সিকিউরিটি গেট রুলস ডিফাইন করা আছে।
            </p>

            <div className="bg-zinc-900 rounded p-3 text-zinc-100 text-[10.5px] font-mono whitespace-pre overflow-x-auto border border-zinc-800">
              {firestoreRulesSample}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-end">
            <button
              onClick={copyRules}
              className="py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedRule ? (
                <>
                  <Check size={11} className="text-emerald-500" />
                  <span className="text-emerald-600 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <span>Copy Rules File</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
