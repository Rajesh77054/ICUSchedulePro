import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Shift } from "./types"
import { PROVIDERS } from "./constants"
import { isWithinInterval, addDays, startOfWeek, endOfWeek, isSameWeek, isBefore, isAfter } from "date-fns"

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

    // A shift overlaps if:
    // 1. The start date is before the existing end date AND
    // 2. The end date is after the existing start date
    if (
      isBefore(shiftStart, existingEnd) && 
      isAfter(shiftEnd, existingStart)
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
    const providerShifts = allShifts.filter(s => 
      s.providerId === shift.providerId &&
      s.id !== shift.id
    );

    let consecutiveCount = 1; // Count current shift
    let lastWeekStart = startOfWeek(shiftStart);

    // Sort shifts by start date
    const sortedShifts = [...providerShifts]
      .map(s => ({ ...s, startDate: new Date(s.startDate) }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // Find consecutive weeks including the new shift
    for (const existingShift of sortedShifts) {
      const existingStart = new Date(existingShift.startDate);
      const existingWeekStart = startOfWeek(existingStart);

      // Check if weeks are adjacent
      const weekDiff = Math.abs(
        (existingWeekStart.getTime() - lastWeekStart.getTime()) / 
        (7 * 24 * 60 * 60 * 1000)
      );

      if (weekDiff === 1) {
        consecutiveCount++;
        if (consecutiveCount > provider.maxConsecutiveWeeks) {
          conflicts.push({
            type: 'consecutive',
            message: `Exceeds maximum ${provider.maxConsecutiveWeeks} consecutive weeks`,
          });
          break;
        }
        lastWeekStart = existingWeekStart;
      } else {
        // Reset count if weeks are not consecutive
        consecutiveCount = 1;
        lastWeekStart = existingWeekStart;
      }
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

interface SwapRecommendation {
  providerId: number;
  score: number;
  reasons: string[];
}

export function getSwapRecommendations(shift: Shift, allShifts: Shift[]): SwapRecommendation[] {
  const recommendations: SwapRecommendation[] = [];
  const shiftStart = new Date(shift.startDate);
  const shiftEnd = new Date(shift.endDate);
  const currentProvider = PROVIDERS.find(p => p.id === shift.providerId);

  if (!currentProvider) return recommendations;

  // Get shifts duration in days
  const shiftDays = Math.ceil(
    (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Evaluate each provider as a potential swap candidate
  PROVIDERS.forEach(provider => {
    if (provider.id === shift.providerId) return;

    let score = 0;
    const reasons: string[] = [];
    const providerShifts = allShifts.filter(s => s.providerId === provider.id);

    // Calculate total days worked
    const totalDays = providerShifts.reduce((acc, s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    // Factor 1: Workload Balance
    const currentDaysFromTarget = Math.abs(totalDays - provider.targetDays);
    const potentialDaysFromTarget = Math.abs((totalDays + shiftDays) - provider.targetDays);

    if (potentialDaysFromTarget < currentDaysFromTarget) {
      score += 30;
      reasons.push("Improves workload balance");
    }

    // Factor 2: Schedule Compatibility
    let hasConflict = false;
    providerShifts.forEach(existingShift => {
      const existingStart = new Date(existingShift.startDate);
      const existingEnd = new Date(existingShift.endDate);

      if (
        isBefore(shiftStart, existingEnd) && 
        isAfter(shiftEnd, existingStart)
      ) {
        hasConflict = true;
      }
    });

    if (!hasConflict) {
      score += 25;
      reasons.push("No schedule conflicts");
    }

    // Factor 3: Maximum Consecutive Weeks
    if (provider.maxConsecutiveWeeks) {
      let consecutiveCount = 1;
      let lastWeekStart = startOfWeek(shiftStart);

      providerShifts.forEach(existingShift => {
        const existingStart = new Date(existingShift.startDate);
        const existingWeekStart = startOfWeek(existingStart);

        if (Math.abs(
          (existingWeekStart.getTime() - lastWeekStart.getTime()) / 
          (7 * 24 * 60 * 60 * 1000)
        ) === 1) {
          consecutiveCount++;
        }
      });

      if (consecutiveCount <= provider.maxConsecutiveWeeks) {
        score += 20;
        reasons.push("Within consecutive weeks limit");
      }
    }

    // Factor 4: Tolerance Buffer
    if (provider.tolerance) {
      const withinTolerance = Math.abs((totalDays + shiftDays) - provider.targetDays) <= provider.tolerance;
      if (withinTolerance) {
        score += 15;
        reasons.push("Within target days tolerance");
      }
    }

    recommendations.push({
      providerId: provider.id,
      score,
      reasons
    });
  });

  // Sort recommendations by score in descending order
  return recommendations.sort((a, b) => b.score - a.score);
}