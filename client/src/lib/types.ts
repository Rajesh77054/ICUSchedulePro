export interface User {
  id: number;
  name: string;
  title: string;
  userType: 'physician' | 'app';
  targetDays: number;
  tolerance?: number;
  maxConsecutiveWeeks: number;
  color: string;
}

export interface Shift {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: 'confirmed' | 'pending_swap' | 'swapped' | 'archived';
  satisfactionScore?: number;
  schedulingNotes?: any;
  source?: 'manual';
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
  userId: number;
}

export interface TimeOffRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface UserPreferences {
  id: number;
  userId: number;
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
  preferredDaysOfWeek: number[];
  preferredCoworkers: number[];
  avoidedDaysOfWeek: number[];
  maxShiftsPerWeek?: number;
  minDaysBetweenShifts?: number;
  createdAt: string;
  updatedAt: string;
}