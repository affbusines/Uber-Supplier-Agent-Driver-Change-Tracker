import { useState, useEffect } from 'react';
import { Driver } from '../types';
import Avatar from './Avatar';
import { 
  listenToDrivers, 
  editDriver, 
  deleteDriver, 
  restoreDriver, 
  dismissChangeFlag, 
  startRewardTracking, 
  resetReward,
  bulkDeleteDrivers,
  bulkStartRewardTracking,
  bulkResetReward,
  getGlobalSettings,
  getNotificationSettings,
  dismissRewardMilestone
} from '../firebase';
import { 
  Search, 
  SlidersHorizontal, 
  AlertTriangle, 
  FileSpreadsheet, 
  Eye, 
  User, 
  Sparkles, 
  Edit2, 
  Trash2, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  X
} from 'lucide-react';

export default function Dashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'changed' | 'high_trips' | 'reward_active' | 'reward_f10_f50' | 'contact_changed'>('all');
  const [sortBy, setSortBy] = useState<'trips_desc' | 'trips_asc' | 'name_asc' | 'newest'>('trips_desc');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  
  // New States for Features
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // States for Reward Tracking
  const [rewardTrackingDriver, setRewardTrackingDriver] = useState<Driver | null>(null);
  const [rewardCycleInput, setRewardCycleInput] = useState<number>(52);
  const [resetConfirmationDriver, setResetConfirmationDriver] = useState<Driver | null>(null);

  // Bulk operation states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCycleModalOpen, setBulkCycleModalOpen] = useState(false);
  const [bulkCycleInput, setBulkCycleInput] = useState<number>(52);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const unsub = listenToDrivers((list) => {
      setDrivers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleRewardSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { completed, milestones } = detail;
      
      if (completed && completed.length > 0) {
        completed.forEach((name: string) => {
          showToast('success', `🎉 ${name} has completed their reward cycle!`);
        });
      }
      
      if (milestones && milestones.length > 0) {
        milestones.forEach((item: { name: string; remaining: number }) => {
          showToast('info', `⚡ ${item.name} needs only ${item.remaining} more trips for reward!`);
        });
      }
    };

    window.addEventListener('reward_sync_completed', handleRewardSync);

    // Also check for pending rewards from window
    const pending = (window as any).__pendingRewardToasts;
    if (pending) {
      const { completed, milestones } = pending;
      if (completed && completed.length > 0) {
        // Run with a very small delay to let mount transitions complete cleanly
        setTimeout(() => {
          completed.forEach((name: string) => {
            showToast('success', `🎉 ${name} has completed their reward cycle!`);
          });
        }, 300);
      }
      if (milestones && milestones.length > 0) {
        setTimeout(() => {
          milestones.forEach((item: { name: string; remaining: number }) => {
            showToast('info', `⚡ ${item.name} needs only ${item.remaining} more trips for reward!`);
          });
        }, 400);
      }
      delete (window as any).__pendingRewardToasts;
    }

    return () => window.removeEventListener('reward_sync_completed', handleRewardSync);
  }, [loading]);

  const showToast = (type: 'success' | 'info' | 'error', msg: string) => {
    setToast({ type, message: msg });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const renderRewardCell = (drv: Driver) => {
    if (!drv.reward) {
      return (
        <button
          onClick={() => {
            setRewardTrackingDriver(drv);
            setRewardCycleInput(52);
          }}
          className="px-3 py-1.5 bg-black text-white hover:bg-zinc-800 rounded font-bold text-xs transition flex items-center gap-1 select-none cursor-pointer"
        >
          <span>▶ Start</span>
        </button>
      );
    }

    const { active, trips_remaining, completed, start_tip_count, f10_done, f50_done } = drv.reward;
    const tripsDone = drv.tip_count - start_tip_count;
    const f10Eligible = active && tripsDone >= 10 && !f10_done;
    const f50Eligible = active && tripsDone >= 50 && !f50_done;

    const extraButtons = (f10Eligible || f50Eligible) ? (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {f10Eligible && (
          <button onClick={() => dismissRewardMilestone(drv.uuid, 'f10')} className="px-2 py-0.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded font-bold text-[10px] transition cursor-pointer">
            Done F10
          </button>
        )}
        {f50Eligible && (
          <button onClick={() => dismissRewardMilestone(drv.uuid, 'f50')} className="px-2 py-0.5 bg-purple-500 hover:bg-purple-600 text-white rounded font-bold text-[10px] transition cursor-pointer">
            Done F50
          </button>
        )}
      </div>
    ) : null;

    if (completed || trips_remaining <= 0) {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-850 px-2 py-0.5 rounded text-xs font-bold font-sans">
            🎉 Reward Complete!
          </span>
          {extraButtons}
          <div>
            <button
              onClick={() => setResetConfirmationDriver(drv)}
              className="text-[10px] text-zinc-400 hover:text-red-700 hover:underline font-bold transition flex items-center gap-1 cursor-pointer"
            >
              🔄 Reset
            </button>
          </div>
        </div>
      );
    }

    if (active) {
      let stateLabel = '';
      let stateStyle = '';
      
      if (trips_remaining > 20) {
        stateLabel = `⏳ ${trips_remaining} trips left`;
        stateStyle = 'text-zinc-600 font-medium font-sans';
      } else if (trips_remaining > 5) {
        stateLabel = `🔥 ${trips_remaining} trips left`;
        stateStyle = 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold font-sans inline-block';
      } else {
        stateLabel = `⚡ ${trips_remaining} trips left`;
        stateStyle = 'text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-black font-sans inline-block animate-pulse';
      }

      return (
         <div className="space-y-1">
           <div className={stateStyle}>{stateLabel}</div>
           {extraButtons}
           <div>
             <button
               onClick={() => setResetConfirmationDriver(drv)}
               className="text-[10px] text-zinc-400 hover:text-red-700 hover:underline font-bold transition flex items-center gap-1 cursor-pointer"
             >
               🔄 Reset
             </button>
           </div>
         </div>
      );
    }

    return null;
  };

  // Summary statistics calculated on active (non-deleted) drivers
  const activeDrivers = drivers.filter(d => !d.deleted);
  const totalDriversCount = activeDrivers.length;
  const changedDriversCount = activeDrivers.filter(d => d.has_contact_change).length;
  const topTripsDriver = activeDrivers.reduce((max, current) => (current.tip_count > max.tip_count ? current : max), activeDrivers[0] || null);

  // Dynamic Bento Grid Calculation Logic
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newToday = activeDrivers.filter(d => {
    return new Date(d.first_seen) >= new Date(new Date().setHours(0, 0, 0, 0));
  }).length;
  const activeRewards = activeDrivers.filter(d =>
    d.reward?.active && !d.reward?.completed
  ).length;
  const f10F50Count = activeDrivers.filter(d => {
    if (!d.reward || !d.reward.active) return false;
    const tripsDone = d.tip_count - d.reward.start_tip_count;
    const f10Eligible = tripsDone >= 10 && !d.reward.f10_done;
    const f50Eligible = tripsDone >= 50 && !d.reward.f50_done;
    return f10Eligible || f50Eligible;
  }).length;
  const contactChanges = activeDrivers.filter(d => d.has_contact_change).length;

  // Browser Notification Trigger helper
  const triggerBrowserPush = (title: string, body: string, iconUrl?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: iconUrl || undefined,
        });
      } catch (_) {}
    }
  };

  // Track reward thresholds notifications
  useEffect(() => {
    if (loading || drivers.length === 0) return;
    
    const prefs = getNotificationSettings();
    if (!prefs.reward_alert) return;
    
    const thresholds = prefs.reward_thresholds || [5, 3, 1];
    
    drivers.forEach(driver => {
      if (driver.reward && driver.reward.active && !driver.reward.completed) {
        const remaining = driver.reward.trips_remaining;
        if (thresholds.includes(remaining)) {
          const notifiedKey = `notified_${driver.uuid}_${driver.reward.next_reward_at}_${remaining}`;
          if (localStorage.getItem(notifiedKey) !== 'true') {
            triggerBrowserPush(
              '⚡ Reward Almost Ready!',
              `⚡ ${driver.name} is only ${remaining} trip${remaining > 1 ? 's' : ''} away from completing their target!`,
              driver.photo_url
            );
            localStorage.setItem(notifiedKey, 'true');
          }
        }
      }
    });
  }, [drivers, loading]);

  // Bulk operation handlers
  const toggleSelect = (uuid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (displayedList: Driver[]) => {
    if (selectedIds.size === displayedList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedList.map(d => d.uuid)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMessage = `অনিবার্য সতর্কতা! আপনি নির্বাচিত ${selectedIds.size} জন ড্রাইভারের তথ্য মুছে ফেলতে যাচ্ছেন। আপনি কি নিশ্চিত?`;
    if (window.confirm(confirmMessage)) {
      try {
        await bulkDeleteDrivers(Array.from(selectedIds) as string[], false);
        showToast('success', `🗑️ ${selectedIds.size} জন ড্রাইভার সফলভাবে মুছে ফেলা হয়েছে!`);
        setSelectedIds(new Set());
      } catch (err) {
        showToast('error', 'বাছাইকৃত ড্রাইভার মোছা ব্যর্থ হয়েছে।');
      }
    }
  };

  const handleBulkHardDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMessage = `🚨 চরম সতর্কতা! আপনি নির্বাচিত ${selectedIds.size} জন ড্রাইভারের তথ্য চিরতরে (Permanently Hard Delete) মুছে ফেলতে যাচ্ছেন। এই পরিবর্তন আর ফিরিয়ে আনা যাবে না! আপনি কি নিশ্চিত?`;
    if (window.confirm(confirmMessage)) {
      try {
        await bulkDeleteDrivers(Array.from(selectedIds) as string[], true);
        showToast('success', `🗑️ ${selectedIds.size} জন ড্রাইভার চিরতরে মুছে ফেলা হয়েছে!`);
        setSelectedIds(new Set());
      } catch (err) {
        showToast('error', 'বাছাইকৃত ড্রাইভার চিরতরে মোছা ব্যর্থ হয়েছে।');
      }
    }
  };

  const handleBulkResetReward = async () => {
    if (selectedIds.size === 0) return;
    const confirmMessage = `নির্বাচিত ${selectedIds.size} জন ড্রাইভারের রিওয়ার্ড সাইকেল ট্র্যাকিং রি-সেট করতে চান?`;
    if (window.confirm(confirmMessage)) {
      try {
        await bulkResetReward(Array.from(selectedIds) as string[]);
        showToast('success', `🔄 ${selectedIds.size} জনের রিওয়ার্ড সাইকেল রিসেট সম্পন্ন!`);
        setSelectedIds(new Set());
      } catch (err) {
        showToast('error', 'রিসেট করতে ব্যর্থ হয়েছে।');
      }
    }
  };

  const handleBulkStartReward = () => {
    const eligibleIds = (Array.from(selectedIds) as string[]).filter(uuid => {
      const d = drivers.find(drv => drv.uuid === uuid);
      return !d?.reward || d.reward.completed;
    });

    if (eligibleIds.length === 0) {
      showToast('info', '⚠️ বাছাইকৃতদের মধ্যে সবার রিওয়ার্ড ট্র্যাকিং অলরেডি সচল আছে।');
      return;
    }

    const globalDefault = getGlobalSettings().default_reward_cycle || 52;
    setBulkCycleInput(globalDefault);
    setBulkCycleModalOpen(true);
  };

  const handleConfirmBulkStart = async () => {
    const eligibleIds = (Array.from(selectedIds) as string[]).filter(uuid => {
      const d = drivers.find(drv => drv.uuid === uuid);
      return !d?.reward || d.reward.completed;
    });

    try {
      await bulkStartRewardTracking(eligibleIds, bulkCycleInput);
      showToast('success', `▶️ ${eligibleIds.length} জন ড্রাইভারের রিওয়ার্ড সাইকেল (${bulkCycleInput} ট্রিপ) সচল হয়েছে!`);
      setBulkCycleModalOpen(false);
      setSelectedIds(new Set());
    } catch (err) {
      showToast('error', 'রিওয়ার্ড ট্র্যাকিং সচল করা ব্যর্থ হয়েছে।');
    }
  };

  // Search, Visibility Filter and Filtering Mode
  const displayedDrivers = drivers.filter(drv => {
    if (!showDeleted && drv.deleted) {
      return false;
    }
    return true;
  });

  const filteredDrivers = displayedDrivers.filter(drv => {
    // Queries
    const query = searchQuery.toLowerCase().trim();
    const queryMatches = !query ? true : (
      drv.name.toLowerCase().includes(query) ||
      drv.uuid.toLowerCase().includes(query) ||
      drv.email.toLowerCase().includes(query) ||
      drv.phone.toLowerCase().includes(query) ||
      (drv.old_email && drv.old_email.toLowerCase().includes(query)) ||
      (drv.old_phone && drv.old_phone.toLowerCase().includes(query))
    );

    // Modes
    if (filterMode === 'changed' || filterMode === 'contact_changed') {
      return queryMatches && drv.has_contact_change;
    }
    if (filterMode === 'high_trips') {
      return queryMatches && drv.tip_count >= 150;
    }
    if (filterMode === 'reward_active') {
      return queryMatches && drv.reward?.active && !drv.reward?.completed;
    }
    if (filterMode === 'reward_f10_f50') {
      if (!drv.reward || !drv.reward.active) return false;
      const tripsDone = drv.tip_count - drv.reward.start_tip_count;
      const f10Eligible = tripsDone >= 10 && !drv.reward.f10_done;
      const f50Eligible = tripsDone >= 50 && !drv.reward.f50_done;
      return queryMatches && (f10Eligible || f50Eligible);
    }

    return queryMatches;
  });

  // Sorting
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (sortBy === 'trips_desc') return b.tip_count - a.tip_count;
    if (sortBy === 'trips_asc') return a.tip_count - b.tip_count;
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'newest') return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
    return 0;
  });

  // Export CSV Functionality
  const exportToCSV = () => {
    if (activeDrivers.length === 0) return;

    const headers = ['UUID', 'Name', 'Photo URL', 'Total Trips', 'Current Email', 'Previous Email', 'Current Phone', 'Previous Phone', 'Has Changes', 'First Seen', 'Last Synced', 'Deleted'];
    const rows = activeDrivers.map(d => [
      d.uuid,
      `"${d.name.replace(/"/g, '""')}"`,
      d.photo_url,
      d.tip_count,
      d.email,
      d.old_email || '',
      d.phone,
      d.old_phone || '',
      d.has_contact_change ? 'YES' : 'NO',
      d.first_seen,
      d.last_updated,
      d.deleted ? 'YES' : 'NO'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `uber_drivers_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      // Beautiful locale custom text format
      return d.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return isoStr;
    }
  };

  return (
    <div id="drivers-dashboard-panel" className="space-y-6">
      
      {/* 1. DYNAMIC SUMMARY CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-bento-grid">
        
        {/* Card 1: Total Drivers */}
        <button 
          onClick={() => { setFilterMode('all'); setSearchQuery(''); }}
          className={`text-left rounded-lg p-4 md:p-5 flex flex-col justify-between border shadow-sm relative overflow-hidden select-none cursor-pointer transition-all duration-200 ${
            filterMode === 'all' 
              ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950' 
              : 'bg-white dark:bg-zinc-955 border-zinc-200 dark:border-zinc-900 text-zinc-900 dark:text-zinc-100 hover:scale-[1.02]'
          }`}
        >
          <div className="flex justify-between items-start w-full">
            <span className={`uppercase font-sans tracking-wide text-[10px] md:text-[11px] font-extrabold ${filterMode === 'all' ? 'text-emerald-400 dark:text-emerald-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
              Total Drivers
            </span>
            <span className="text-sm">👥</span>
          </div>
          <div className="mt-3">
            <span className="block text-2xl md:text-3xl font-extrabold font-mono leading-none">{totalDriversCount}</span>
            <span className={`block text-[10px] mt-1.5 font-sans font-medium ${filterMode === 'all' ? 'text-zinc-300 dark:text-zinc-650' : 'text-zinc-400 dark:text-zinc-550'}`}>
              +{newToday} today
            </span>
          </div>
        </button>

        {/* Card 2: Active Reward Tracking */}
        <button 
          onClick={() => { setFilterMode('reward_active'); setSearchQuery(''); }}
          className={`text-left rounded-lg p-4 md:p-5 flex flex-col justify-between border shadow-sm relative overflow-hidden select-none cursor-pointer transition-all duration-200 ${
            filterMode === 'reward_active' 
              ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950' 
              : 'bg-white dark:bg-zinc-955 border-zinc-200 dark:border-zinc-900 text-zinc-900 dark:text-zinc-100 hover:scale-[1.02]'
          }`}
        >
          <div className="flex justify-between items-start w-full">
            <span className={`uppercase font-sans tracking-wide text-[10px] md:text-[11px] font-extrabold ${filterMode === 'reward_active' ? 'text-emerald-400 dark:text-emerald-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
              Active rewards
            </span>
            <span className="text-sm">⏳</span>
          </div>
          <div className="mt-3">
            <span className="block text-2xl md:text-3xl font-extrabold font-mono leading-none">{activeRewards}</span>
            <span className={`block text-[10px] mt-1.5 font-sans font-medium ${filterMode === 'reward_active' ? 'text-zinc-300 dark:text-zinc-650' : 'text-zinc-400 dark:text-zinc-550'}`}>
              of {totalDriversCount} active
            </span>
          </div>
        </button>

        {/* Card 3: Completed F10 & F50 */}
        <button 
          onClick={() => { setFilterMode('reward_f10_f50'); setSearchQuery(''); }}
          className={`text-left rounded-lg p-4 md:p-5 flex flex-col justify-between border shadow-sm relative overflow-hidden select-none cursor-pointer transition-all duration-200 ${
            filterMode === 'reward_f10_f50' 
              ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950' 
              : 'bg-white dark:bg-zinc-955 border-zinc-200 dark:border-zinc-900 text-zinc-900 dark:text-zinc-100 hover:scale-[1.02]'
          }`}
        >
          <div className="flex justify-between items-start w-full">
            <span className={`uppercase font-sans tracking-wide text-[10px] md:text-[11px] font-extrabold ${filterMode === 'reward_f10_f50' ? 'text-emerald-400 dark:text-emerald-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
              Completed F10 & F50
            </span>
            <span className="text-sm">🎯</span>
          </div>
          <div className="mt-3">
            <span className="block text-2xl md:text-3xl font-extrabold font-mono leading-none">{f10F50Count}</span>
            <span className={`block text-[10px] mt-1.5 font-sans font-medium ${filterMode === 'reward_f10_f50' ? 'text-zinc-300 dark:text-zinc-650' : 'text-zinc-400 dark:text-zinc-550'}`}>
              milestones reached
            </span>
          </div>
        </button>

        {/* Card 4: Contact Changes */}
        <button 
          onClick={() => { setFilterMode('contact_changed'); setSearchQuery(''); }}
          className={`text-left rounded-lg p-4 md:p-5 flex flex-col justify-between border shadow-sm relative overflow-hidden select-none cursor-pointer transition-all duration-200 ${
            filterMode === 'contact_changed' || filterMode === 'changed'
              ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950' 
              : 'bg-white dark:bg-zinc-955 border-zinc-200 dark:border-zinc-900 text-zinc-900 dark:text-zinc-100 hover:scale-[1.02]'
          }`}
        >
          <div className="flex justify-between items-start w-full">
            <span className={`uppercase font-sans tracking-wide text-[10px] md:text-[11px] font-extrabold ${filterMode === 'contact_changed' || filterMode === 'changed' ? 'text-emerald-400 dark:text-emerald-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
              Contact Changes
            </span>
            <span className="text-sm">⚠️</span>
          </div>
          <div className="mt-3">
            <span className="block text-2xl md:text-3xl font-extrabold font-mono leading-none">{contactChanges}</span>
            <span className={`block text-[10px] mt-1.5 font-sans font-medium ${filterMode === 'contact_changed' || filterMode === 'changed' ? 'text-zinc-300 dark:text-zinc-650' : 'text-zinc-400 dark:text-zinc-550'}`}>
              review modifications
            </span>
          </div>
        </button>

      </div>

      {/* 2. SEARCH AND FILTER CONTROLS BAR */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-lg p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 shadow-sm" id="dashboard-controls-bar">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-550" />
          <input
            type="text"
            id="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, ফোন বা ইমেইল খোঁজুন..."
            className="w-full text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 border border-zinc-350 dark:border-zinc-850 rounded px-3 py-2 pl-9 text-xs sm:text-sm focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white outline-none font-medium"
          />
        </div>

        {/* Toolbar selectors */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Quick filter segmented links */}
          <div className="bg-zinc-100 dark:bg-zinc-950 rounded p-1 flex gap-1 text-[11px] font-bold border border-zinc-200/40 dark:border-zinc-900">
            <button
              onClick={() => setFilterMode('all')}
              id="filter-all"
              className={`px-3 py-1.5 rounded transition uppercase cursor-pointer ${
                filterMode === 'all' 
                  ? 'bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 shadow-xs' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-250'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('changed')}
              id="filter-changed"
              className={`px-3 py-1.5 rounded transition uppercase flex items-center gap-1 cursor-pointer ${
                filterMode === 'changed' || filterMode === 'contact_changed'
                  ? 'bg-white dark:bg-zinc-850 text-amber-805 dark:text-amber-400 shadow-xs' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-250'
              }`}
            >
              <span>Changed Only</span>
              {changedDriversCount > 0 && <span className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 px-1 rounded text-[9px] font-mono font-bold">{changedDriversCount}</span>}
            </button>
            <button
              onClick={() => setFilterMode('high_trips')}
              id="filter-high-trips"
              className={`px-3 py-1.5 rounded transition uppercase cursor-pointer ${
                filterMode === 'high_trips' 
                  ? 'bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 shadow-xs' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-250'
              }`}
            >
              Most Trips (&ge;150)
            </button>
          </div>

          {/* Show Deleted Toggle */}
          <label className="flex items-center gap-1.5 p-1.5 px-3 border border-zinc-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="accent-black dark:accent-white rounded cursor-pointer size-3.5 animate-none"
            />
            <span>Deleted List [{drivers.filter(d => d.deleted).length}]</span>
          </label>

          {/* Sort selection dropdown */}
          <div className="relative flex items-center gap-1.5 p-1 px-2.5 border border-zinc-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-350">
            <SlidersHorizontal size={13} className="text-zinc-500" />
            <select
              id="select-sort"
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-zinc-800 dark:text-zinc-100 pr-1 cursor-pointer"
            >
              <option value="trips_desc" className="bg-white dark:bg-zinc-900 text-black dark:text-white">High Trips</option>
              <option value="trips_asc" className="bg-white dark:bg-zinc-900 text-black dark:text-white">Low Trips</option>
              <option value="name_asc" className="bg-white dark:bg-zinc-900 text-black dark:text-white">Alphabetical</option>
              <option value="newest" className="bg-white dark:bg-zinc-900 text-black dark:text-white">Recently Synced</option>
            </select>
          </div>

          {/* CSV Export Button */}
          {activeDrivers.length > 0 && (
            <button
              onClick={exportToCSV}
              id="btn-export-csv"
              className="py-2 px-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={13} />
              <span>Export CSV</span>
            </button>
          )}

        </div>

      </div>

      {/* 3. MAIN RESPONSIVE DRIVERS CONTAINER */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-lg shadow-sm overflow-hidden" id="drivers-table-card">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            ড্রাইভার ডাটাবেস লোড হচ্ছে...
          </div>
        ) : sortedDrivers.length === 0 ? (
          <div className="p-16 text-center space-y-2 bg-white dark:bg-zinc-950">
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">কোনো ড্রাইভার রেকর্ড পাওয়া যায়নি।</p>
            {searchQuery || filterMode !== 'all' || showDeleted ? (
              <button 
                onClick={() => { setSearchQuery(''); setFilterMode('all'); setShowDeleted(false); }}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold underline cursor-pointer"
              >
                Clear all filters
              </button>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">শুরু করতে "Paste Row HTML" ট্যাব থেকে আপনার পোর্টাল ডাটা পেস্ট করুন।</p>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse" id="drivers-data-table">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-850 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-black tracking-wider select-none">
                    <th className="py-3.5 px-6 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sortedDrivers.length > 0 && selectedIds.size === sortedDrivers.length}
                        onChange={() => handleToggleSelectAll(sortedDrivers)}
                        className="accent-black dark:accent-white rounded cursor-pointer size-4"
                      />
                      <span>Driver Profile</span>
                    </th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Contact Email</th>
                    <th className="py-3.5 px-4">Trips Count</th>
                    <th className="py-3.5 px-4">Reward Status</th>
                    <th className="py-3.5 px-4">Last Sync Date</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs sm:text-sm text-zinc-750 dark:text-zinc-200 bg-white dark:bg-zinc-900/40">
                  {sortedDrivers.map((drv) => (
                    <tr 
                      key={drv.uuid}
                      className={`hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30 transition-colors ${
                        drv.deleted 
                          ? 'bg-red-50/20 dark:bg-red-950/10 opacity-75' 
                          : drv.has_contact_change 
                          ? 'bg-amber-50/15 dark:bg-amber-950/5' 
                          : ''
                      }`}
                    >
                      {/* Avatar & Profile Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(drv.uuid)}
                            onChange={() => toggleSelect(drv.uuid)}
                            className="accent-black dark:accent-white rounded cursor-pointer size-4"
                          />
                          <Avatar 
                            photoUrl={drv.photo_url} 
                            name={drv.name} 
                            size={40} 
                            className="bg-zinc-100 dark:bg-zinc-800"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-zinc-900 dark:text-white leading-tight">{drv.name}</span>
                              {drv.deleted && (
                                <span className="bg-red-100 text-red-800 text-[8px] font-bold px-1.5 rounded uppercase leading-none">Deleted</span>
                              )}
                              {drv.edited_manually && (
                                <span className="bg-blue-100 text-blue-800 text-[8px] font-bold px-1.5 rounded uppercase leading-none">Edited</span>
                              )}
                            </div>
                            <span className="block text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-1 uppercase" title={drv.uuid}>
                              ID: {drv.uuid.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone Column with Old Log Detection */}
                      <td className="py-4 px-4">
                        {drv.old_phone && drv.old_phone !== drv.phone ? (
                          <div className="space-y-1">
                            <span className="block font-bold text-zinc-950 dark:text-zinc-100 font-mono text-xs">{drv.phone}</span>
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                              <span className="line-through bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded px-1" title="পূর্ববর্তী ফোন">
                                {drv.old_phone}
                              </span>
                              <span className="text-amber-600 bg-amber-50 dark:bg-amber-955 rounded px-1 text-[9px] font-bold uppercase tracking-tight">Changed</span>
                            </div>
                          </div>
                        ) : (
                          <span className="font-semibold text-zinc-800 dark:text-zinc-300 font-mono text-xs">{drv.phone || '—'}</span>
                        )}
                      </td>

                      {/* Email Column with Old Log Detection */}
                      <td className="py-4 px-4">
                        {drv.old_email && drv.old_email !== drv.email ? (
                          <div className="space-y-1">
                            <span className="block font-bold text-zinc-950 dark:text-zinc-150 text-xs truncate max-w-[185px]" title={drv.email}>
                              {drv.email}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 max-w-[185px]">
                              <span className="line-through bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded px-1 truncate" title="পূর্ববর্তী ইমেইল">
                                {drv.old_email}
                              </span>
                              <span className="text-amber-600 bg-amber-50 dark:bg-amber-955 rounded px-1 text-[9px] font-bold uppercase tracking-tight shrink-0">Changed</span>
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium text-zinc-700 dark:text-zinc-300 text-xs truncate max-w-[185px]" title={drv.email}>
                            {drv.email || '—'}
                          </span>
                        )}
                      </td>

                      {/* Trip Count and Performance Indicator bar */}
                      <td className="py-4 px-4 font-mono">
                        <div className="space-y-1">
                          <span className="font-black text-zinc-900 dark:text-white font-sans">{drv.tip_count}</span>
                          <div className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1">
                            <div 
                              className="bg-emerald-500 h-1 rounded-full" 
                              style={{ width: `${Math.min((drv.tip_count / 550) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Reward Column */}
                      <td className="py-4 px-4">
                        {renderRewardCell(drv)}
                      </td>

                      {/* Last Sync Stamp */}
                      <td className="py-4 px-4 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                        {formatDate(drv.last_updated)}
                      </td>

                      {/* Inline and Inspections Actions Group */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {drv.has_contact_change && (
                            <button
                              onClick={async () => {
                                try {
                                  await dismissChangeFlag(drv.uuid);
                                  showToast('success', `${drv.name} এর তথ্য পরিবর্তিত অ্যালার্ট যাচাই সম্পন্ন হিসেবে চিহ্নিত করা হয়েছে।`);
                                } catch (_) {
                                  showToast('error', 'হয়নি।');
                                }
                              }}
                              title="Mark as Reviewed"
                              id={`btn-inline-dismiss-${drv.uuid.slice(0, 8)}`}
                              className="p-1 px-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:text-black dark:hover:text-white text-emerald-855 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded transition text-xs font-bold inline-flex items-center gap-1 select-none cursor-pointer"
                            >
                              <Check size={12} className="stroke-[3]" />
                            </button>
                          )}

                          {drv.deleted && (
                            <button
                              onClick={async () => {
                                try {
                                  await restoreDriver(drv.uuid);
                                  showToast('success', `${drv.name} পুনরুদ্ধার করা হয়েছে সফলভাবে।`);
                                } catch (_) {
                                  showToast('error', 'হয়নি।');
                                }
                              }}
                              title="Restore Deleted Driver"
                              id={`btn-inline-restore-${drv.uuid.slice(0, 8)}`}
                              className="p-1 px-2 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-500 hover:text-black text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900 rounded transition text-xs font-bold inline-flex items-center gap-1 select-none cursor-pointer animate-pulse"
                            >
                              <RefreshCw size={12} />
                            </button>
                          )}

                          <button
                            onClick={() => setEditingDriver(drv)}
                            title="Edit Driver Details"
                            id={`btn-inline-edit-${drv.uuid.slice(0, 8)}`}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-450 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={() => setDeletingDriver(drv)}
                            title="Delete Record"
                            id={`btn-inline-delete-${drv.uuid.slice(0, 8)}`}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-zinc-400 hover:text-red-650 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>

                          <button
                            onClick={() => setSelectedDriver(drv)}
                            id={`btn-inspect-details-${drv.uuid.slice(0, 8)}`}
                            className="p-1 px-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-black dark:hover:bg-zinc-100 hover:text-white dark:hover:text-black rounded transition text-xs font-semibold text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 select-none cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards Grid Layout */}
            <div className="block lg:hidden divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900" id="drivers-mobile-cards">
              {sortedDrivers.map((drv) => (
                <div 
                  key={drv.uuid}
                  className={`p-4 space-y-3.5 transition-colors ${
                    drv.deleted 
                      ? 'bg-red-50/20 dark:bg-red-950/10 opacity-75' 
                      : drv.has_contact_change 
                      ? 'bg-amber-50/15 dark:bg-amber-950/5' 
                      : 'bg-white dark:bg-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox trigger */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(drv.uuid)}
                      onChange={() => toggleSelect(drv.uuid)}
                      className="accent-black dark:accent-white rounded cursor-pointer size-4.5 mt-0.5 shrink-0"
                    />
                    
                    {/* Dynamic Driver Avatar */}
                    <Avatar 
                      photoUrl={drv.photo_url} 
                      name={drv.name} 
                      size={44} 
                      className="bg-zinc-100 dark:bg-zinc-900"
                    />
                    
                    {/* Detailed Metadata fields */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                          {drv.name}
                        </span>
                        {drv.deleted && (
                          <span className="bg-red-100 text-red-800 text-[8px] font-black px-1.5 rounded uppercase leading-none">Deleted</span>
                        )}
                        {drv.edited_manually && (
                          <span className="bg-blue-100 text-blue-800 text-[8px] font-black px-1.5 rounded uppercase leading-none">Edited</span>
                        )}
                      </div>
                      
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-550 font-mono truncate">
                        ID: {drv.uuid.slice(0, 15)}...
                      </div>
                      
                      {/* Contact values status */}
                      <div className="text-xs space-y-1 shadow-inner p-2 rounded bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-900 mt-2">
                        <div className="flex justify-between items-start">
                          <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase text-[9px] tracking-wide mt-0.5">Phone:</span>
                          <div className="text-right flex flex-col items-end">
                            <span className="font-bold text-zinc-855 dark:text-zinc-200 font-mono">
                              {drv.phone || '—'}
                            </span>
                            {drv.old_phone && drv.old_phone !== drv.phone && (
                              <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                                <span className="line-through bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded px-1" title="পূর্ববর্তী ফোন">
                                  {drv.old_phone}
                                </span>
                                <span className="text-amber-605 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/45 rounded px-1 text-[8px] font-bold uppercase tracking-tight">Changed</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-start min-w-0 pt-1.5 border-t border-dashed border-zinc-200/50 dark:border-zinc-800">
                          <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase text-[9px] tracking-wide shrink-0 mt-0.5">Email:</span>
                          <div className="text-right min-w-0 flex flex-col items-end">
                            <span className="font-bold text-zinc-850 dark:text-zinc-200 truncate block max-w-[170px] font-sans" title={drv.email}>
                              {drv.email || '—'}
                            </span>
                            {drv.old_email && drv.old_email !== drv.email && (
                              <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                                <span className="line-through bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded px-1 truncate max-w-[130px]" title="পূর্ববর্তী ইমেইল">
                                  {drv.old_email}
                                </span>
                                <span className="text-amber-605 dark:text-amber-400 bg-amber-50 dark:bg-amber-955 rounded px-1 text-[8px] font-bold uppercase tracking-tight shrink-0">Changed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics status footer row */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-zinc-100 dark:border-zinc-900">
                    <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 font-sans">
                      <span className="font-black text-sm text-zinc-900 dark:text-white font-mono">{drv.tip_count}</span>
                      <span className="ml-1 uppercase text-[10px]">Total Trips</span>
                    </div>
                    
                    <div className="scale-95 origin-right">
                      {renderRewardCell(drv)}
                    </div>
                  </div>

                  {/* Actions column bar (Minimum height touch triggers 44px) */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2.5 border-t border-zinc-150/60 dark:border-zinc-850">
                    {drv.has_contact_change && (
                      <button
                        onClick={async () => {
                          try {
                            await dismissChangeFlag(drv.uuid);
                            showToast('success', `${drv.name} এর তথ্য পরিবর্তিত অ্যালার্ট যাচাই সম্পন্ন হয়েছে।`);
                          } catch (_) {
                            showToast('error', 'হয়নি।');
                          }
                        }}
                        className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-500 hover:text-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded text-xs font-bold inline-flex items-center gap-1 min-h-[44px] cursor-pointer"
                      >
                        <Check size={14} className="stroke-[3]" />
                        <span>Review</span>
                      </button>
                    )}

                    {drv.deleted && (
                      <button
                        onClick={async () => {
                          try {
                            await restoreDriver(drv.uuid);
                            showToast('success', `${drv.name} পুনরুদ্ধার করা হয়েছে সফলভাবে।`);
                          } catch (_) {
                            showToast('error', 'হয়নি।');
                          }
                        }}
                        className="py-1.5 px-3 bg-amber-50 hover:bg-amber-500 hover:text-black text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-250 rounded text-xs font-bold inline-flex items-center gap-1 min-h-[44px] cursor-pointer"
                      >
                        <RefreshCw size={14} />
                        <span>Restore</span>
                      </button>
                    )}

                    <button
                      onClick={() => setEditingDriver(drv)}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer border border-zinc-200 dark:border-zinc-800"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() => setDeletingDriver(drv)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-zinc-400 dark:text-zinc-450 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer border border-zinc-200 dark:border-zinc-800"
                    >
                      <Trash2 size={14} />
                    </button>

                    <button
                      onClick={() => setSelectedDriver(drv)}
                      className="py-1.5 px-3 bg-zinc-100 dark:bg-zinc-805 hover:bg-black dark:hover:bg-zinc-100 hover:text-white dark:hover:text-black rounded text-xs font-extrabold text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1 border border-zinc-250 dark:border-zinc-700 min-h-[44px] cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. FLOATING STICKY BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div 
          id="bulk-operations-bar"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-950 text-white dark:bg-white dark:text-black p-4 rounded-xl shadow-2xl border border-zinc-800 dark:border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 animate-slide-up max-w-lg w-[calc(100%-2rem)] md:w-full font-sans transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-black font-black text-xs px-2.5 py-0.5 rounded-full animate-pulse">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold tracking-tight uppercase">Selected</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={handleBulkStartReward}
              className="flex-1 py-1.5 px-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 dark:bg-zinc-100 dark:border-zinc-200 dark:hover:bg-zinc-250 rounded-lg text-[10px] font-black text-white dark:text-black uppercase text-center cursor-pointer transition select-none flex items-center justify-center gap-1 min-h-[40px]"
            >
              <span>▶ Start Reward</span>
            </button>
            
            <button
              onClick={handleBulkResetReward}
              className="flex-1 py-1.5 px-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 dark:bg-zinc-100 dark:border-zinc-200 dark:hover:bg-zinc-250 rounded-lg text-[10px] font-black text-white dark:text-black uppercase text-center cursor-pointer transition select-none flex items-center justify-center gap-1 min-h-[40px]"
            >
              <span>🔄 Reset</span>
            </button>
            
            <button
              onClick={handleBulkDelete}
              className="flex-1 py-1.5 px-2 bg-red-950/40 border border-red-905/30 text-red-400 hover:bg-red-900 hover:text-white dark:bg-red-55 dark:text-red-700 dark:hover:bg-red-100 rounded-lg text-[10px] font-black uppercase text-center cursor-pointer transition select-none flex items-center justify-center gap-1 min-h-[40px]"
              title="Soft delete selected records"
            >
              <span>🗑 Soft Del</span>
            </button>

            <button
              onClick={handleBulkHardDelete}
              className="flex-1 py-1.5 px-2 bg-red-650 hover:bg-red-750 text-white dark:bg-red-600 dark:hover:bg-red-700 rounded-lg text-[10px] font-black uppercase text-center cursor-pointer transition select-none flex items-center justify-center gap-1 min-h-[40px] shadow-lg shadow-red-950/20 active:scale-95"
              title="Permanently hard delete selected records from database"
            >
              <span>🚨 Hard Del</span>
            </button>
            
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-400 dark:text-zinc-550 hover:text-white dark:hover:text-black p-2 cursor-pointer transition select-none shrink-0"
              title="Deselect All"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 5. OVERLAY MODAL FOR BULK CYCLE CONFIGURATION */}
      {bulkCycleModalOpen && (
        <div 
          id="bulk-cycle-modal"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setBulkCycleModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-lg shadow-2xl p-6 max-w-sm w-full space-y-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-tight">Active Bulk Rewards</h4>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">সাইকেল প্রতি ট্রিপ সংখ্যা নির্ধারণ করুন</p>
              </div>
              <button 
                onClick={() => setBulkCycleModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-850 dark:hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-150 dark:border-zinc-850">
              <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300">Set Reward Cycle Size:</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={bulkCycleInput}
                onChange={(e) => setBulkCycleInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center font-mono font-black text-zinc-800 dark:text-white bg-white dark:bg-zinc-950 border border-zinc-350 dark:border-zinc-800 rounded p-1.5 text-xs outline-none"
              />
            </div>

            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-normal">
              এটি {selectedIds.size} জন ড্রাইভারের রিওয়ার্ড চক্রকে সচল করবে সাইকেল সাইজ {bulkCycleInput} ট্রিপে।
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setBulkCycleModalOpen(false)}
                className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-90 w-full text-zinc-700 dark:text-zinc-300 rounded font-bold text-xs hover:opacity-85 cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkStart}
                className="flex-1 py-2 bg-emerald-500 text-black rounded font-black text-xs hover:opacity-85 cursor-pointer text-center"
              >
                Confirm Start
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 4. MODAL DRAWER OVERLAY IN Bengali FOR DETAILS & INTEGRITY LOGGING HISTORY */}
      {selectedDriver && (
        <div 
          id="driver-detail-modal"
          className="fixed inset-0 bg-transparent flex items-center justify-end z-40 animate-fade-in backdrop-brightness-75 transition-all w-full h-full"
          onClick={() => setSelectedDriver(null)}
        >
          <div 
            className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col justify-between border-l border-zinc-200 animate-slide-left relative z-50 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div>
              <div className="p-6 border-b border-zinc-100 bg-zinc-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="font-bold text-sm tracking-wide uppercase font-sans">Driver Security Audit Log</span>
                </div>
                <button 
                  onClick={() => setSelectedDriver(null)}
                  className="text-zinc-400 hover:text-white font-bold leading-none text-xl p-1 shrink-0 cursor-pointer"
                  title="Close"
                >
                  &times;
                </button>
              </div>

              {/* Profile Card */}
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 border-b border-zinc-100 pb-5">
                  <Avatar
                    photoUrl={selectedDriver.photo_url}
                    name={selectedDriver.name}
                    size={56}
                    className="bg-zinc-50 dark:bg-zinc-900"
                  />
                  <div>
                    <h4 className="text-zinc-900 font-black text-lg leading-tight uppercase font-sans">
                      {selectedDriver.name}
                    </h4>
                    <p className="text-[11px] font-mono text-zinc-400 mt-1 uppercase">
                      UUID: {selectedDriver.uuid}
                    </p>
                  </div>
                </div>

                {/* Audit Contact State */}
                <div className="space-y-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Contact Validation Audit
                  </h5>

                  {/* Phone Details */}
                  <div className="p-3.5 bg-zinc-50 rounded border border-zinc-200">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Phone Number Status</span>
                    
                    {selectedDriver.old_phone ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">Current Registered:</span>
                          <span className="font-bold text-zinc-900 font-mono">{selectedDriver.phone}</span>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-zinc-200 pt-1.5">
                          <span className="text-amber-700 font-medium">Historical Baseline:</span>
                          <span className="line-through text-zinc-500 font-mono bg-zinc-100 rounded px-1.5">{selectedDriver.old_phone}</span>
                        </div>
                        <p className="text-[10px] text-amber-800 leading-none bg-amber-50 p-1.5 rounded mt-1 font-sans">
                          ⚠ পরিবর্তিত নম্বর স্বয়ংক্রিয় পরিবর্তন ট্র্যাকার দ্বারা সেভ করা হয়েছে।
                        </p>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-zinc-800 font-mono">{selectedDriver.phone || '—'}</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 rounded uppercase leading-none">Unchanged</span>
                      </div>
                    )}
                  </div>

                  {/* Email Details */}
                  <div className="p-3.5 bg-zinc-50 rounded border border-zinc-200">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Email Address Status</span>
                    
                    {selectedDriver.old_email ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-medium">Current Registered:</span>
                          <span className="font-bold text-zinc-900 word-break-all max-w-[200px] truncate" title={selectedDriver.email}>
                            {selectedDriver.email}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-zinc-200 pt-1.5">
                          <span className="text-amber-700 font-medium">Historical Baseline:</span>
                          <span className="line-through text-zinc-500 bg-zinc-100 rounded px-1.5 max-w-[200px] truncate" title={selectedDriver.old_email}>
                            {selectedDriver.old_email}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-800 leading-none bg-amber-50 p-1.5 rounded mt-1 font-sans">
                          ⚠ পরিবর্তিত ইমেইল এড্রেস স্বয়ংক্রিয়ভাবে নথিবদ্ধ হয়েছে।
                        </p>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-zinc-800 max-w-[200px] truncate" title={selectedDriver.email}>
                          {selectedDriver.email || '—'}
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 rounded uppercase leading-none">Unchanged</span>
                      </div>
                    )}
                  </div>

                  {/* Trip details stats */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                      <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Trip Volumes</span>
                      <span className="text-lg font-black text-zinc-950 font-mono">{selectedDriver.tip_count}</span>
                    </div>
                    <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                      <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Registered Log</span>
                      <span className="block text-[11px] font-sans font-medium text-zinc-700 truncate" title={formatDate(selectedDriver.first_seen)}>
                        {formatDate(selectedDriver.first_seen)}
                      </span>
                    </div>
                  </div>

                  {/* 🏆 Reward Tracker Section */}
                  <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                      <h6 className="font-bold font-sans text-xs text-zinc-900 flex items-center gap-1.5 uppercase tracking-wide">
                        <span>🏆</span> Reward Tracker
                      </h6>
                      {selectedDriver.reward && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase leading-none ${
                          selectedDriver.reward.completed 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-zinc-200 text-zinc-800'
                        }`}>
                          {selectedDriver.reward.completed ? 'Completed' : 'Active'}
                        </span>
                      )}
                    </div>

                    {!selectedDriver.reward ? (
                      <div className="space-y-3">
                        <p className="text-[11px] text-zinc-500 leading-normal">
                          এই ড্রাইভারের জন্য কোনো রিওয়ার্ড ট্র্যাকিং চালু করা নেই। ট্র্যাকিং শুরু করতে নিচের সাইকেল সাইজ সেট করে স্টার্ট করুন।
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-bold text-zinc-650">Reward Cycle Size:</label>
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              value={rewardCycleInput}
                              onChange={(e) => setRewardCycleInput(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 text-center font-mono font-bold text-zinc-800 bg-white border border-zinc-350 rounded p-1 text-xs outline-none"
                            />
                          </div>
                          
                          <button
                            onClick={async () => {
                              try {
                                await startRewardTracking(selectedDriver.uuid, selectedDriver.tip_count, rewardCycleInput);
                                showToast('success', `✅ Reward tracking started for ${selectedDriver.name}`);
                                setSelectedDriver({
                                  ...selectedDriver,
                                  reward: {
                                    active: true,
                                    start_tip_count: selectedDriver.tip_count,
                                    next_reward_at: selectedDriver.tip_count + rewardCycleInput,
                                    trips_remaining: rewardCycleInput,
                                    reward_cycle_size: rewardCycleInput,
                                    started_at: new Date().toISOString(),
                                    last_calculated_at: new Date().toISOString(),
                                    completed: false
                                  }
                                });
                              } catch (err) {
                                showToast('error', 'হয়নি।');
                              }
                            }}
                            id="drawer-btn-start-reward"
                            className="w-full py-1.5 bg-zinc-950 hover:bg-zinc-850 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1 select-none cursor-pointer"
                          >
                            <span>▶ Start Reward tracking</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3.5 text-xs">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex flex-col">
                            <span className="text-zinc-400 font-medium">Started at:</span>
                            <span className="text-zinc-700 font-bold font-sans">
                              {new Date(selectedDriver.reward.started_at).toLocaleDateString('bn-BD', { dateStyle: 'medium' })}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-zinc-400 font-medium font-sans">Start trip:</span>
                            <span className="text-zinc-700 font-bold font-mono">{selectedDriver.reward.start_tip_count.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col border-t border-zinc-200/60 pt-1.5">
                            <span className="text-zinc-400 font-medium">Next reward at:</span>
                            <span className="text-zinc-750 font-bold font-mono text-emerald-700">{selectedDriver.reward.next_reward_at.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col border-t border-zinc-200/60 pt-1.5">
                            <span className="text-zinc-400 font-medium">Trips remaining:</span>
                            <span className={`font-mono font-black ${selectedDriver.reward.completed ? 'text-emerald-700' : 'text-zinc-900'}`}>
                              {selectedDriver.reward.trips_remaining}
                            </span>
                          </div>
                        </div>

                        {/* Trips Progress Bar and % */}
                        {(() => {
                          const trips_done = Math.max(0, selectedDriver.tip_count - selectedDriver.reward.start_tip_count);
                          const cycle = selectedDriver.reward.reward_cycle_size || 52;
                          const pct = Math.min(Math.max(0, (trips_done / cycle) * 100), 100);
                          return (
                            <div className="space-y-1.5 border-t border-zinc-200/60 pt-3">
                              <div className="flex justify-between items-center text-[10.5px]">
                                <span className="font-semibold text-zinc-600 font-sans">{trips_done} / {cycle} trips done</span>
                                <span className="font-bold text-zinc-900 font-mono">{Math.round(pct)}% complete</span>
                              </div>
                              
                              <div className="w-full bg-zinc-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-500 ${
                                    selectedDriver.reward.completed ? 'bg-emerald-500' : 'bg-zinc-850'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="border-t border-zinc-200/60 pt-3">
                          <button
                            onClick={() => {
                              setResetConfirmationDriver(selectedDriver);
                            }}
                            id="drawer-btn-reset-reward"
                            className="w-full py-1.5 border border-red-200 hover:bg-red-50 text-red-700 font-bold text-xs rounded transition flex items-center justify-center gap-1 select-none cursor-pointer"
                          >
                            <span>🔄 Reset Reward tracking</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingDriver(selectedDriver)}
                  id="btn-sidebar-edit"
                  className="flex-1 py-2 bg-zinc-950 text-white rounded font-bold text-xs hover:bg-zinc-850 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit2 size={12} />
                  <span>Edit Data</span>
                </button>

                <button
                  onClick={() => setDeletingDriver(selectedDriver)}
                  id="btn-sidebar-delete"
                  className="flex-1 py-2 bg-red-800 text-white rounded font-bold text-xs hover:bg-red-700 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>

              {selectedDriver.has_contact_change && (
                <button
                  onClick={async () => {
                    try {
                      await dismissChangeFlag(selectedDriver.uuid);
                      showToast('success', 'তথ্য যাচাই করা সম্পন্ন হয়েছে!');
                      setSelectedDriver(prev => prev ? { ...prev, has_contact_change: false } : null);
                    } catch (_) {
                      showToast('error', 'ব্যর্থ হয়েছে।');
                    }
                  }}
                  id="btn-sidebar-dismiss"
                  className="w-full py-2 bg-emerald-505 hover:bg-emerald-600 bg-emerald-500 text-zinc-950 font-black text-xs rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>Mark Changes as Reviewed</span>
                </button>
              )}

              {selectedDriver.deleted && (
                <button
                  onClick={async () => {
                    try {
                      await restoreDriver(selectedDriver.uuid);
                      showToast('success', 'ড্রাইভার রেকর্ড পুনরুদ্ধার করা হয়েছে!');
                      setSelectedDriver(prev => prev ? { ...prev, deleted: false } : null);
                    } catch (_) {
                      showToast('error', 'পুনরুদ্ধার করতে ব্যর্থ হয়েছে।');
                    }
                  }}
                  id="btn-sidebar-restore"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Restore Deleted Driver</span>
                </button>
              )}

              <button
                onClick={() => {
                  const memo = `Driver State Log: ${selectedDriver.name}\nUUID: ${selectedDriver.uuid}\nPhone: ${selectedDriver.phone} (Old: ${selectedDriver.old_phone || 'None'})\nEmail: ${selectedDriver.email} (Old: ${selectedDriver.old_email || 'None'})\nTrips: ${selectedDriver.tip_count}`;
                  navigator.clipboard.writeText(memo);
                  showToast('success', 'মেমো ক্লিপবোর্ডে কপি করা হয়েছে!');
                }}
                id="btn-copy-memo"
                className="w-full py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-850 font-bold text-xs rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Copy Summary Memo</span>
              </button>
              <button
                onClick={() => setSelectedDriver(null)}
                id="btn-close-inspect"
                className="py-2 px-4 bg-zinc-300 hover:bg-zinc-400 text-zinc-800 font-bold text-xs rounded transition select-none cursor-pointer text-center"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. EDIT DRIVER MODAL */}
      {editingDriver && (
        <div 
          id="driver-edit-modal"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setEditingDriver(null)}
        >
          <div 
            className="bg-white rounded-lg border border-zinc-200 shadow-2xl max-w-md w-full p-6 animate-scale-up space-y-4 m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="font-sans font-bold text-base text-zinc-900 flex items-center gap-2">
                <Edit2 size={16} className="text-emerald-500" />
                <span>Edit Driver Details</span>
              </h3>
              <button 
                onClick={() => setEditingDriver(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold text-lg leading-none cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-zinc-800 font-semibold text-xs mb-1">Name</label>
                <input
                  type="text"
                  value={editingDriver.name}
                  onChange={(e) => setEditingDriver({ ...editingDriver, name: e.target.value })}
                  className="w-full text-zinc-805 bg-white border border-zinc-300 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-800 font-semibold text-xs mb-1">Phone</label>
                <input
                  type="text"
                  value={editingDriver.phone}
                  onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                  className="w-full text-zinc-805 bg-white border border-zinc-300 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-800 font-semibold text-xs mb-1">Email</label>
                <input
                  type="text"
                  value={editingDriver.email}
                  onChange={(e) => setEditingDriver({ ...editingDriver, email: e.target.value })}
                  className="w-full text-zinc-805 bg-white border border-zinc-300 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 text-amber-900 rounded border border-amber-200 text-[11px] leading-relaxed flex items-start gap-1.5">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>Changing email or phone will automatically save the old values and trigger the contact changed tracking flag.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setEditingDriver(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded cursor-pointer transition select-none"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editingDriver.name.trim() || !editingDriver.phone.trim() || !editingDriver.email.trim()) {
                    showToast('error', 'সবগুলো বিবরণ অবশ্যই পূরণ করুন!');
                    return;
                  }
                  try {
                    await editDriver(editingDriver.uuid, {
                      name: editingDriver.name.trim(),
                      email: editingDriver.email.trim(),
                      phone: editingDriver.phone.trim()
                    });
                    showToast('success', `${editingDriver.name} এর বিবরণ আপডেট করা হয়েছে!`);
                    setEditingDriver(null);
                    // Update main panel inspect state if active
                    if (selectedDriver && selectedDriver.uuid === editingDriver.uuid) {
                      setSelectedDriver(prev => prev ? { 
                        ...prev, 
                        name: editingDriver.name.trim(),
                        email: editingDriver.email.trim(),
                        phone: editingDriver.phone.trim()
                      } : null);
                    }
                  } catch (e) {
                    showToast('error', 'আপডেট করতে ব্যর্থ হয়েছে।');
                  }
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded cursor-pointer transition select-none"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DELETE CONFIRMATION MODAL */}
      {deletingDriver && (
        <div 
          id="driver-delete-modal"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setDeletingDriver(null)}
        >
          <div 
            className="bg-white rounded-lg border border-zinc-200 shadow-2xl max-w-sm w-full p-6 animate-scale-up space-y-4 m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-650 border-b border-zinc-100 pb-3">
              <Trash2 size={18} className="text-red-500" />
              <h3 className="font-sans font-bold text-base text-zinc-900">Delete Driver?</h3>
            </div>

            <div className="text-xs sm:text-sm text-zinc-600 space-y-2">
              <p>
                আপনি কি নিশ্চিতভাবেই <strong className="text-zinc-900">{deletingDriver.name}</strong> কে ডাটাবেস থেকে মুছে ফেলতে চান?
              </p>
              <p className="text-xs text-zinc-400 leading-normal">
                এটি অস্থায়ীভাবে ডাটাবেস থেকে ড্রাইভারকে সরিয়ে ফেলবে। Uber এর supplier পোর্টালের তথ্যে কোনো প্রভাব পরবে না।
              </p>
              
              <div className="mt-4 p-2 bg-red-50 text-red-950 font-bold border border-red-200 rounded text-xs">
                অপশন নির্বাচন করুন:
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1 lg:mt-3">
              <button
                onClick={async () => {
                  try {
                    await deleteDriver(deletingDriver.uuid, false); // soft delete
                    showToast('success', `${deletingDriver.name} কে soft-delete করা হয়েছে। [Show Deleted List] টি টিক দিয়ে দেখতে পারেন।`);
                    setDeletingDriver(null);
                    if (selectedDriver && selectedDriver.uuid === deletingDriver.uuid) {
                      setSelectedDriver(null);
                    }
                  } catch (_) {
                    showToast('error', 'মুছে ফেলতে ব্যর্থ হয়েছে।');
                  }
                }}
                className="py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded cursor-pointer transition select-none text-center"
              >
                Hide & Soft Delete (Recommended)
              </button>
              
              <button
                onClick={async () => {
                  try {
                    await deleteDriver(deletingDriver.uuid, true); // hard delete
                    showToast('success', `${deletingDriver.name} চিরতরে ডাটাবেস থেকে মুছে ফেলা হয়েছে।`);
                    setDeletingDriver(null);
                    if (selectedDriver && selectedDriver.uuid === deletingDriver.uuid) {
                      setSelectedDriver(null);
                    }
                  } catch (_) {
                    showToast('error', 'চিরতরে মুছতে ব্যর্থ হয়েছে।');
                  }
                }}
                className="py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded cursor-pointer transition select-none text-center"
              >
                Permanently Hard Delete from Database
              </button>

              <button
                onClick={() => setDeletingDriver(null)}
                className="py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded cursor-pointer transition select-none text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward Tracking Confirmation Modal */}
      {rewardTrackingDriver && (
        <div 
          id="reward-tracking-start-modal"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setRewardTrackingDriver(null)}
        >
          <div 
            className="bg-white rounded-lg border border-zinc-200 shadow-2xl max-w-sm w-full p-6 animate-scale-up space-y-4 m-4 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <span className="text-3xl block mb-2">🏆</span>
              <h3 className="font-bold text-zinc-900 text-base">Start Reward Tracking</h3>
              <p className="text-xs text-zinc-500 mt-1">{rewardTrackingDriver.name}</p>
            </div>
            
            <p className="text-xs text-zinc-650 leading-relaxed text-center">
              এই ড্রাইভারের পরবর্তী পুরস্কার অর্জনের ট্র্যাকিং শুরু হবে। প্রতি সাইকেলে ডিফল্ট ৫২টি ট্রিপের লক্ষ্যমাত্রা থাকে, তবে আপনি চাইলে এটি পরিবর্তন করতে পারেন:
            </p>

            <div className="flex items-center justify-center gap-3">
              <label className="text-xs font-bold text-zinc-700">Cycle Size:</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={rewardCycleInput}
                onChange={(e) => setRewardCycleInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 text-center font-mono font-bold text-zinc-900 bg-zinc-50 border border-zinc-350 rounded p-1.5 text-xs focus:ring-1 focus:ring-black outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setRewardTrackingDriver(null)}
                className="flex-1 py-2 bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs font-bold rounded hover:bg-zinc-100 transition cursor-pointer text-center"
              >
                Cancel
              </button>
              
              <button
                onClick={async () => {
                  try {
                    await startRewardTracking(rewardTrackingDriver.uuid, rewardTrackingDriver.tip_count, rewardCycleInput);
                    showToast('success', `✅ Reward tracking started for ${rewardTrackingDriver.name}`);
                    setRewardTrackingDriver(null);
                  } catch (_) {
                    showToast('error', 'হয়নি।');
                  }
                }}
                className="flex-1 py-2 bg-black hover:bg-zinc-800 text-white text-xs font-bold rounded transition cursor-pointer text-center font-sans"
              >
                ▶ Start tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Reward Confirmation Dialog */}
      {resetConfirmationDriver && (
        <div 
          id="reward-tracking-reset-modal"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setResetConfirmationDriver(null)}
        >
          <div 
            className="bg-white rounded-lg border border-zinc-200 shadow-2xl max-w-sm w-full p-6 animate-scale-up space-y-4 m-4 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <span className="text-3xl block mb-2">🔄</span>
              <h3 className="font-bold text-zinc-900 text-base">Reset Reward Tracking?</h3>
              <p className="text-xs text-zinc-500 mt-1">{resetConfirmationDriver.name}</p>
            </div>

            <div className="p-3 bg-zinc-50 text-[11px] text-zinc-650 rounded border border-zinc-150 leading-relaxed space-y-1">
              <p className="font-semibold text-red-700">Current progress will be lost.</p>
              {resetConfirmationDriver.reward && (
                <div className="font-mono mt-1 text-[10px] space-y-0.5 text-zinc-500">
                  <div>Start trip count: {resetConfirmationDriver.reward.start_tip_count}</div>
                  <div>Goal trip count: {resetConfirmationDriver.reward.next_reward_at}</div>
                  <div>Cycle size: {resetConfirmationDriver.reward.reward_cycle_size} trips</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setResetConfirmationDriver(null)}
                className="flex-1 py-2 bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs font-bold rounded hover:bg-zinc-100 transition cursor-pointer text-center"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  try {
                    await resetReward(resetConfirmationDriver.uuid);
                    showToast('success', `🔄 Reward reset for ${resetConfirmationDriver.name}`);
                    if (selectedDriver && selectedDriver.uuid === resetConfirmationDriver.uuid) {
                      setSelectedDriver(prev => prev ? { ...prev, reward: undefined } : null);
                    }
                    setResetConfirmationDriver(null);
                  } catch (_) {
                    showToast('error', 'হয়নি।');
                  }
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition cursor-pointer text-center"
              >
                🔄 Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Toast Alert Banner */}
      {toast && (
        <div 
          id="system-toast-alert"
          className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 border animate-slide-up-fade text-white ${
            toast.type === 'success' 
              ? 'bg-zinc-900 border-zinc-800 text-emerald-400 font-bold' 
              : toast.type === 'error' 
              ? 'bg-red-950 border-red-900 text-red-300' 
              : 'bg-zinc-950 border-zinc-800 text-zinc-100'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
