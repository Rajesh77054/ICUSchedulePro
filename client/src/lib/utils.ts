import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Shift, TimeOffRequest, Holiday } from "./types"
import { PROVIDERS } from "./constants"
import { isWithinInterval, addDays, startOfWeek, endOfWeek, isSameWeek, isBefore, isAfter, differenceInDays } from "date-fns"

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

    const sortedShifts = [...providerShifts]
      .map(s => ({ ...s, startDate: new Date(s.startDate) }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    for (const existingShift of sortedShifts) {
      const existingStart = new Date(existingShift.startDate);
      const existingWeekStart = startOfWeek(existingStart);

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
        consecutiveCount = 1;
        lastWeekStart = existingWeekStart;
      }
    }
  }

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
  warnings: string[];
}

interface RecommendationFactors {
  workloadBalance: number;
  scheduleCompatibility: number;
  policyCompliance: number;
  timeOffConflicts: number;
  historicalPatterns: number;
  preferenceMatch: number;
}

const FACTOR_WEIGHTS = {
  workloadBalance: 0.25,
  scheduleCompatibility: 0.2,
  policyCompliance: 0.15,
  timeOffConflicts: 0.15,
  historicalPatterns: 0.1,
  preferenceMatch: 0.15,
};

export function getSwapRecommendations(
  shift: Shift,
  allShifts: Shift[],
  timeOffRequests: TimeOffRequest[] = [],
  holidays: Holiday[] = [],
  swapHistory: any[] = [],
  preferences: any[] = []
): SwapRecommendation[] {
  const recommendations: SwapRecommendation[] = [];
  const shiftStart = new Date(shift.startDate);
  const shiftEnd = new Date(shift.endDate);
  const currentProvider = PROVIDERS.find(p => p.id === shift.providerId);
  const shiftDayOfWeek = shiftStart.getDay();
  const shiftLength = Math.ceil((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60 * 24));

  if (!currentProvider) return recommendations;

  PROVIDERS.forEach(provider => {
    if (provider.id === shift.providerId) return;

    const factors: RecommendationFactors = {
      workloadBalance: 0,
      scheduleCompatibility: 0,
      policyCompliance: 0,
      timeOffConflicts: 0,
      historicalPatterns: 0,
      preferenceMatch: 0,
    };

    const reasons: string[] = [];
    const warnings: string[] = [];
    const providerShifts = allShifts.filter(s => s.providerId === provider.id);

    // Factor 1: Workload Balance (25%)
    const totalDays = providerShifts.reduce((acc, s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    const currentDaysFromTarget = Math.abs(totalDays - provider.targetDays);
    const potentialDaysFromTarget = Math.abs((totalDays + shiftLength) - provider.targetDays);

    if (potentialDaysFromTarget < currentDaysFromTarget) {
      factors.workloadBalance = 1;
      reasons.push("Improves workload balance");
    } else if (potentialDaysFromTarget <= (provider.tolerance || 7)) {
      factors.workloadBalance = 0.5;
      reasons.push("Within acceptable workload range");
    }

    // Factor 2: Schedule Compatibility (20%)
    let hasScheduleConflict = false;
    let nearbyShifts = 0;
    providerShifts.forEach(existingShift => {
      const existingStart = new Date(existingShift.startDate);
      const existingEnd = new Date(existingShift.endDate);

      if (
        isBefore(shiftStart, existingEnd) && 
        isAfter(shiftEnd, existingStart)
      ) {
        hasScheduleConflict = true;
      }

      // Check for shifts within 7 days
      if (Math.abs(differenceInDays(shiftStart, existingStart)) <= 7) {
        nearbyShifts++;
      }
    });

    if (!hasScheduleConflict) {
      factors.scheduleCompatibility = nearbyShifts === 0 ? 1 : 0.7;
      reasons.push(nearbyShifts === 0 ? "Optimal schedule spacing" : "Acceptable schedule spacing");
    }

    // Factor 3: Policy Compliance (15%)
    let policyScore = 1;
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

    if (consecutiveCount > (provider.maxConsecutiveWeeks || 2)) {
      policyScore = 0;
      warnings.push(`Exceeds maximum consecutive weeks`);
    } else if (consecutiveCount === (provider.maxConsecutiveWeeks || 2)) {
      policyScore = 0.3;
      warnings.push("Close to consecutive weeks limit");
    }

    factors.policyCompliance = policyScore;
    if (policyScore === 1) {
      reasons.push("Complies with all policies");
    }

    // Factor 4: Time Off Conflicts (15%)
    const relevantTimeOff = timeOffRequests.filter(request => 
      request.providerId === provider.id &&
      request.status === 'approved' &&
      (isWithinInterval(shiftStart, {
        start: new Date(request.startDate),
        end: new Date(request.endDate)
      }) ||
      isWithinInterval(shiftEnd, {
        start: new Date(request.startDate),
        end: new Date(request.endDate)
      }))
    );

    const relevantHolidays = holidays.filter(holiday =>
      holiday.providerId === provider.id &&
      isWithinInterval(new Date(holiday.date), {
        start: shiftStart,
        end: shiftEnd
      })
    );

    if (relevantTimeOff.length === 0 && relevantHolidays.length === 0) {
      factors.timeOffConflicts = 1;
      reasons.push("No time-off conflicts");
    } else {
      warnings.push("Conflicts with time-off or holidays");
    }

    // Factor 5: Historical Patterns (10%)
    const recentSwaps = swapHistory.filter(swap => 
      swap.requestorId === provider.id || 
      swap.recipientId === provider.id
    ).length;

    factors.historicalPatterns = Math.max(0, 1 - (recentSwaps * 0.2));
    if (factors.historicalPatterns > 0.8) {
      reasons.push("Good swap history");
    } else if (recentSwaps > 3) {
      warnings.push("High recent swap activity");
    }

    // Factor 6: Preference Match (15%)
    const providerPrefs = preferences.find(p => p.providerId === provider.id);
    if (providerPrefs) {
      let prefScore = 0;

      // Check preferred shift length
      if (shiftLength <= providerPrefs.preferredShiftLength) {
        prefScore += 0.3;
        reasons.push("Preferred shift length");
      }

      // Check preferred days
      if (providerPrefs.preferredDaysOfWeek.includes(shiftDayOfWeek)) {
        prefScore += 0.4;
        reasons.push("Preferred day of week");
      }

      // Check avoided days
      if (providerPrefs.avoidedDaysOfWeek.includes(shiftDayOfWeek)) {
        warnings.push("Usually avoids this day");
      } else {
        prefScore += 0.3;
      }

      factors.preferenceMatch = prefScore;
    }

    // Calculate final weighted score
    const score = Math.round(
      (factors.workloadBalance * FACTOR_WEIGHTS.workloadBalance +
      factors.scheduleCompatibility * FACTOR_WEIGHTS.scheduleCompatibility +
      factors.policyCompliance * FACTOR_WEIGHTS.policyCompliance +
      factors.timeOffConflicts * FACTOR_WEIGHTS.timeOffConflicts +
      factors.historicalPatterns * FACTOR_WEIGHTS.historicalPatterns +
      factors.preferenceMatch * FACTOR_WEIGHTS.preferenceMatch) * 100
    );

    recommendations.push({
      providerId: provider.id,
      score,
      reasons,
      warnings
    });
  });

  // Sort recommendations by score in descending order
  return recommendations.sort((a, b) => b.score - a.score);
}