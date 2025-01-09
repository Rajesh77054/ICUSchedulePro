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
  warnings: string[];
}

interface RecommendationFactors {
  workloadBalance: number;
  scheduleCompatibility: number;
  policyCompliance: number;
  timeOffConflicts: number;
  historicalPatterns: number;
}

const FACTOR_WEIGHTS = {
  workloadBalance: 0.35,
  scheduleCompatibility: 0.25,
  policyCompliance: 0.2,
  timeOffConflicts: 0.15,
  historicalPatterns: 0.05,
};

export function getSwapRecommendations(
  shift: Shift,
  allShifts: Shift[],
  timeOffRequests: TimeOffRequest[] = [],
  holidays: Holiday[] = [],
  swapHistory: any[] = []
): SwapRecommendation[] {
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

    const factors: RecommendationFactors = {
      workloadBalance: 0,
      scheduleCompatibility: 0,
      policyCompliance: 0,
      timeOffConflicts: 0,
      historicalPatterns: 0,
    };

    const reasons: string[] = [];
    const warnings: string[] = [];
    const providerShifts = allShifts.filter(s => s.providerId === provider.id);

    // Factor 1: Workload Balance (35%)
    const totalDays = providerShifts.reduce((acc, s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    const currentDaysFromTarget = Math.abs(totalDays - provider.targetDays);
    const potentialDaysFromTarget = Math.abs((totalDays + shiftDays) - provider.targetDays);

    if (potentialDaysFromTarget < currentDaysFromTarget) {
      factors.workloadBalance = 1;
      reasons.push("Improves workload balance");
    } else if (potentialDaysFromTarget <= provider.tolerance!) {
      factors.workloadBalance = 0.5;
      reasons.push("Within acceptable workload range");
    }

    // Factor 2: Schedule Compatibility (25%)
    let hasScheduleConflict = false;
    providerShifts.forEach(existingShift => {
      const existingStart = new Date(existingShift.startDate);
      const existingEnd = new Date(existingShift.endDate);

      if (
        isBefore(shiftStart, existingEnd) && 
        isAfter(shiftEnd, existingStart)
      ) {
        hasScheduleConflict = true;
      }
    });

    if (!hasScheduleConflict) {
      factors.scheduleCompatibility = 1;
      reasons.push("No schedule conflicts");
    }

    // Factor 3: Policy Compliance (20%)
    let policyScore = 1;

    // Check consecutive weeks
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

      if (consecutiveCount > provider.maxConsecutiveWeeks) {
        policyScore = 0;
        warnings.push(`Exceeds maximum ${provider.maxConsecutiveWeeks} consecutive weeks`);
      } else if (consecutiveCount === provider.maxConsecutiveWeeks) {
        policyScore = 0.5;
        warnings.push("Close to consecutive weeks limit");
      }
    }

    factors.policyCompliance = policyScore;
    if (policyScore === 1) {
      reasons.push("Complies with all policies");
    }

    // Factor 4: Time Off Conflicts (15%)
    const relevantTimeOff = timeOffRequests.filter(request => 
      request.providerId === provider.id &&
      request.status === 'approved' &&
      isWithinInterval(shiftStart, {
        start: new Date(request.startDate),
        end: new Date(request.endDate)
      }) ||
      isWithinInterval(shiftEnd, {
        start: new Date(request.startDate),
        end: new Date(request.endDate)
      })
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

    // Factor 5: Historical Patterns (5%)
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

    // Calculate final weighted score
    const score = Math.round(
      (factors.workloadBalance * FACTOR_WEIGHTS.workloadBalance +
      factors.scheduleCompatibility * FACTOR_WEIGHTS.scheduleCompatibility +
      factors.policyCompliance * FACTOR_WEIGHTS.policyCompliance +
      factors.timeOffConflicts * FACTOR_WEIGHTS.timeOffConflicts +
      factors.historicalPatterns * FACTOR_WEIGHTS.historicalPatterns) * 100
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