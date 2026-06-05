import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, setDoc, getDocs, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Driver } from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Detect if we are in fallback sandbox mode
export const isSimulated = firebaseConfig.apiKey.includes('DummyKey');

let app: any = null;
export let db: any = null;
export let auth: any = null;

if (!isSimulated) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } catch (err) {
    console.warn('Failed to initialize real Firebase, falling back to simulator', err);
  }
}

// Custom Error Handler for Firestore standard operations as required by firebase-integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Info: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getCurrentUid(): string {
  if (isSimulated) {
    const data = localStorage.getItem('uber_mock_auth');
    if (data) {
      try {
        return JSON.parse(data).uid || 'default';
      } catch (_) {}
    }
    return 'default';
  }
  return auth?.currentUser?.uid || 'default';
}

// ── LOCAL STORAGE FALLBACK ENGINE (For seamless live operation out-of-the-box!) ──

const LOCAL_STORAGE_KEY = 'uber_driver_data_db';

function getLocalDrivers(): Record<string, Driver> {
  const uid = getCurrentUid();
  const data = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${uid}`);
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

function saveLocalDrivers(drivers: Record<string, Driver>) {
  const uid = getCurrentUid();
  localStorage.setItem(`${LOCAL_STORAGE_KEY}_${uid}`, JSON.stringify(drivers));
}

// ── CORE SYNCHRONIZER AND PERSISTENCE METHODS ──

/**
 * Syncs a batch of driver profiles, comparing with existing database entries
 * to automatically detect contact info (email/phone) change history.
 */
export async function syncDrivers(
  batch: Omit<Driver, 'first_seen' | 'last_updated' | 'has_contact_change'>[]
): Promise<{ 
  added: number; 
  updated: number; 
  changedContacts: number;
  rewardCompletedNames: string[];
  rewardMilestoneToasts: { name: string; remaining: number }[];
}> {
  const nowStr = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let changedContacts = 0;
  const rewardCompletedNames: string[] = [];
  const rewardMilestoneToasts: { name: string; remaining: number }[] = [];

  // Retrieve existing entries
  let existingDrivers: Record<string, Driver> = {};

  if (!isSimulated && db) {
    try {
      const qSnap = await getDocs(collection(db, 'users', getCurrentUid(), 'drivers'));
      qSnap.forEach(docSnap => {
        existingDrivers[docSnap.id] = docSnap.data() as Driver;
      });
    } catch (err) {
      console.warn('Real Firestore getDocs failed, fallback to local storage', err);
      existingDrivers = getLocalDrivers();
    }
  } else {
    existingDrivers = getLocalDrivers();
  }

  const updatedDriversLocal = { ...existingDrivers };

  for (const newDrv of batch) {
    const existing = existingDrivers[newDrv.uuid];
    let finalDriver: Driver;

    if (!existing) {
      // 1. New Driver Registration
      finalDriver = {
        ...newDrv,
        has_contact_change: false,
        first_seen: nowStr,
        last_updated: nowStr
      };
      added++;
    } else {
      // 2. Existing Driver State Sync with change tracking
      let hasChange = existing.has_contact_change;
      const updates: Partial<Driver> = {};

      // Check Email Change
      if (existing.email && newDrv.email !== existing.email) {
        updates.old_email = existing.email;
        updates.email = newDrv.email;
        hasChange = true;
        changedContacts++;
      } else {
        // preserve existing changed fields if already recorded
        if (existing.old_email) {
          updates.old_email = existing.old_email;
        }
      }

      // Check Phone Change
      if (existing.phone && newDrv.phone !== existing.phone) {
        updates.old_phone = existing.phone;
        updates.phone = newDrv.phone;
        hasChange = true;
        changedContacts++;
      } else {
        // preserve existing changed fields if already recorded
        if (existing.old_phone) {
          updates.old_phone = existing.old_phone;
        }
      }

      // Check Reward Tracking updates
      if (existing.reward && existing.reward.active) {
        const remaining = existing.reward.next_reward_at - newDrv.tip_count;
        const completed = remaining <= 0;
        
        const updatedReward = {
          ...existing.reward,
          trips_remaining: completed ? 0 : remaining,
          completed,
          last_calculated_at: nowStr
        };

        if (completed && !existing.reward.completed) {
          rewardCompletedNames.push(existing.name);
        } else if (!completed && remaining <= 5 && remaining < existing.reward.trips_remaining) {
          rewardMilestoneToasts.push({ name: existing.name, remaining });
        }

        updates.reward = updatedReward;
      }

      finalDriver = {
        ...existing,
        ...newDrv, // updates name, photo_url, tip_count, current email/phone
        ...updates,
        has_contact_change: hasChange,
        last_updated: nowStr
      };
      updated++;
    }

    updatedDriversLocal[newDrv.uuid] = finalDriver;

    // Save to real firestore if active
    if (!isSimulated && db && auth?.currentUser) {
      try {
        const path = `users/${getCurrentUid()}/drivers/${newDrv.uuid}`;
        await setDoc(doc(db, 'users', getCurrentUid(), 'drivers', newDrv.uuid), finalDriver);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${newDrv.uuid}`);
      }
    }
  }

  // Save to localStorage so state remains interactive
  saveLocalDrivers(updatedDriversLocal);

  // Track sync time
  await saveLastSyncTime();

  // Trigger dispatch Event to make UI fully real-time responsive
  window.dispatchEvent(new Event('driver_db_updated'));

  if (rewardCompletedNames.length > 0 || rewardMilestoneToasts.length > 0) {
    window.dispatchEvent(new CustomEvent('reward_sync_completed', {
      detail: { completed: rewardCompletedNames, milestones: rewardMilestoneToasts }
    }));
  }

  return { added, updated, changedContacts, rewardCompletedNames, rewardMilestoneToasts };
}

/**
 * Returns list of drivers or attaches real-time snapshot listener.
 */
export function listenToDrivers(callback: (drivers: Driver[]) => void) {
  // Try real-time Firestore if active and signed in
  if (!isSimulated && db && auth?.currentUser) {
    const path = `users/${getCurrentUid()}/drivers`;
    try {
      const unsub = onSnapshot(collection(db, 'users', getCurrentUid(), 'drivers'), (qSnap) => {
        const list: Driver[] = [];
        qSnap.forEach(docSnap => {
          list.push(docSnap.data() as Driver);
        });
        callback(list);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      });
      return unsub;
    } catch (_) {
      // fallback
    }
  }

  // Offline-first Local Callback with trigger listener
  const emitLocal = () => {
    const dict = getLocalDrivers();
    callback(Object.values(dict));
  };

  emitLocal();
  window.addEventListener('driver_db_updated', emitLocal);
  return () => {
    window.removeEventListener('driver_db_updated', emitLocal);
  };
}

/**
 * Google Sign-In helper.
 */
export async function logInWithGoogle() {
  if (isSimulated || !auth) {
    // Mock successful signup/login
    const mockUser = {
      uid: 'mock-user-123',
      displayName: 'Supplier Manager',
      email: 'manager@supplier.uber.com',
      photoURL: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Manager',
      emailVerified: true
    };
    localStorage.setItem('uber_mock_auth', JSON.stringify(mockUser));
    window.dispatchEvent(new Event('auth_state_changed'));
    return mockUser;
  }

  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error('Sign-in failed: ', err);
    throw err;
  }
}

/**
 * Logs out.
 */
export function logOutUser() {
  if (isSimulated || !auth) {
    localStorage.removeItem('uber_mock_auth');
    window.dispatchEvent(new Event('auth_state_changed'));
    return;
  }
  auth.signOut();
}

/**
 * Custom auth state listener.
 */
export function listenToAuth(callback: (user: any) => void) {
  if (isSimulated || !auth) {
    const checkMockAuth = () => {
      const data = localStorage.getItem('uber_mock_auth');
      callback(data ? JSON.parse(data) : null);
    };
    checkMockAuth();
    window.addEventListener('auth_state_changed', checkMockAuth);
    return () => window.removeEventListener('auth_state_changed', checkMockAuth);
  }

  return auth.onAuthStateChanged((user: any) => {
    callback(user);
  });
}

/**
 * Deletes all drivers in database or resets to default state.
 */
export async function resetDatabase() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  window.dispatchEvent(new Event('driver_db_updated'));
}

/**
 * Manually edit driver details (name, email, phone)
 * and preserve historical change tracking.
 */
export async function editDriver(
  uuid: string,
  newValues: { name: string; email: string; phone: string }
): Promise<void> {
  const nowStr = new Date().toISOString();
  let existingDrivers: Record<string, Driver> = {};

  if (!isSimulated && db && auth?.currentUser) {
    try {
      const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existing = docSnap.data() as Driver;
        const updates: Partial<Driver> = {
          name: newValues.name,
          last_updated: nowStr,
          edited_manually: true
        };

        if (newValues.email !== existing.email) {
          updates.old_email = existing.email;
          updates.email = newValues.email;
          updates.has_contact_change = true;
        }

        if (newValues.phone !== existing.phone) {
          updates.old_phone = existing.phone;
          updates.phone = newValues.phone;
          updates.has_contact_change = true;
        }

        await setDoc(docRef, { ...existing, ...updates }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
    }
  }

  // Always update search index/localstorage fallback
  existingDrivers = getLocalDrivers();
  const existing = existingDrivers[uuid];
  if (existing) {
    const updates: Partial<Driver> = {
      name: newValues.name,
      last_updated: nowStr,
      edited_manually: true
    };

    if (newValues.email !== existing.email) {
      updates.old_email = existing.email;
      updates.email = newValues.email;
      updates.has_contact_change = true;
    }

    if (newValues.phone !== existing.phone) {
      updates.old_phone = existing.phone;
      updates.phone = newValues.phone;
      updates.has_contact_change = true;
    }

    existingDrivers[uuid] = {
      ...existing,
      ...updates
    };
    saveLocalDrivers(existingDrivers);
    window.dispatchEvent(new Event('driver_db_updated'));
  }
}

/**
 * Deletes a driver from the console (supports both soft delete and hard delete optionally).
 */
export async function deleteDriver(uuid: string, hardDelete: boolean = false): Promise<void> {
  let existingDrivers: Record<string, Driver> = {};

  if (!isSimulated && db && auth?.currentUser) {
    try {
      const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
      if (hardDelete) {
        await deleteDoc(docRef);
      } else {
        // Soft delete
        await setDoc(docRef, {
          deleted: true,
          deleted_at: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUid()}/drivers/${uuid}`);
    }
  }

  // Always update localstorage fallback
  existingDrivers = getLocalDrivers();
  const existing = existingDrivers[uuid];
  if (existing) {
    if (hardDelete) {
      delete existingDrivers[uuid];
    } else {
      existingDrivers[uuid] = {
        ...existing,
        deleted: true,
        deleted_at: new Date().toISOString()
      };
    }
    saveLocalDrivers(existingDrivers);
    window.dispatchEvent(new Event('driver_db_updated'));
  }
}

/**
 * Restores a soft-deleted driver record.
 */
export async function restoreDriver(uuid: string): Promise<void> {
  let existingDrivers: Record<string, Driver> = {};

  if (!isSimulated && db && auth?.currentUser) {
    try {
      const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existing = docSnap.data() as Driver;
        const updated = { ...existing };
        delete updated.deleted;
        delete updated.deleted_at;
        await setDoc(docRef, updated);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
    }
  }

  existingDrivers = getLocalDrivers();
  const existing = existingDrivers[uuid];
  if (existing) {
    const updated = { ...existing };
    delete updated.deleted;
    delete updated.deleted_at;
    existingDrivers[uuid] = updated;
    saveLocalDrivers(existingDrivers);
    window.dispatchEvent(new Event('driver_db_updated'));
  }
}

/**
 * Dismisses the contact change alert flag, setting it as reviewed.
 * Keeps old_phone and old_email history.
 */
export async function dismissChangeFlag(uuid: string): Promise<void> {
  const nowStr = new Date().toISOString();
  let existingDrivers: Record<string, Driver> = {};

  if (!isSimulated && db && auth?.currentUser) {
    try {
      const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
      await setDoc(docRef, {
        has_contact_change: false,
        change_reviewed_at: nowStr
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
    }
  }

  // Always update localstorage fallback
  existingDrivers = getLocalDrivers();
  const existing = existingDrivers[uuid];
  if (existing) {
    existingDrivers[uuid] = {
      ...existing,
      has_contact_change: false,
      change_reviewed_at: nowStr
    };
    saveLocalDrivers(existingDrivers);
    window.dispatchEvent(new Event('driver_db_updated'));
  }
}

/**
 * Starts reward tracking for a driver with specified cycle size.
 */
export async function startRewardTracking(
  uuid: string,
  currentTipCount: number,
  rewardCycleSize: number = 52
): Promise<void> {
  const nowStr = new Date().toISOString();
  const rewardState = {
    active: true,
    start_tip_count: currentTipCount,
    next_reward_at: currentTipCount + rewardCycleSize,
    trips_remaining: rewardCycleSize,
    reward_cycle_size: rewardCycleSize,
    started_at: nowStr,
    last_calculated_at: nowStr,
    completed: false
  };

  let existingDrivers = getLocalDrivers();
  const existing = existingDrivers[uuid];
  if (existing) {
    existing.reward = rewardState;
    existingDrivers[uuid] = existing;
    saveLocalDrivers(existingDrivers);
  }

  if (!isSimulated && db && auth?.currentUser) {
    try {
      const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
      await setDoc(docRef, { reward: rewardState }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
    }
  }

  window.dispatchEvent(new Event('driver_db_updated'));
}

/**
 * Resets reward tracking for a driver, clearing the tracking details.
 */
export async function resetReward(uuid: string): Promise<void> {
  let existingDrivers = getLocalDrivers();
  const existing = existingDrivers[uuid];
  if (existing) {
    delete existing.reward;
    existingDrivers[uuid] = existing;
    saveLocalDrivers(existingDrivers);
  }

  if (!isSimulated && db && auth?.currentUser) {
    try {
      const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
      await setDoc(docRef, { reward: null }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
    }
  }

  window.dispatchEvent(new Event('driver_db_updated'));
}

// ── NEW GLOBAL SETTINGS, NOTIFICATIONS & BULK OPERATIONS HELPERS ──

import { GlobalSettings, NotificationSettings } from './types';

const SETTINGS_KEY = 'uber_global_settings';
const NOTIF_PREFS_KEY_PREFIX = 'uber_notif_prefs_';
const LAST_SYNC_KEY = 'last_synced_at';

export function getGlobalSettings(): GlobalSettings {
  const d = localStorage.getItem(SETTINGS_KEY);
  if (d) {
    try { return JSON.parse(d); } catch (_) {}
  }
  return { default_reward_cycle: 52 };
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (!isSimulated && db && auth?.currentUser) {
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  }
  // Make sure we also dispatch database update event for components listening
  window.dispatchEvent(new Event('driver_db_updated'));
  window.dispatchEvent(new Event('settings_updated'));
}

export function getNotificationSettings(uid: string = 'default'): NotificationSettings {
  const d = localStorage.getItem(NOTIF_PREFS_KEY_PREFIX + uid);
  if (d) {
    try { return JSON.parse(d); } catch (_) {}
  }
  return {
    reward_alert: true,
    reward_thresholds: [5, 3, 1],
    sync_reminder: true,
    sync_reminder_hours: 72
  };
}

export async function saveNotificationSettings(uid: string = 'default', prefs: NotificationSettings): Promise<void> {
  localStorage.setItem(NOTIF_PREFS_KEY_PREFIX + uid, JSON.stringify(prefs));
  if (!isSimulated && db && auth?.currentUser) {
    try {
      await setDoc(doc(db, 'users', uid), { notification_prefs: prefs }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  }
  window.dispatchEvent(new Event('driver_db_updated'));
  window.dispatchEvent(new Event('notif_settings_updated'));
}

export async function saveLastSyncTime(): Promise<void> {
  const now = new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, now);
  if (!isSimulated && db && auth?.currentUser) {
    try {
      await setDoc(doc(db, 'meta', 'sync'), { last_synced_at: now });
    } catch (err) {
      // ignore non-critical metadata write failures
    }
  }
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

// ── BULK OPERATIONS ──

export async function bulkDeleteDrivers(uuids: string[], hardDelete: boolean = false): Promise<void> {
  const existingDrivers = getLocalDrivers();
  const nowStr = new Date().toISOString();
  
  for (const uuid of uuids) {
    const existing = existingDrivers[uuid];
    if (existing) {
      if (hardDelete) {
        delete existingDrivers[uuid];
      } else {
        existingDrivers[uuid] = {
          ...existing,
          deleted: true,
          deleted_at: nowStr
        };
      }
      
      if (!isSimulated && db && auth?.currentUser) {
        try {
          const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
          if (hardDelete) {
            await deleteDoc(docRef);
          } else {
            await setDoc(docRef, { deleted: true, deleted_at: nowStr }, { merge: true });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${getCurrentUid()}/drivers/${uuid}`);
        }
      }
    }
  }
  
  saveLocalDrivers(existingDrivers);
  window.dispatchEvent(new Event('driver_db_updated'));
}

export async function bulkStartRewardTracking(uuids: string[], customCycle: number | null = null): Promise<void> {
  const nowStr = new Date().toISOString();
  let defaultCycle = getGlobalSettings().default_reward_cycle || 52;
  const cycleSize = customCycle || defaultCycle;
  const existingDrivers = getLocalDrivers();

  for (const uuid of uuids) {
    const existing = existingDrivers[uuid];
    if (existing) {
      const rewardState = {
        active: true,
        start_tip_count: existing.tip_count,
        next_reward_at: existing.tip_count + cycleSize,
        trips_remaining: cycleSize,
        reward_cycle_size: cycleSize,
        started_at: nowStr,
        last_calculated_at: nowStr,
        completed: false
      };

      existing.reward = rewardState;
      existingDrivers[uuid] = existing;

      if (!isSimulated && db && auth?.currentUser) {
        try {
          const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
          await setDoc(docRef, { reward: rewardState }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
        }
      }
    }
  }

  saveLocalDrivers(existingDrivers);
  window.dispatchEvent(new Event('driver_db_updated'));
}

export async function bulkResetReward(uuids: string[]): Promise<void> {
  const existingDrivers = getLocalDrivers();

  for (const uuid of uuids) {
    const existing = existingDrivers[uuid];
    if (existing) {
      delete existing.reward;
      existingDrivers[uuid] = existing;

      if (!isSimulated && db && auth?.currentUser) {
        try {
          const docRef = doc(db, 'users', getCurrentUid(), 'drivers', uuid);
          await setDoc(docRef, { reward: null }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${getCurrentUid()}/drivers/${uuid}`);
        }
      }
    }
  }

  saveLocalDrivers(existingDrivers);
  window.dispatchEvent(new Event('driver_db_updated'));
}

// ── UBER AUTO SYNC CREDENTIALS STORAGE HELPERS ──
const CREDENTIALS_KEY_PREFIX = 'uber_supplier_creds_';

export function getUberCredentials(uid: string = 'default'): { email: string; org_id: string; encrypted_password?: string } {
  const d = localStorage.getItem(CREDENTIALS_KEY_PREFIX + uid);
  if (d) {
    try { return JSON.parse(d); } catch (_) {}
  }
  return { email: '', org_id: '', encrypted_password: '' };
}

export async function saveUberCredentials(
  uid: string = 'default',
  creds: { email: string; org_id: string; encrypted_password?: string }
): Promise<void> {
  localStorage.setItem(CREDENTIALS_KEY_PREFIX + uid, JSON.stringify(creds));
  if (!isSimulated && db && auth?.currentUser) {
    try {
      await setDoc(doc(db, 'users', uid), { uber_credentials: creds }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  }
  window.dispatchEvent(new Event('notif_settings_updated'));
}

/**
 * Dismiss a reward milestone (F10 or F50)
 */
export async function dismissRewardMilestone(uuid: string, milestone: 'f10' | 'f50') {
  const dict = getLocalDrivers();
  const drv = dict[uuid];
  if (!drv || !drv.reward) return;
  
  const updatedReward = { ...drv.reward };
  if (milestone === 'f10') updatedReward.f10_done = true;
  if (milestone === 'f50') updatedReward.f50_done = true;
  
  drv.reward = updatedReward;
  dict[uuid] = drv;
  saveLocalDrivers(dict);
  
  if (!isSimulated && db && auth?.currentUser) {
    try {
      await updateDoc(doc(db, 'users', getCurrentUid(), 'drivers', uuid), {
        [`reward.${milestone}_done`]: true
      });
    } catch (e) {
      console.error('Error dismissing milestone:', e);
    }
  }
  window.dispatchEvent(new Event('driver_db_updated'));
}
