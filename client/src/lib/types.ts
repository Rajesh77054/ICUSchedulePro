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
  requestor: {
    name: string;
    title: string;
    color: string;
  };
  recipient: {
    name: string;
    title: string;
    color: string;
  };
  shift: {
    startDate: string;
    endDate: string;
    status: 'confirmed' | 'pending_swap' | 'swapped' | 'archived';
  };
}

export interface Holiday {
  name: string;
  date: string;
}

export interface TimeOffRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
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
  maxShiftsPerWeek: number;
  minDaysBetweenShifts: number;
  preferredDaysOfWeek: number[];
  avoidedDaysOfWeek: number[];
  createdAt?: string;
  updatedAt?: string;
}