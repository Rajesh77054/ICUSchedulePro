import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Shift, TimeOffRequest, Holiday, User } from "./types"
import { USERS } from "./constants"
import { isWithinInterval, addDays, startOfWeek, endOfWeek, isSameWeek, isBefore, isAfter, differenceInDays, isSameDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function detectShiftConflicts(shift: Shift | null | undefined, allShifts: Shift[]): {
  type: 'overlap' | 'consecutive' | 'maxDays';
  message: string;
  conflictingShift?: Shift;
}[] {
  const conflicts: {
    type: 'overlap' | 'consecutive' | 'maxDays';
    message: string;
    conflictingShift?: Shift;
  }[] = [];

  // Early return if shift is null/undefined or missing required properties
  if (!shift?.startDate || !shift?.endDate || !shift?.userId) {
    return conflicts;
  }

  const shiftStart = new Date(shift.startDate);
  const shiftEnd = new Date(shift.endDate);
  const user = USERS.find(u => u.id === shift.userId);

  if (!user) return conflicts;

  // Filter out invalid shifts from allShifts and only consider shifts for the same user type
  const validShifts = allShifts.filter(s => {
    const otherUser = USERS.find(u => u.id === s.userId);
    return s && s.startDate && s.endDate && s.userId && 
           s.id !== shift.id && 
           otherUser?.userType === user.userType;
  });

  // Check for overlapping shifts for the same user type
  validShifts.forEach(existingShift => {
    const existingStart = new Date(existingShift.startDate);
    const existingEnd = new Date(existingShift.endDate);

    // Check if shifts overlap, excluding adjacent shifts
    const overlaps = (
      isBefore(shiftStart, existingEnd) && isAfter(shiftEnd, existingStart)
    );
    
    if (overlaps) {
      conflicts.push({
        type: 'overlap',
        message: `Shift overlaps with another ${user.userType} shift`,
        conflictingShift: existingShift,
      });
    }
  });

  // Check for consecutive weeks within the same user type
  if (user.maxConsecutiveWeeks) {
    const userShifts = validShifts.filter(s => s.userId === user.id);
    let consecutiveCount = 1;
    let lastWeekStart = startOfWeek(shiftStart);

    const sortedShifts = [...userShifts, { ...shift, startDate: shiftStart, endDate: shiftEnd }]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    for (let i = 1; i < sortedShifts.length; i++) {
      const currentStart = new Date(sortedShifts[i].startDate);
      const prevStart = new Date(sortedShifts[i-1].startDate);
      
      const currentWeekStart = startOfWeek(currentStart);
      const prevWeekStart = startOfWeek(prevStart);
      
      const weekDiff = Math.round(
        (currentWeekStart.getTime() - prevWeekStart.getTime()) / 
        (7 * 24 * 60 * 60 * 1000)
      );

      if (weekDiff === 1) {
        consecutiveCount++;
        if (consecutiveCount > user.maxConsecutiveWeeks) {
          conflicts.push({
            type: 'consecutive',
            message: `Exceeds maximum ${user.maxConsecutiveWeeks} consecutive weeks for ${user.userType}s`,
          });
          break;
        }
      } else {
        consecutiveCount = 1;
      }
    }
  }

  // Check max days per user type
  const userTypeShifts = validShifts.filter(s => 
    s.userId === shift.userId
  );

  const totalDays = userTypeShifts.reduce((acc, s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);

  if (totalDays > user.targetDays + (user.tolerance || 0)) {
    conflicts.push({
      type: 'maxDays',
      message: `Exceeds target days (${user.targetDays}) for ${user.userType}s`,
    });
  }

  return conflicts;
}

interface SwapRecommendation {
  userId: number;
  score: number;
  reasons: string[];
  warnings: string[];
  userType: 'physician' | 'app';
}

interface RecommendationFactors {
  workloadBalance: number;
  scheduleCompatibility: number;
  policyCompliance: number;
  timeOffConflicts: number;
  historicalPatterns: number;
  preferenceMatch: number;
  userTypeMatch: number;
}

const FACTOR_WEIGHTS = {
  userTypeMatch: 0.25,
  workloadBalance: 0.20,
  scheduleCompatibility: 0.15,
  policyCompliance: 0.15,
  timeOffConflicts: 0.10,
  historicalPatterns: 0.05,
  preferenceMatch: 0.10,
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
  const currentUser = USERS.find(u => u.id === shift.userId);
  const shiftDayOfWeek = shiftStart.getDay();
  const shiftLength = Math.ceil((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60 * 24));

  if (!currentUser) return recommendations;

  // Only consider users of the same type (Physician or APP)
  const eligibleUsers = USERS.filter(user => 
    user.id !== shift.userId && 
    user.userType === currentUser.userType 
  );

  eligibleUsers.forEach(user => {
    const factors: RecommendationFactors = {
      workloadBalance: 0,
      scheduleCompatibility: 0,
      policyCompliance: 0,
      timeOffConflicts: 0,
      historicalPatterns: 0,
      preferenceMatch: 0,
      userTypeMatch: 1, 
    };

    const reasons: string[] = [];
    const warnings: string[] = [];
    const userShifts = allShifts.filter(s => s.userId === user.id);

    reasons.push(`Same ${user.userType} type`);

    // Factor 1: Workload Balance (20%)
    const totalDays = userShifts.reduce((acc, s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    const currentDaysFromTarget = Math.abs(totalDays - user.targetDays);
    const potentialDaysFromTarget = Math.abs((totalDays + shiftLength) - user.targetDays);

    if (potentialDaysFromTarget < currentDaysFromTarget) {
      factors.workloadBalance = 1;
      reasons.push(`Improves ${user.userType} workload balance`);
    } else if (potentialDaysFromTarget <= (user.tolerance || 7)) {
      factors.workloadBalance = 0.5;
      reasons.push(`Within acceptable ${user.userType} workload range`);
    }

    // Factor 2: Schedule Compatibility (15%)
    let hasScheduleConflict = false;
    let nearbyShifts = 0;

    userShifts.forEach(existingShift => {
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

    userShifts.forEach(existingShift => {
      const existingStart = new Date(existingShift.startDate);
      const existingWeekStart = startOfWeek(existingStart);

      if (Math.abs(
        (existingWeekStart.getTime() - lastWeekStart.getTime()) / 
        (7 * 24 * 60 * 60 * 1000)
      ) === 1) {
        consecutiveCount++;
      }
    });

    if (consecutiveCount > user.maxConsecutiveWeeks) {
      policyScore = 0;
      warnings.push(`Exceeds maximum consecutive weeks`);
    } else if (consecutiveCount === user.maxConsecutiveWeeks) {
      policyScore = 0.3;
      warnings.push("Close to consecutive weeks limit");
    }

    factors.policyCompliance = policyScore;
    if (policyScore === 1) {
      reasons.push("Complies with all policies");
    }

    // Factor 4: Time Off Conflicts (10%)
    const relevantTimeOff = timeOffRequests.filter(request => 
      request.userId === user.id &&
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

    if (relevantTimeOff.length === 0) {
      factors.timeOffConflicts = 1;
      reasons.push("No time-off conflicts");
    } else {
      warnings.push("Conflicts with time-off");
    }

    // Factor 5: Historical Patterns (5%)
    const recentSwaps = swapHistory.filter(swap => 
      swap.requestorId === user.id || 
      swap.recipientId === user.id
    ).length;

    factors.historicalPatterns = Math.max(0, 1 - (recentSwaps * 0.2));
    if (factors.historicalPatterns > 0.8) {
      reasons.push("Good swap history");
    } else if (recentSwaps > 3) {
      warnings.push("High recent swap activity");
    }

    // Factor 6: Preference Match (10%)
    const userPrefs = preferences.find(p => p.userId === user.id);
    if (userPrefs) {
      let prefScore = 0;

      // Check preferred shift length
      if (shiftLength <= userPrefs.preferredShiftLength) {
        prefScore += 0.3;
        reasons.push("Preferred shift length");
      }

      // Check preferred days
      if (userPrefs.preferredDaysOfWeek.includes(shiftDayOfWeek)) {
        prefScore += 0.4;
        reasons.push("Preferred day of week");
      }

      // Check avoided days
      if (userPrefs.avoidedDaysOfWeek.includes(shiftDayOfWeek)) {
        warnings.push("Usually avoids this day");
      } else {
        prefScore += 0.3;
      }

      factors.preferenceMatch = prefScore;
    }

    // Calculate final weighted score with user type match factor
    const score = Math.round(
      (factors.userTypeMatch * FACTOR_WEIGHTS.userTypeMatch +
      factors.workloadBalance * FACTOR_WEIGHTS.workloadBalance +
      factors.scheduleCompatibility * FACTOR_WEIGHTS.scheduleCompatibility +
      factors.policyCompliance * FACTOR_WEIGHTS.policyCompliance +
      factors.timeOffConflicts * FACTOR_WEIGHTS.timeOffConflicts +
      factors.historicalPatterns * FACTOR_WEIGHTS.historicalPatterns +
      factors.preferenceMatch * FACTOR_WEIGHTS.preferenceMatch) * 100
    );

    recommendations.push({
      userId: user.id,
      score,
      reasons,
      warnings,
      userType: user.userType 
    });
  });

  // Sort recommendations by score in descending order
  return recommendations.sort((a, b) => b.score - a.score);
}
export function normalizeShiftDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getShiftDuration(shift: Shift): number {
  return normalizeShiftDays(shift.startDate, shift.endDate);
}
