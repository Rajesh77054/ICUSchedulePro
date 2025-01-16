export interface Provider {
  id: number;
  name: string;
  title: string;
  targetDays: number;
  tolerance?: number;
  maxConsecutiveWeeks: number;
  color: string;
}

export interface Shift {
  id: number;
  providerId: number;
  startDate: string;
  endDate: string;
  status: 'confirmed' | 'pending_swap' | 'swapped' | 'archived';
  satisfactionScore?: number;
  schedulingNotes?: any;
  source?: 'manual';
  // Keep external_id in type but don't use it
  externalId?: string;
}

export interface SwapRequest {
  id: number;
  requestorId: number;
  recipientId: number;
  shiftId: number;
  status: 'pending' | 'accepted' | 'rejected';
  reason?: string;
  createdAt: string;
}

export interface Holiday {
  id: number;
  name: string;
  date: string;
  providerId: number;
}

export interface TimeOffRequest {
  id: number;
  providerId: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: string;
}

export interface ProviderPreferences {
  id: number;
  providerId: number;
  defaultView: string;
  defaultCalendarDuration: string;
  notificationPreferences: {
    emailNotifications: boolean;
    inAppNotifications: boolean;
    notifyOnNewShifts: boolean;
    notifyOnSwapRequests: boolean;
    notifyOnTimeOffUpdates: boolean;
    notifyBeforeShift: number;
  };
  preferredShiftLength: number;
  maxShiftsPerWeek?: number;
  minDaysBetweenShifts?: number;
  preferredDaysOfWeek: number[];
  avoidedDaysOfWeek: number[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  primaryEmail: string;
  secondaryEmail?: string;
  role: 'admin' | 'scheduler' | 'physician' | 'app';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  provider?: Provider;
}