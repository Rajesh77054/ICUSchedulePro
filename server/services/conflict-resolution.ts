import { db } from "@db";
import { eq, and, or, sql } from "drizzle-orm";
import { 
  shifts, 
  users, 
  schedulingRules,
  conflicts,
  resolutionAttempts,
  type ConflictType,
  type ResolutionStrategy,
  type Shift,
  swapRequests,
  type Conflict,
  type User
} from "@db/schema";

interface ConflictDetectionResult {
  type: ConflictType;
  affectedShiftIds: number[];
  affectedUserIds: number[];
  description: string;
}

interface ConflictWithShifts extends Conflict {
  shifts?: Array<Shift & { user?: User }>;
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

    if (!shift || !shift.userId) return [];

    // Check for overlapping shifts
    const overlappingShifts = await db.query.shifts.findMany({
      where: and(
        eq(shifts.userId, shift.userId),
        or(
          and(
            sql`${shifts.startDate} >= ${shift.startDate}`,
            sql`${shifts.startDate} <= ${shift.endDate}`
          ),
          and(
            sql`${shifts.endDate} >= ${shift.startDate}`,
            sql`${shifts.endDate} <= ${shift.endDate}`
          )
        ),
        sql`${shifts.id} != ${shiftId}`
      ),
    });

    if (overlappingShifts.length > 0) {
      detectedConflicts.push({
        type: 'overlap',
        affectedShiftIds: [shiftId, ...overlappingShifts.map(s => s.id)],
        affectedUserIds: [shift.userId],
        description: `Shift overlaps with ${overlappingShifts.length} other shifts`,
      });
    }

    // Get user's preferences and rules
    const userPreferences = await db.query.userPreferences.findFirst({
      where: sql`${users.id} = ${shift.userId}`,
    });

    if (userPreferences) {
      // Check for consecutive shifts violation
      const consecutiveShifts = await this.checkConsecutiveShifts(
        shift.userId,
        new Date(shift.startDate),
        userPreferences.maxShiftsPerWeek
      );

      if (consecutiveShifts) {
        detectedConflicts.push({
          type: 'consecutive_shifts',
          affectedShiftIds: [shiftId],
          affectedUserIds: [shift.userId],
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
        sql`${shifts.startDate} >= ${weekStart}`,
        sql`${shifts.startDate} <= ${date}`
      ),
    });

    return shiftsInWeek.length >= maxShifts;
  }

  /**
   * Attempts to automatically reassign a shift to resolve a conflict
   */
  private async attemptAutoReassign(conflict: ConflictWithShifts): Promise<boolean> {
    if (!conflict.affectedShiftIds?.length) return false;

    const shiftId = conflict.affectedShiftIds[0];
    const shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
      with: {
        user: true,
      },
    });

    if (!shift || !shift.userId || !shift.user) return false;

    // Find available users who can take this shift
    const availableUsers = await db.query.users.findMany({
      where: and(
        sql`${users.userType} = ${shift.user.userType}`,
        sql`${users.id} != ${shift.userId}`
      ),
    });

    for (const user of availableUsers) {
      // Check if user has no conflicts during this period
      const userConflicts = await this.detectConflicts(shiftId);

      if (userConflicts.length === 0) {
        // Reassign the shift
        await db.update(shifts)
          .set({ userId: user.id })
          .where(eq(shifts.id, shiftId));

        return true;
      }
    }

    return false;
  }

  /**
   * Notifies admin about a conflict that needs manual intervention
   */
  private async notifyAdmin(conflict: ConflictWithShifts): Promise<boolean> {
    try {
      if (!conflict.affectedShiftIds?.length) return false;

      const foundShifts = await db.query.shifts.findMany({
        where: sql`${shifts.id} = ANY(${conflict.affectedShiftIds})`,
        with: {
          user: true,
        },
      });

      // Create a notification in the database
      await db.insert(conflicts).values({
        type: conflict.type,
        status: 'escalated',
        affectedShiftIds: conflict.affectedShiftIds,
        affectedUserIds: foundShifts.map(s => s.userId!),
        detectedAt: new Date(),
        resolutionDetails: {
          requiresManualIntervention: true,
          escalatedAt: new Date(),
          shifts: foundShifts.map(s => ({
            id: s.id,
            userId: s.userId,
            userName: s.user?.name,
            startDate: s.startDate,
            endDate: s.endDate,
          })),
        },
      });

      return true;
    } catch (error) {
      console.error('Error notifying admin:', error);
      return false;
    }
  }

  /**
   * Suggests potential shift swaps to resolve a conflict
   */
  private async suggestSwap(conflict: ConflictWithShifts): Promise<boolean> {
    try {
      if (!conflict.affectedShiftIds?.length) return false;

      const shiftId = conflict.affectedShiftIds[0];
      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
        with: {
          user: true,
        },
      });

      if (!shift || !shift.userId || !shift.user) return false;

      // Find potential users for swap
      const potentialUsers = await db.query.users.findMany({
        where: and(
          sql`${users.userType} = ${shift.user.userType}`,
          sql`${users.id} != ${shift.userId}`
        ),
      });

      // Create swap requests for each potential user
      for (const user of potentialUsers) {
        await db.insert(swapRequests).values({
          requestorId: shift.userId,
          recipientId: user.id,
          shiftId: shift.id,
          status: 'pending',
          reason: 'Automated conflict resolution suggestion',
        });
      }

      return true;
    } catch (error) {
      console.error('Error suggesting swap:', error);
      return false;
    }
  }

  /**
   * Enforces scheduling rules by preventing conflicting assignments
   */
  private async enforceRule(conflict: ConflictWithShifts): Promise<boolean> {
    try {
      if (!conflict.affectedShiftIds?.length) return false;

      const shiftId = conflict.affectedShiftIds[0];
      const shift = await db.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
      });

      if (!shift) return false;

      // Get the applicable scheduling rule
      const rule = await db.query.schedulingRules.findFirst({
        where: and(
          eq(schedulingRules.isActive, true),
          sql`${schedulingRules.conditions}->>'conflictType' = ${conflict.type}`
        ),
        orderBy: sql`priority DESC`,
      });

      if (!rule) return false;

      // Apply the rule's resolution strategy
      switch (rule.strategy) {
        case 'auto_reassign':
          return this.attemptAutoReassign(conflict);
        case 'notify_admin':
          return this.notifyAdmin(conflict);
        case 'suggest_swap':
          return this.suggestSwap(conflict);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error enforcing rule:', error);
      return false;
    }
  }
}

export const conflictResolutionService = new ConflictResolutionService();