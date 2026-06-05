export interface RewardState {
  active: boolean;
  start_tip_count: number;
  next_reward_at: number;
  trips_remaining: number;
  reward_cycle_size: number;
  started_at: string;
  last_calculated_at: string;
  completed: boolean;
  f10_done?: boolean;
  f50_done?: boolean;
}

export interface Driver {
  uuid: string;
  name: string;
  photo_url: string;
  tip_count: number;
  email: string;
  old_email?: string;
  phone: string;
  old_phone?: string;
  has_contact_change: boolean;
  first_seen: string;
  last_updated: string;
  deleted?: boolean;
  deleted_at?: string;
  edited_manually?: boolean;
  change_reviewed_at?: string;
  reward?: RewardState;
  source?: string;
}

export type ActiveTab = 'dashboard' | 'import' | 'sandbox' | 'connection' | 'settings';

export interface GlobalSettings {
  default_reward_cycle: number;
}

export interface NotificationSettings {
  reward_alert: boolean;
  reward_thresholds: number[];
  sync_reminder: boolean;
  sync_reminder_hours: number;
}
