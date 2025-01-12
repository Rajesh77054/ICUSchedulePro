import { pgTable, text, serial, integer, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from 'zod';

// Define valid shift statuses
export const ShiftStatus = ['confirmed', 'pending_swap', 'swapped', 'inactive'] as const;
export type ShiftStatus = typeof ShiftStatus[number];

// Define conflict resolution types
export const ConflictResolutionAction = ['kept-qgenda', 'kept-local', 'merged'] as const;
export type ConflictResolutionAction = typeof ConflictResolutionAction[number];

// Define all tables first
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  targetDays: integer("target_days").notNull(),
  tolerance: integer("tolerance"),
  maxConsecutiveWeeks: integer("max_consecutive_weeks").notNull(),
  color: text("color").notNull(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status", { enum: ShiftStatus }).notNull().default('confirmed'),
  satisfactionScore: integer("satisfaction_score"),
  schedulingNotes: jsonb("scheduling_notes"),
  source: text("source").default('manual'),
  conflictResolution: jsonb("conflict_resolution").default(null),
  externalId: text("external_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  requestorId: integer("requestor_id").references(() => providers.id),
  recipientId: integer("recipient_id").references(() => providers.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  status: text("status").notNull().default('pending'),
  reason: text("reason"),
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
  status: text("status").notNull().default('pending'),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providerPreferences = pgTable("provider_preferences", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  defaultView: text("default_view").notNull().default('dayGridMonth'),
  defaultCalendarDuration: text("default_calendar_duration").notNull().default('month'),
  notificationPreferences: jsonb("notification_preferences").notNull().default({
    emailNotifications: true,
    inAppNotifications: true,
    notifyOnNewShifts: true,
    notifyOnSwapRequests: true,
    notifyOnTimeOffUpdates: true,
    notifyBeforeShift: 24,
  }),
  qgendaIntegration: jsonb("qgenda_integration").notNull().default({
    subscriptionUrl: null,
    enabled: false,
    syncInterval: 60,
    lastSyncAt: null,
  }),
  preferredShiftLength: integer("preferred_shift_length").notNull(),
  preferredDaysOfWeek: jsonb("preferred_days_of_week").notNull(),
  preferredCoworkers: jsonb("preferred_coworkers").notNull(),
  avoidedDaysOfWeek: jsonb("avoided_days_of_week").notNull(),
  maxShiftsPerWeek: integer("max_shifts_per_week"),
  minDaysBetweenShifts: integer("min_days_between_shifts"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const qgendaSyncHistory = pgTable("qgenda_sync_history", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  status: text("status").notNull(),
  shiftsImported: integer("shifts_imported"),
  error: text("error"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
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
  satisfaction: integer("satisfaction"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define all relations after tables are defined
export const shiftsRelations = relations(shifts, ({ one }) => ({
  provider: one(providers, {
    fields: [shifts.providerId],
    references: [providers.id],
  }),
}));

export const providersRelations = relations(providers, ({ many }) => ({
  shifts: many(shifts),
  preferences: many(providerPreferences),
  syncHistory: many(qgendaSyncHistory),
  timeOffRequests: many(timeOffRequests),
  swapRequests: many(swapRequests),
  holidays: many(holidays),
  metrics: many(schedulingMetrics),
}));

// Define schemas after all tables are defined
export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);

export const insertProviderSchema = createInsertSchema(providers);
export const selectProviderSchema = createSelectSchema(providers);

export const insertPreferenceSchema = createInsertSchema(providerPreferences);
export const selectPreferenceSchema = createSelectSchema(providerPreferences);

export const insertSyncHistorySchema = createInsertSchema(qgendaSyncHistory);
export const selectSyncHistorySchema = createSelectSchema(qgendaSyncHistory);

export const insertSwapRequestSchema = createInsertSchema(swapRequests);
export const selectSwapRequestSchema = createSelectSchema(swapRequests);

export const insertHolidaySchema = createInsertSchema(holidays);
export const selectHolidaySchema = createSelectSchema(holidays);

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests);
export const selectTimeOffRequestSchema = createSelectSchema(timeOffRequests);

export const insertMetricSchema = createInsertSchema(schedulingMetrics);
export const selectMetricSchema = createSelectSchema(schedulingMetrics);