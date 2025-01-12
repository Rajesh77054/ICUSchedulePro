import { pgTable, text, serial, integer, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Add sync history table
export const qgendaSyncHistory = pgTable("qgenda_sync_history", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  status: text("status").notNull(), // success, failed
  shiftsImported: integer("shifts_imported"),
  error: text("error"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  targetDays: integer("target_days").notNull(),
  tolerance: integer("tolerance"),
  maxConsecutiveWeeks: integer("max_consecutive_weeks").notNull(),
  color: text("color").notNull(),
});

export const providerPreferences = pgTable("provider_preferences", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  // Calendar preferences
  defaultView: text("default_view").notNull().default('dayGridMonth'),
  defaultCalendarDuration: text("default_calendar_duration").notNull().default('month'),
  // Notification preferences
  notificationPreferences: jsonb("notification_preferences").notNull().default({
    emailNotifications: true,
    inAppNotifications: true,
    notifyOnNewShifts: true,
    notifyOnSwapRequests: true,
    notifyOnTimeOffUpdates: true,
    notifyBeforeShift: 24, // hours before shift
  }),
  // QGenda integration preferences
  qgendaIntegration: jsonb("qgenda_integration").notNull().default({
    subscriptionUrl: null,
    enabled: false,
    syncInterval: 60, // minutes
    lastSyncAt: null,
  }),
  // Scheduling preferences
  preferredShiftLength: integer("preferred_shift_length").notNull(),
  preferredDaysOfWeek: jsonb("preferred_days_of_week").notNull(),
  preferredCoworkers: jsonb("preferred_coworkers").notNull(),
  avoidedDaysOfWeek: jsonb("avoided_days_of_week").notNull(),
  maxShiftsPerWeek: integer("max_shifts_per_week"),
  minDaysBetweenShifts: integer("min_days_between_shifts"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default('confirmed'), // confirmed, pending_swap, swapped, archived
  satisfactionScore: integer("satisfaction_score"), // Provider's satisfaction with this shift
  schedulingNotes: jsonb("scheduling_notes"), // AI insights and scheduling decisions
  source: text("source").default('manual'), // manual, qgenda, etc.
  conflictResolution: jsonb("conflict_resolution").default(null), // Store conflict resolution details
  externalId: text("external_id"), // ID from external system (e.g., QGenda)
});

export const schedulingMetrics = pgTable("scheduling_metrics", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  totalShifts: integer("total_shifts").notNull(),
  totalDays: integer("total_days").notNull(),
  weekendShifts: integer("weekend_shifts").notNull(),
  holidayShifts: integer("holiday_shifts").notNull(),
  swapRequests: integer("swap_requests").notNull(),
  averageShiftLength: integer("average_shift_length").notNull(),
  consecutiveShiftWeeks: integer("consecutive_shift_weeks").notNull(),
  satisfaction: integer("satisfaction"), // Optional satisfaction score
  createdAt: timestamp("created_at").defaultNow(),
});

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  requestorId: integer("requestor_id").references(() => providers.id),
  recipientId: integer("recipient_id").references(() => providers.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  status: text("status").notNull().default('pending'), // pending, accepted, rejected
  reason: text("reason"), // Why the swap was requested
  createdAt: timestamp("created_at").defaultNow(),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  providerId: integer("provider_id").references(() => providers.id),
});

export const timeOffRequests = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default('pending'), // pending, approved, rejected
  reason: text("reason"), // Rejection reason if status is 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const providersRelations = relations(providers, ({ many, one }) => ({
  shifts: many(shifts),
  holidays: many(holidays),
  timeOffRequests: many(timeOffRequests),
  preferences: one(providerPreferences, {
    fields: [providers.id],
    references: [providerPreferences.providerId],
  }),
  metrics: many(schedulingMetrics),
  syncHistory: many(qgendaSyncHistory, {
    fields: [providers.id],
    references: [qgendaSyncHistory.providerId],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  provider: one(providers, {
    fields: [shifts.providerId],
    references: [providers.id],
  }),
}));

// Schemas
export const insertQgendaSyncHistorySchema = createInsertSchema(qgendaSyncHistory);
export const selectQgendaSyncHistorySchema = createSelectSchema(qgendaSyncHistory);

export const insertProviderSchema = createInsertSchema(providers);
export const selectProviderSchema = createSelectSchema(providers);
export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);
export const insertPreferenceSchema = createInsertSchema(providerPreferences);
export const selectPreferenceSchema = createSelectSchema(providerPreferences);
export const insertMetricsSchema = createInsertSchema(schedulingMetrics);
export const selectMetricsSchema = createSelectSchema(schedulingMetrics);