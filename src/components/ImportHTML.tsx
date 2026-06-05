import { useState, useEffect, useRef } from 'react';
import { 
  parseDriversFromHTML, 
  validateDriverData, 
  SAMPLE_HTML_BASELINE, 
  SAMPLE_HTML_UPDATED, 
  parseDriverFromText, 
  parseMultipleDriversFromText,
  validateTextParsedDriver 
} from '../parser';
import { syncDrivers, getUberCredentials, listenToAuth } from '../firebase';
import { 
  Clipboard, 
  ShieldAlert, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  Smartphone, 
  Mail, 
  Hash,
  Globe,
  Lock,
  RefreshCw,
  Clock,
  Settings,
  Flame,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import Avatar from './Avatar';

interface ImportHTMLProps {
  onSuccess: () => void;
}

export default function ImportHTML({ onSuccess }: ImportHTMLProps) {
  const [activeImportTab, setActiveImportTab] = useState<'html' | 'text' | 'auto'>('auto');
  const [htmlInput, setHtmlInput] = useState('');
  const [parsingResult, setParsingResult] = useState<any[] | null>(null);
  
  const [textInput, setTextInput] = useState('');
  const [textParsingResult, setTextParsingResult] = useState<any[] | null>(null);

  const [validationIssues, setValidationIssues] = useState<{ driverName: string; uuid: string; errors: string[] }[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [maxPages, setMaxPages] = useState<number>(0);
  const [startPage, setStartPage] = useState<number>(1);

  // Tracks which sync (by started_at) we have already processed on the client.
  // Using localStorage so the flag persists when the user navigates away and
  // returns — a useRef resets on unmount which would re-trigger the redirect.
  const handledSyncRef = useRef<string | null>(
    localStorage.getItem('__handledSyncId') || null
  );

  // Auto Sync States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasCreds, setHasCreds] = useState(false);
  const [syncState, setSyncState] = useState<{
    running: boolean;
    step: 'idle' | 'login' | 'navigate' | 'scraping' | 'saving' | 'done' | 'error';
    message: string;
    progress: number;
    found: number;
    started_at: string | null;
  }>({
    running: false,
    step: 'idle',
    message: 'No active sync operation is running.',
    progress: 0,
    found: 0,
    started_at: null
  });

  useEffect(() => {
    const unsub = listenToAuth((usr) => {
      setCurrentUser(usr);
      const uid = usr?.uid || 'default';
      const creds = getUberCredentials(uid);
      setHasCreds(!!(creds.email && creds.org_id && creds.encrypted_password));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let intervalId: any = null;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (!res.ok) return;
        const data = await res.json();
        
        setSyncState({
          running: data.running,
          step: data.step,
          message: data.message,
          progress: data.progress,
          found: data.found,
          started_at: data.started_at
        });

        if (data.running) {
          if (!intervalId) {
            intervalId = setInterval(checkStatus, 1500);
          }
        } else {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          // Complete client-side synchronization when transition is done.
          // Guard: only process once per unique sync run (keyed by started_at).
          // Without this guard, every poll cycle would call handleCompleteAutoSync
          // and redirect the user to dashboard whenever the page is open.
          if (
            data.step === 'done' &&
            data.drivers &&
            data.drivers.length > 0 &&
            data.started_at &&
            handledSyncRef.current !== data.started_at
          ) {
            handledSyncRef.current = data.started_at;
            // Persist so the guard survives tab navigation (component remount)
            localStorage.setItem('__handledSyncId', data.started_at);
            handleCompleteAutoSync(data.drivers);
          }
        }
      } catch (err) {
        console.error('Error fetching backend sync status:', err);
      }
    };

    checkStatus();
    const pollId = setInterval(checkStatus, 2500);

    return () => {
      clearInterval(pollId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser]);

  const handleCompleteAutoSync = async (drivers: any[]) => {
    try {
      setIsSyncing(true);
      const report = await syncDrivers(drivers);
      setStatusMessage({
        type: 'success',
        text: `স্বয়ংক্রিয় সিঙ্ক সফলভাবে সম্পন্ন! নতুন ড্রাইভার যোগ: ${report.added}, এবং আপডেট: ${report.updated} জন!`
      });
      setIsSyncing(false);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'স্বয়ংক্রিয় ডেটা সিঙ্ক করার সময় ত্রুটি ঘটেছে: ' + (err instanceof Error ? err.message : String(err))
      });
      setIsSyncing(false);
    }
  };

  const handleStartAutoSync = async () => {
    setStatusMessage(null);
    const uid = currentUser?.uid || 'default';
    const creds = getUberCredentials(uid);

    if (!creds.email || !creds.org_id || !creds.encrypted_password) {
      setStatusMessage({ 
        type: 'error', 
        text: 'লগইন ক্রেডেনশিয়াল সংরক্ষিত নেই। প্রথমে Settings এ গিয়ে ক্রেডেনশিয়াল সেট করুন।' 
      });
      return;
    }

    try {
      const res = await fetch('/api/sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creds.email,
          password: creds.encrypted_password,
          orgId: creds.org_id,
          encrypted: true,
          maxPages: maxPages > 0 ? maxPages : 0,
          startPage: startPage > 1 ? startPage : 1
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ 
          type: 'error', 
          text: data.error || 'সিঙ্ক শুরু করতে ত্রুটি ঘটেছে।' 
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'স্বয়ংক্রিয় সিঙ্ক রিকোয়েস্ট পাঠানো হয়েছে। ব্যাকগ্রাউন্ডে প্রসেস শুরু হচ্ছে...'
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'সার্ভারের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি।' });
    }
  };

  const handleCancelAutoSync = async () => {
    try {
      await fetch('/api/sync/cancel', { method: 'POST' });
      setStatusMessage({ type: 'info', text: 'সিঙ্ক অপারেশন বাতিল করার অনুরোধ পাঠানো হয়েছে।' });
    } catch (err) {
      console.error('Error cancelling sync:', err);
    }
  };

  // 1. HTML PARSE & SYNC HANDLERS
  const handleParse = () => {
    if (!htmlInput.trim()) {
      setStatusMessage({ type: 'error', text: 'অনুগ্রহ করে প্রথমে HTML paste করুন।' });
      setParsingResult(null);
      setValidationIssues([]);
      return;
    }

    try {
      const parsed = parseDriversFromHTML(htmlInput);
      if (parsed.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'কোথাও কোনো Driver Row পাওয়া যায়নি। অনুগ্রহ করে সঠিক selector সহ Table-এর HTML paste করুন।'
        });
        setParsingResult(null);
        setValidationIssues([]);
      } else {
        setParsingResult(parsed);
        
        // Validate each driver
        const issues: { driverName: string; uuid: string; errors: string[] }[] = [];
        parsed.forEach(drv => {
          const check = validateDriverData(drv);
          if (!check.valid) {
            issues.push({
              driverName: drv.name,
              uuid: drv.uuid,
              errors: check.errors
            });
          }
        });
        setValidationIssues(issues);

        if (issues.length > 0) {
          setStatusMessage({
            type: 'success',
            text: `সফলভাবে ${parsed.length} টি Driver Profile সনাক্ত করা হয়েছে। সতর্কতা: ${issues.length} জন ড্রাইভারের তথ্য অসম্পূর্ণ বা ত্রুটিপূর্ণ হতে পারে!`
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: `সফলভাবে ${parsed.length} টি Driver Profile সনাক্ত করা হয়েছে। নিচের প্রিভিউ দেখে Sync to Database ক্লিক করুন।`
          });
        }
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'HTML পার্সিং করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার ট্রাই করুন।' });
      setParsingResult(null);
      setValidationIssues([]);
    }
  };

  const loadSample = (type: 'baseline' | 'updated') => {
    const html = type === 'baseline' ? SAMPLE_HTML_BASELINE : SAMPLE_HTML_UPDATED;
    setHtmlInput(html);
    const parsed = parseDriversFromHTML(html);
    setParsingResult(parsed);
    
    // Validate each driver in sample
    const issues: { driverName: string; uuid: string; errors: string[] }[] = [];
    parsed.forEach(drv => {
      const check = validateDriverData(drv);
      if (!check.valid) {
        issues.push({
          driverName: drv.name,
          uuid: drv.uuid,
          errors: check.errors
        });
      }
    });
    setValidationIssues(issues);

    setStatusMessage({
      type: 'info',
      text: `নমুনা (${type === 'baseline' ? 'Baseline' : 'Updated Contacts'}) HTML লোড করা হয়েছে! নিচে এর প্রিভিউ ফিল্ড দেখতে পারেন।`
    });
  };

  const handleSync = async () => {
    if (!parsingResult || parsingResult.length === 0) return;

    setIsSyncing(true);
    setStatusMessage({ type: 'info', text: 'ডেটাবেস সিঙ্ক করা হচ্ছে...' });

    try {
      const report = await syncDrivers(parsingResult);
      if (report.rewardCompletedNames && report.rewardMilestoneToasts) {
        (window as any).__pendingRewardToasts = {
          completed: report.rewardCompletedNames,
          milestones: report.rewardMilestoneToasts
        };
      }
      setStatusMessage({
        type: 'success',
        text: `সিঙ্ক সম্পন্ন! নতুন যোগ হয়েছে: ${report.added} জন, আপডেট হয়েছে: ${report.updated} জন, কন্টাক্ট পরিবর্তন ধরা পড়েছে: ${report.changedContacts} জনের!`
      });
      setParsingResult(null);
      setValidationIssues([]);
      setHtmlInput('');
      setIsSyncing(false);
      
      // Delay to allow showing success message then switch
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'সিঙ্ক করার সময় ত্রুটি হয়েছে: ' + (err instanceof Error ? err.message : String(err))
      });
      setIsSyncing(false);
    }
  };

  // 2. TEXT PARSE & SYNC HANDLERS
  const handleParseText = () => {
    if (!textInput.trim()) {
      setStatusMessage({ type: 'error', text: 'অনুগ্রহ করে প্রথমে Plain Text paste করুন।' });
      setTextParsingResult(null);
      setValidationIssues([]);
      return;
    }

    try {
      const parsedDrivers = parseMultipleDriversFromText(textInput);
      
      if (parsedDrivers.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'কোথাও কোনো Driver Profile সনাক্ত করা যায়নি। অনুগ্রহ করে সঠিক ফরম্যাটে Driver Data paste করুন।'
        });
        setTextParsingResult(null);
        setValidationIssues([]);
        return;
      }

      // Validate each driver
      const issues: { driverName: string; uuid: string; errors: string[] }[] = [];
      parsedDrivers.forEach(drv => {
        const check = validateTextParsedDriver(drv);
        if (!check.valid) {
          issues.push({
            driverName: drv.name || 'Unknown',
            uuid: drv.uuid,
            errors: check.errors
          });
        }
      });
      
      setValidationIssues(issues);
      setTextParsingResult(parsedDrivers);

      if (issues.length > 0) {
        setStatusMessage({
          type: 'success',
          text: `সফলভাবে ${parsedDrivers.length} টি Driver Profile সনাক্ত করা হয়েছে। সতর্কতা: ${issues.length} জন ড্রাইভারের তথ্য অসম্পূর্ণ হতে পারে!`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `সফলভাবে ${parsedDrivers.length} টি Driver Profile সনাক্ত করা হয়েছে! নিচে এর প্রিভিউ ফিল্ড দেখতে পারেন।`
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'টেক্সট পার্সিং করতে ত্রুটি হয়েছে।' });
      setTextParsingResult(null);
      setValidationIssues([]);
    }
  };

  const handleSyncText = async () => {
    if (!textParsingResult || textParsingResult.length === 0) return;

    setIsSyncing(true);
    setStatusMessage({ type: 'info', text: 'ডেটাবেস সিঙ্ক করা হচ্ছে...' });

    try {
      const report = await syncDrivers(textParsingResult);
      if (report.rewardCompletedNames && report.rewardMilestoneToasts) {
        (window as any).__pendingRewardToasts = {
          completed: report.rewardCompletedNames,
          milestones: report.rewardMilestoneToasts
        };
      }
      setStatusMessage({
        type: 'success',
        text: `ড্রাইভার প্রোফাইল সফলভাবে সিঙ্ক সম্পন্ন! নতুন যোগ হয়েছে: ${report.added}, আপডেট হয়েছে: ${report.updated}`
      });
      setTextParsingResult(null);
      setValidationIssues([]);
      setTextInput('');
      setIsSyncing(false);
      
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'সিঙ্ক করার সময় ত্রুটি হয়েছে: ' + (err instanceof Error ? err.message : String(err))
      });
      setIsSyncing(false);
    }
  };

  return (
    <div id="import-view-container" className="space-y-6">
      
      {/* Visual Import Tab Switcher */}
      <div id="import-tab-switcher" className="flex flex-wrap border-b border-zinc-200 dark:border-zinc-800 gap-2 pb-px font-sans">
        <button
          onClick={() => {
            setActiveImportTab('auto');
            setParsingResult(null);
            setTextParsingResult(null);
            setValidationIssues([]);
            setStatusMessage(null);
          }}
          className={`py-2.5 px-5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeImportTab === 'auto'
              ? 'border-emerald-500 text-zinc-950 dark:text-white font-black'
              : 'border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200'
          }`}
        >
          <RefreshCw size={14} className={syncState.running ? 'animate-spin text-emerald-500' : ''} />
          <span>⚡ Automated Sync (Uber API)</span>
        </button>
        <button
          onClick={() => {
            setActiveImportTab('html');
            setParsingResult(null);
            setTextParsingResult(null);
            setValidationIssues([]);
            setStatusMessage(null);
          }}
          className={`py-2.5 px-5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeImportTab === 'html'
              ? 'border-emerald-500 text-zinc-950 dark:text-white font-black'
              : 'border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200'
          }`}
        >
          <Clipboard size={14} />
          <span>row html paste (supplier.uber.com)</span>
        </button>
        <button
          onClick={() => {
            setActiveImportTab('text');
            setParsingResult(null);
            setTextParsingResult(null);
            setValidationIssues([]);
            setStatusMessage(null);
          }}
          className={`py-2.5 px-5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeImportTab === 'text'
              ? 'border-emerald-500 text-zinc-950 dark:text-white font-black'
              : 'border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200'
          }`}
        >
          <FileText size={14} />
          <span>plain text paste (direct profile)</span>
        </button>
      </div>

      {activeImportTab === 'auto' ? (
        // --- AUTOMATED HEADLESS SYNC PANEL ---
        <div id="automated-sync-panel" className="space-y-6">
          <div className="bg-black text-white rounded-lg p-6 border border-zinc-850 relative overflow-hidden">
            <div className="absolute right-0 top-0 text-emerald-500 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12">
              <RefreshCw size={240} className={syncState.running ? "animate-spin" : ""} />
            </div>

            <h2 className="text-2xl font-bold font-sans tracking-tight mb-2 flex items-center gap-2">
              <span>🔄 Uber Portal Automated Sync</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded uppercase font-mono tracking-wider">HEADLESS BOT ENGINE</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm">
              আপনার সংরক্ষিত Uber Supplier অ্যাকাউন্ট ব্যবহার করে সরাসরি সার্ভার-সাইড ব্যাকগ্রাউন্ড ব্রাউজার দ্বারা ড্রাইভার তালিকা রিট্রিভ করুন।
            </p>

            {/* Creds checklist validation banner */}
            {!hasCreds ? (
              <div className="mt-6 bg-red-950/40 border border-red-900/60 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-red-400 flex items-center gap-1.5 leading-none">
                    <AlertOctagon size={16} />
                    <span>লগইন ক্রেডেনশিয়াল সংরক্ষিত নেই! (Uber Credentials Missing)</span>
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    সংগঠনের ডেটা স্বয়ংক্রিয় রিট্রিভ করার জন্য আপনার অ্যাকাউন্টের বিবরণী প্রয়োজন। অনুগ্রহ করে Settings প্যানেলে যান।
                  </p>
                </div>
                <div className="text-zinc-400 text-xs py-1.5 px-3 bg-red-900/20 hover:bg-red-900/40 text-red-200 border border-red-900 rounded cursor-help font-semibold text-center w-full sm:w-auto shrink-0 select-none">
                  ⚙️ Settings ট্যাব থেকে সেট করুন
                </div>
              </div>
            ) : (
              <div className="mt-6 bg-emerald-950/20 border border-emerald-900/60 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <div>
                    <span className="text-zinc-400">সিঙ্ক স্ট্যাটাস:</span>
                    <strong className="text-emerald-400 ml-1">সক্রিয় ও ডেটা রিট্রিভ করার জন্য প্রস্তুত</strong>
                  </div>
                </div>
                <div className="text-zinc-400 font-mono text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                  AES-256 ENCRYPTED KEY SYNCED WITH SECURE STORAGE
                </div>
              </div>
            )}

            {/* Instruction manual cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-xs text-zinc-300">
              <div className="bg-zinc-900/50 p-4 rounded border border-zinc-850">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">1</span>
                  <span className="font-bold text-zinc-200 uppercase tracking-widest font-mono text-[10px]">Credential Authorization</span>
                </div>
                <p className="leading-relaxed text-zinc-400 text-[11px]">
                  সিস্টেম ব্যাকএন্ডে সংরক্ষিত ক্রেডেনশিয়াল দিয়ে <code className="text-emerald-400 font-mono bg-black px-1 py-0.2 rounded text-[10px]">supplier.uber.com</code> অ্যাকাউন্টে সংযোগ স্থাপন করে।
                </p>
              </div>

              <div className="bg-zinc-900/50 p-4 rounded border border-zinc-850">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">2</span>
                  <span className="font-bold text-zinc-200 uppercase tracking-widest font-mono text-[10px]">Headless Scraping</span>
                </div>
                <p className="leading-relaxed text-zinc-400 text-[11px]">
                  সার্ভারে একটি ভার্চুয়াল ব্রাউজার (Headless Browser) রান করিয়ে ড্রাইভার তালিকার মূল টেবিলটি পেজ-বাই-পেজ নির্ভুলভাবে পার্স করে ডাটা সংগ্রহ করে।
                </p>
              </div>

              <div className="bg-zinc-900/50 p-4 rounded border border-zinc-850">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">3</span>
                  <span className="font-bold text-zinc-200 uppercase tracking-widest font-mono text-[10px]">Automatic Checksum & Sync</span>
                </div>
                <p className="leading-relaxed text-zinc-400 text-[11px]">
                  রিট্রিভ করা ড্রাইভারদের ডেটার চেকসাম ক্যালকুলেট করে কোনোপ্রকার ডুপ্লিকেট ব্যতিরেকে শুধু প্রয়োজনীয় পরিবর্তনসমূহ সিঙ্ক করে সেভ করে।
                </p>
              </div>
            </div>
          </div>

          {/* Sync Progress Status Element */}
          {syncState.running ? (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg p-6 shadow-sm space-y-5 animate-pulse-once">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-900 pb-3">
                <div className="flex items-center gap-3">
                  <RefreshCw size={24} className="text-emerald-500 animate-spin" />
                  <div>
                    <h3 className="font-bold text-sm tracking-tight font-sans text-zinc-900 dark:text-zinc-100">
                      অটোমেটেড সিঙ্ক অ্যাক্টিভিটি সক্রিয় রয়েছে...
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono tracking-wider">EXECUTION STATE: {syncState.step.toUpperCase()}</span>
                  </div>
                </div>

                <button
                  onClick={handleCancelAutoSync}
                  className="px-3 py-1.5 border border-red-200 dark:border-red-950/60 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <AlertCircle size={14} />
                  <span>সিঙ্ক বাতিল করুন (Cancel)</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-650 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>অগ্রগতি হার: {syncState.progress}%</span>
                  </span>
                  <span>সনাক্তকৃত ড্রাইভার: {syncState.found} জন</span>
                </div>
                
                {/* Custom Elegant Progress Bar */}
                <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-200/40 dark:border-zinc-800">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${syncState.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg p-6 shadow-sm space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mb-1.5">
                  <Clock size={16} className="text-zinc-400" />
                  <span>স্বয়ংক্রিয় সিঙ্ক শুরু করুন (Engagement Console)</span>
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                  সিঙ্ক বাটন ক্লিক করলে আমাদের নোড ব্যাকএন্ড সার্ভার আপনার প্রফাইল ক্রেডেনশিয়াল ব্যবহার করে সরাসরি ওভার পোর্টালে ভিজিট করা শুরু করবে। সম্পূর্ণ প্রক্রিয়াটি ব্যাকগ্রাউন্ডে সিকিউর উপায়ে সম্পন্ন হবে এবং আপনার ডেটাবেসে ড্রাইভার তালিকা অটোমেটিক্যালি রিফ্রেশ হয়ে যাবে।
                </p>
              </div>

              {statusMessage && (
                <div className={`p-4 rounded-md text-xs sm:text-sm flex items-start gap-2.5 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                    : statusMessage.type === 'error'
                    ? 'bg-red-50 text-red-950 border border-red-200'
                    : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                }`}>
                  {statusMessage.type === 'success' ? (
                    <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  ) : statusMessage.type === 'error' ? (
                    <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="text-zinc-500 shrink-0 mt-0.5" />
                  )}
                  <p>{statusMessage.text}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">

                {/* Start Page control */}
                <div className="flex flex-col gap-1 shrink-0">
                  <label htmlFor="start-page-input" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">
                    Start Page
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 min-w-[130px]">
                    <Hash size={13} className="text-zinc-500 shrink-0" />
                    <input
                      id="start-page-input"
                      type="number"
                      min={1}
                      max={999}
                      value={startPage}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setStartPage(isNaN(v) || v < 1 ? 1 : v);
                      }}
                      placeholder="1"
                      className="w-14 bg-transparent text-sm font-bold text-white outline-none placeholder-zinc-600 font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                      {startPage > 1 ? `page ${startPage}` : 'page 1'}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-600 font-mono">কোন page থেকে শুরু</span>
                </div>

                {/* Page Limit control */}
                <div className="flex flex-col gap-1 shrink-0">
                  <label htmlFor="max-pages-input" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">
                    Page Limit
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 min-w-[140px]">
                    <Hash size={13} className="text-zinc-500 shrink-0" />
                    <input
                      id="max-pages-input"
                      type="number"
                      min={0}
                      max={999}
                      value={maxPages === 0 ? '' : maxPages}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setMaxPages(isNaN(v) || v < 1 ? 0 : v);
                      }}
                      placeholder="সব"
                      className="w-14 bg-transparent text-sm font-bold text-white outline-none placeholder-zinc-600 font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                      {maxPages > 0 ? `${maxPages}টি page` : 'সব page'}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-600 font-mono">খালি রাখলে সব page scrape হবে</span>
                </div>

                <button
                  onClick={handleStartAutoSync}
                  disabled={!hasCreds || isSyncing}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 dark:disabled:bg-zinc-900 text-black disabled:text-zinc-400 font-bold text-sm rounded transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <RefreshCw size={16} />
                  <span>
                    ⚡ রিফ্রেশ সিঙ্ক শুরু করুন (Start Auto Sync)
                    {(startPage > 1 || maxPages > 0) && (
                      <span className="ml-1.5 text-[10px] font-mono bg-black/25 px-1.5 py-0.5 rounded">
                        {startPage > 1 ? `p${startPage}` : ''}
                        {startPage > 1 && maxPages > 0 ? '→' : ''}
                        {maxPages > 0 ? `+${maxPages}p` : ''}
                      </span>
                    )}
                  </span>
                </button>

                <div className="text-[11px] text-zinc-400 leading-relaxed max-w-md font-sans">
                  * সিঙ্ক চলাকালীন এই পেজটি লিভ করলেও সমস্যা নেই। ব্যাকগ্রাউন্ডে সিঙ্ক স্বয়ংক্রিয়ভাবে চলতে থাকবে। সিঙ্ক সম্পন্ন হলে ড্রাইভার ডেটা আপডেট হয়ে যাবে।
                </div>
              </div>
            </div>
          )}

          {/* Terminal Logs simulator console - ALWAYS VISIBLE */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg p-6 shadow-sm">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">Live Sync Diagnostics Output:</span>
              <div className="bg-zinc-950 text-emerald-400/90 p-4 rounded font-mono text-[10.5px] space-y-1 h-36 overflow-y-auto border border-zinc-900 shadow-inner leading-relaxed">
                <div className="text-zinc-500 flex items-center justify-between">
                  <span>[{syncState.started_at ? new Date(syncState.started_at).toLocaleTimeString() : new Date().toLocaleTimeString()}] SYNCHRONIZER CONNECTED TO LIVE VM PORT 3000</span>
                  <span className="text-[9px] bg-zinc-900 px-1 rounded uppercase">System Active</span>
                </div>
                <div className="text-zinc-500">---------------------------------------------------------------------------------</div>
                <div className="font-bold flex items-center gap-1">
                  <span className="text-emerald-500">&gt; CURRENT OPERATION PHASE:</span> 
                  <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded text-[9px]">{syncState.step.toUpperCase()}</span>
                </div>
                <div className="text-zinc-300">&gt; Live Status Report: {syncState.message}</div>
                
                {syncState.progress >= 45 && (
                  <div className="text-zinc-400">&gt; Scraping table content selectors [role=&quot;rowgroup&quot;] from document layout...</div>
                )}
                {syncState.found > 0 && (
                  <div className="text-emerald-300 font-extrabold">&gt;&gt; Validation success! Checked and loaded {syncState.found} verified driver credentials...</div>
                )}
                <div className="animate-pulse text-zinc-500">&gt; Listening for live incremental updates from server controller... _</div>
              </div>
            </div>
          </div>
        </div>
      ) : activeImportTab === 'html' ? (
        // --- HTML IMPORT TAB PANEL ---
        <div id="html-import-panel" className="space-y-6">
          <div className="bg-black text-white rounded-lg p-6 border border-zinc-800 relative overflow-hidden">
            <div className="absolute right-0 top-0 text-emerald-500 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12">
              <Clipboard size={220} />
            </div>
            
            <h2 className="text-2xl font-bold font-sans tracking-tight mb-2">Import Uber Portal Row HTML</h2>
            <p className="text-zinc-400 text-xs sm:text-sm">
              supplier.uber.com থেকে driver records এক্সট্র্যাক্ট করতে এবং পরিবর্তিত তথ্যগুলো স্বয়ংক্রিয়ভাবে সনাক্ত করতে নিচের নির্দেশনা অনুসরণ করুন।
            </p>

            {/* Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-xs text-zinc-300">
              <div className="bg-zinc-900/60 p-4 rounded border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold">১</span>
                  <span className="font-bold text-zinc-200">পোর্টাল এ ঢুকুন</span>
                </div>
                <p className="leading-relaxed">
                  আপনার Uber Supplier account-এ লগইন করে <strong>Drivers</strong> ট্যাবে যান যেন ড্রাইভারদের তালিকা দেখতে পান।
                </p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold">২</span>
                  <span className="font-bold text-zinc-200">কনসোল থেকে কোড নিন</span>
                </div>
                <p className="leading-relaxed">
                  F12 চেপে Console এ গিয়ে টাইপ করুন: <code className="text-emerald-400 block p-1 bg-black rounded mt-1 font-mono select-all overflow-x-auto text-[10px]">document.querySelector('[role="rowgroup"]').outerHTML</code> এবং পুরো আউটপুট কপি করুন।
                </p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold">৩</span>
                  <span className="font-bold text-zinc-200">পেস্ট এবং সিঙ্ক</span>
                </div>
                <p className="leading-relaxed">
                  প্রাপ্ত HTML কোডটি নিচের টেক্সট বক্সে পেস্ট করে Extract এ ক্লিক করুন এবং অতঃপর Data Sync সম্পন্ন করুন।
                </p>
              </div>
            </div>

            {/* Fast Playground Simulator Info */}
            <div className="mt-4 p-3 bg-zinc-900/90 rounded border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400 shrink-0" />
                <span className="text-zinc-200">
                  টেস্ট করতে চান? নিচের নমুনা বাটন ব্যবহার করে সরাসরি মক বা পরিবর্তিত ডাটা সিঙ্ক সিমুলেশন করে দেখুন !
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => loadSample('baseline')}
                  id="btn-sample-baseline"
                  className="flex-1 sm:flex-none py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-medium transition cursor-pointer"
                >
                  1. Load Base Data
                </button>
                <button
                  onClick={() => loadSample('updated')}
                  id="btn-sample-updated"
                  className="flex-1 sm:flex-none py-1.5 px-3 bg-amber-955/40 text-amber-300 hover:bg-amber-900/40 border border-amber-800/60 rounded font-medium transition cursor-pointer"
                >
                  2. Load Updated (Changes)
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div>
              <label className="block text-zinc-800 dark:text-zinc-200 font-semibold text-sm mb-1.5" htmlFor="html-paste-area">
                Paste HTML Block
              </label>
              <textarea
                id="html-paste-area"
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder='<div role="rowgroup" class="drivers-rows"> ... </div>'
                rows={8}
                className="w-full text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-3 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              ></textarea>
            </div>

            {statusMessage && (
              <div
                id="import-status-banner"
                className={`p-4 rounded-md text-xs sm:text-sm flex items-start gap-2.5 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                    : statusMessage.type === 'error'
                    ? 'bg-red-50 text-red-950 border border-red-200'
                    : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'error' ? (
                  <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-zinc-500 shrink-0 mt-0.5" />
                )}
                <p>{statusMessage.text}</p>
              </div>
            )}

            {validationIssues.length > 0 && (
              <div id="validation-warnings-box" className="p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-md text-xs sm:text-sm">
                <div className="flex items-center gap-2 mb-2 font-bold text-amber-900">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>⚠️ Warning: {validationIssues.length} drivers have data issues — review before syncing</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                  {validationIssues.map((issue, idx) => (
                    <li key={issue.uuid || idx}>
                      <span className="font-bold">{issue.driverName}</span> ({issue.uuid}) — {issue.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleParse}
                id="btn-trigger-parse"
                className="px-5 py-2 bg-black hover:bg-zinc-800 text-white font-medium text-sm rounded transition cursor-pointer"
              >
                Extract Driver Data
              </button>
              {htmlInput && (
                <button
                  onClick={() => {
                    setHtmlInput('');
                    setParsingResult(null);
                    setStatusMessage(null);
                    setValidationIssues([]);
                  }}
                  id="btn-clear-raw-html"
                  className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-sm rounded transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {parsingResult && parsingResult.length > 0 && (
            <div id="parsing-result-preview-panel" className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-fade-in-up">
              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-zinc-800 dark:text-zinc-100 font-bold text-sm">
                  Extracted Drivers Preview ({parsingResult.length} Found)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  Ready to Sync
                </span>
              </div>

              <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                {parsingResult.map((drv, idx) => (
                  <div key={drv.uuid || idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Avatar
                        photoUrl={drv.photo_url}
                        name={drv.name}
                        size={40}
                        className="bg-zinc-50 dark:bg-zinc-900 shrink-0"
                      />
                      <div>
                        <h4 className="text-zinc-900 dark:text-zinc-100 font-bold text-sm leading-tight">{drv.name}</h4>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-mono leading-none mt-1">{drv.uuid}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-1 text-xs sm:text-right">
                      <div>
                        <p className="text-zinc-400 text-[10px] uppercase font-medium leading-none mb-0.5">Email</p>
                        <p className="text-zinc-700 dark:text-zinc-300 font-medium">{drv.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 text-[10px] uppercase font-medium leading-none mb-0.5">Phone</p>
                        <p className="text-zinc-700 dark:text-zinc-300 font-medium">{drv.phone || '—'}</p>
                      </div>
                      <div className="sm:pl-6">
                        <p className="text-zinc-400 text-[10px] uppercase font-medium leading-none mb-0.5">Trips</p>
                        <p className="text-zinc-950 dark:text-zinc-100 font-mono font-bold">{drv.tip_count}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-end">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  id="btn-sync-to-db"
                  className={`px-6 py-2.5 rounded font-bold text-sm tracking-wide text-black bg-emerald-500 hover:bg-emerald-600 transition flex items-center gap-2 cursor-pointer ${
                    isSyncing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSyncing ? 'Synchronizing...' : '⚡ Sync & Upsert to Database'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // --- PLAIN TEXT PASTING METHOD TAB PANEL ---
        <div id="text-import-panel" className="space-y-6">
          <div className="bg-black text-white rounded-lg p-6 border border-zinc-800 relative overflow-hidden font-sans">
            <div className="absolute right-0 top-0 text-emerald-500 opacity-5 pointer-events-none transform translate-x-12 -translate-y-12">
              <FileText size={220} />
            </div>
            
            <h2 className="text-2xl font-bold font-sans tracking-tight mb-2">Import Plain Text Profile</h2>
            <p className="text-zinc-400 text-xs sm:text-sm">
              ড্রাইভার ভিউ বা মোবাইল কনসোল থেকে সরাসরি কপি করা ড্রাইভার বিবরণী পেস্ট করে সিঙ্ক করুন। একই ইমেইল এর জন্য আইডিটি অবিকল তৈরি হবে, ফলে কোনো ডুপ্লিকেট হবে না।
            </p>

            <div className="mt-4 p-3 bg-zinc-900/90 rounded border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-400 shrink-0" />
                <span className="text-zinc-205">
                  পরীক্ষা করতে চান? নিচের বাটন ব্যবহার করে নমুনা টেক্সট ডেটা লোড করুন!
                </span>
              </div>
              <button
                onClick={() => {
                  setTextInput(`User\nALTAF SHEIKH\nExisting active driver\nPhone\n+880 1735161216\nEmail\n01336691180md@gmail.com\nTrip count\n2559\nLast trip update\n02/06/2026`);
                  setStatusMessage({ type: 'info', text: 'নমুনা টেক্সট লোড করা হয়েছে! নিচে "Extract Driver details" বাটন ক্লিক করুন।' });
                  setTextParsingResult(null);
                  setValidationIssues([]);
                }}
                className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-bold transition cursor-pointer shrink-0 w-full sm:w-auto text-center"
              >
                Load Text Sample
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 font-sans">
            <div>
              <label className="block text-zinc-800 dark:text-zinc-200 font-bold text-sm mb-1.5" htmlFor="text-paste-area">
                Paste Profile Plain Text
              </label>
              <textarea
                id="text-paste-area"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`User\nALTAF SHEIKH...\nPhone\n+880...\nEmail\n0133...`}
                rows={8}
                className="w-full text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-3 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              ></textarea>
            </div>

            {statusMessage && (
              <div className={`p-4 rounded-md text-xs sm:text-sm flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-red-50 text-red-950 border border-red-200'
                  : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
              }`}>
                {statusMessage.type === 'success' ? (
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'error' ? (
                  <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-zinc-500 shrink-0 mt-0.5" />
                )}
                <p>{statusMessage.text}</p>
              </div>
            )}

            {validationIssues.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-md text-xs sm:text-sm">
                <div className="flex items-center gap-2 mb-2 font-bold text-amber-900">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>⚠️ Warning: Validation reports the following checklist issues:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-amber-900">
                  {validationIssues.map((issue, idx) => (
                    <li key={issue.uuid || idx}>
                      <span className="font-bold">{issue.driverName}</span> — {issue.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleParseText}
                className="px-5 py-2 bg-black hover:bg-zinc-850 text-white font-bold text-sm rounded transition cursor-pointer"
              >
                Extract Driver Details
              </button>
              {textInput && (
                <button
                  onClick={() => {
                    setTextInput('');
                    setTextParsingResult(null);
                    setStatusMessage(null);
                    setValidationIssues([]);
                  }}
                  className="px-5 py-2 bg-zinc-100 hover:bg-zinc-250 text-zinc-700 font-bold text-sm rounded transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {textParsingResult && textParsingResult.length > 0 && (
            <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden font-sans animate-fade-in-up">
              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-zinc-850 font-extrabold text-sm uppercase">
                  Extracted Live Preview ({textParsingResult.length} Found)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  Validated & Ready to sync
                </span>
              </div>

              <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {textParsingResult.map((drv, idx) => (
                  <div key={drv.uuid || idx} className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Initials fallback check is successfully validated here */}
                    <Avatar
                      photoUrl={drv.photo_url}
                      name={drv.name || 'Unknown'}
                      size={56}
                      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0"
                    />

                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1 bg-zinc-50/60 dark:bg-zinc-900 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Clipboard size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Driver Name</span>
                        </div>
                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase truncate">
                          {drv.name || '—'}
                        </p>
                      </div>

                      <div className="space-y-1 bg-zinc-50/60 dark:bg-zinc-900 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Smartphone size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Phone</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono truncate">
                          {drv.phone || '—'}
                        </p>
                      </div>

                      <div className="space-y-1 bg-zinc-50/60 dark:bg-zinc-900 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Mail size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Email</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                          {drv.email || '—'}
                        </p>
                      </div>

                      <div className="space-y-1 bg-zinc-50/60 dark:bg-zinc-900 p-2.5 rounded border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Hash size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Trip Count</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {drv.tip_count}
                        </p>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4 space-y-1 bg-zinc-50/60 dark:bg-zinc-900 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Generated System ID</span>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-semibold break-all select-all">
                          {drv.uuid}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-end">
                <button
                  onClick={handleSyncText}
                  disabled={isSyncing}
                  className={`px-6 py-2.5 rounded font-bold text-sm tracking-wide text-black bg-emerald-500 hover:bg-emerald-600 transition flex items-center gap-2 cursor-pointer ${
                    isSyncing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSyncing ? 'Saving driver profiles...' : `⚡ Sync & Save ${textParsingResult.length} Drivers to Database`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
