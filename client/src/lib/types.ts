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
  status: 'confirmed' | 'pending_swap' | 'swapped';
}

export interface SwapRequest {
  id: number;
  requestorId: number;
  recipientId: number;
  shiftId: number;
  status: 'pending' | 'accepted' | 'rejected';
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
  createdAt: string;
}
