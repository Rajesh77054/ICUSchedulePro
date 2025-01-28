import { db } from "@db";
import { eq, and, or, gte, lte } from "drizzle-orm";
import { 
  shifts, 
  users, 
  schedulingRules,
  conflicts,
  resolutionAttempts,
  type ConflictType,
  type ResolutionStrategy
} from "@db/schema";

interface ConflictDetectionResult {
  type: ConflictType;
  affectedShiftIds: number[];
  affectedUserIds: number[];
  description: string;
}

export class ConflictResolutionService {
  /**
   * Detects conflicts in the schedule based on defined rules
   */
  async detectConflicts(shiftId: number): Promise<ConflictDetectionResult[]> {
    const detectedConflicts: ConflictDetectionResult[] = [];
    
    // Get the shift we're checking
    const shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
      with: {
        user: true,
      },
    });

    if (!shift) return [];

    // Check for overlapping shifts
    const overlappingShifts = await db.query.shifts.findMany({
      where: and(
        eq(shifts.userId, shift.userId),
        or(
          and(
            gte(shifts.startDate, shift.startDate),
            lte(shifts.startDate, shift.endDate)
          ),
          and(
            gte(shifts.endDate, shift.startDate),
            lte(shifts.endDate, shift.endDate)
          )
        ),
        shifts.id !== shiftId
      ),
    });

    if (overlappingShifts.length > 0) {
      detectedConflicts.push({
        type: 'overlap',
        affectedShiftIds: [shiftId, ...overlappingShifts.map(s => s.id)],
        affectedUserIds: [shift.userId!],
        description: `Shift overlaps with ${overlappingShifts.length} other shifts`,
      });
    }

    // Get user's preferences and rules
    const userPreferences = await db.query.userPreferences.findFirst({
      where: eq(users.id, shift.userId!),
    });

    if (userPreferences) {
      // Check for consecutive shifts violation
      const consecutiveShifts = await this.checkConsecutiveShifts(
        shift.userId!,
        shift.startDate,
        userPreferences.maxShiftsPerWeek
      );

      if (consecutiveShifts) {
        detectedConflicts.push({
          type: 'consecutive_shifts',
          affectedShiftIds: [shiftId],
          affectedUserIds: [shift.userId!],
          description: 'Exceeds maximum consecutive shifts allowed',
        });
      }
    }

    return detectedConflicts;
  }

  /**
   * Attempts to resolve a conflict using the specified strategy
   */
  async resolveConflict(
    conflictId: number,
    strategy: ResolutionStrategy
  ): Promise<boolean> {
    const conflict = await db.query.conflicts.findFirst({
      where: eq(conflicts.id, conflictId),
    });

    if (!conflict) return false;

    try {
      // Record the attempt
      await db.insert(resolutionAttempts).values({
        conflictId,
        strategy,
        successful: false,
        details: {},
      });

      let successful = false;

      switch (strategy) {
        case 'auto_reassign':
          successful = await this.attemptAutoReassign(conflict);
          break;
        case 'notify_admin':
          successful = await this.notifyAdmin(conflict);
          break;
        case 'suggest_swap':
          successful = await this.suggestSwap(conflict);
          break;
        case 'enforce_rule':
          successful = await this.enforceRule(conflict);
          break;
      }

      // Update the resolution attempt with the result
      if (successful) {
        await db.update(conflicts)
          .set({ 
            status: 'resolved',
            resolvedAt: new Date(),
            resolutionDetails: { strategy, timestamp: new Date() }
          })
          .where(eq(conflicts.id, conflictId));
      }

      return successful;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return false;
    }
  }

  /**
   * Checks for consecutive shifts violations
   */
  private async checkConsecutiveShifts(
    userId: number,
    date: Date,
    maxShifts: number
  ): Promise<boolean> {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - 7);

    const shiftsInWeek = await db.query.shifts.findMany({
      where: and(
        eq(shifts.userId, userId),
        gte(shifts.startDate, weekStart),
        lte(shifts.startDate, date)
      ),
    });

    return shiftsInWeek.length >= maxShifts;
  }

  /**
   * Attempts to automatically reassign a shift to resolve a conflict
   */
  private async attemptAutoReassign(conflict: any): Promise<boolean> {
    // Implementation will include finding available staff and reassigning shifts
    return false; // Placeholder
  }

  /**
   * Notifies admin about a conflict that needs manual intervention
   */
  private async notifyAdmin(conflict: any): Promise<boolean> {
    // Implementation will include sending notifications via WebSocket
    return true; // Placeholder
  }

  /**
   * Suggests potential shift swaps to resolve a conflict
   */
  private async suggestSwap(conflict: any): Promise<boolean> {
    // Implementation will include finding potential swap candidates
    return false; // Placeholder
  }

  /**
   * Enforces scheduling rules by preventing conflicting assignments
   */
  private async enforceRule(conflict: any): Promise<boolean> {
    // Implementation will include rule enforcement logic
    return false; // Placeholder
  }
}

export const conflictResolutionService = new ConflictResolutionService();
