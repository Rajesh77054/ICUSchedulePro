import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Shift } from "./types"
import { PROVIDERS } from "./constants"
import { isWithinInterval, addDays } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function detectShiftConflicts(shift: Shift, allShifts: Shift[]): {
  type: 'overlap' | 'consecutive' | 'maxDays';
  message: string;
  conflictingShift?: Shift;
}[] {
  const conflicts: {
    type: 'overlap' | 'consecutive' | 'maxDays';
    message: string;
    conflictingShift?: Shift;
  }[] = [];

  const shiftStart = new Date(shift.startDate);
  const shiftEnd = new Date(shift.endDate);
  const provider = PROVIDERS.find(p => p.id === shift.providerId);

  if (!provider) return conflicts;

  // Check for overlapping shifts
  allShifts.forEach(existingShift => {
    if (existingShift.id === shift.id) return;

    const existingStart = new Date(existingShift.startDate);
    const existingEnd = new Date(existingShift.endDate);

    if (
      isWithinInterval(shiftStart, { start: existingStart, end: existingEnd }) ||
      isWithinInterval(shiftEnd, { start: existingStart, end: existingEnd }) ||
      isWithinInterval(existingStart, { start: shiftStart, end: shiftEnd })
    ) {
      conflicts.push({
        type: 'overlap',
        message: `Shift overlaps with another shift`,
        conflictingShift: existingShift,
      });
    }
  });

  // Check for consecutive weeks
  if (provider.maxConsecutiveWeeks) {
    const consecutiveShifts = allShifts.filter(s => 
      s.providerId === shift.providerId &&
      Math.abs(new Date(s.endDate).getTime() - shiftStart.getTime()) <= (24 * 60 * 60 * 1000)
    );

    if (consecutiveShifts.length >= provider.maxConsecutiveWeeks) {
      conflicts.push({
        type: 'consecutive',
        message: `Exceeds maximum ${provider.maxConsecutiveWeeks} consecutive weeks`,
      });
    }
  }

  // Check for total days against target
  const providerShifts = allShifts.filter(s => s.providerId === shift.providerId);
  const totalDays = providerShifts.reduce((acc, s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);

  if (totalDays > provider.targetDays + (provider.tolerance || 0)) {
    conflicts.push({
      type: 'maxDays',
      message: `Exceeds target days (${provider.targetDays})`,
    });
  }

  return conflicts;
}