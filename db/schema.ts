import { pgTable, text, serial, integer, timestamp, jsonb, date, integer as int } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";

// Define enums
export const TimeOffRequestStatus = ['pending', 'approved', 'rejected'] as const;
export type TimeOffRequestStatus = typeof TimeOffRequestStatus[number];

export const ShiftStatus = ['confirmed', 'pending_swap', 'swapped', 'inactive'] as const;
export type ShiftStatus = typeof ShiftStatus[number];

export const UserType = ['physician', 'app'] as const;
export type UserType = typeof UserType[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  userType: text("user_type").notNull(),
  targetDays: integer("target_days").notNull(),
  tolerance: integer("tolerance").default(0),
  maxConsecutiveWeeks: integer("max_consecutive_weeks").notNull(),
  color: text("color").notNull(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status", { enum: ShiftStatus }).notNull().default('confirmed'),
  source: text("source").default('manual'),
  schedulingNotes: jsonb("scheduling_notes").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  requestorId: integer("requestor_id").references(() => users.id),
  recipientId: integer("recipient_id").references(() => users.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  status: text("status").notNull().default('pending'),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeOffRequests = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status", { enum: TimeOffRequestStatus }).notNull().default('pending'),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  preferredShiftLength: integer("preferred_shift_length").notNull().default(7),
  maxShiftsPerWeek: integer("max_shifts_per_week").notNull().default(1),
  minDaysBetweenShifts: integer("min_days_between_shifts").notNull().default(0),
  preferredDaysOfWeek: int("preferred_days_of_week").array().notNull().default([]),
  avoidedDaysOfWeek: int("avoided_days_of_week").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  shifts: many(shifts),
  requestedSwaps: many(swapRequests, { relationName: "requestor" }),
  receivedSwaps: many(swapRequests, { relationName: "recipient" }),
  timeOffRequests: many(timeOffRequests),
  preferences: many(userPreferences),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
}));

export const timeOffRequestsRelations = relations(timeOffRequests, ({ one }) => ({
  user: one(users, {
    fields: [timeOffRequests.userId],
    references: [users.id],
  }),
}));

export const swapRequestsRelations = relations(swapRequests, ({ one }) => ({
  requestor: one(users, {
    fields: [swapRequests.requestorId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [swapRequests.recipientId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [swapRequests.shiftId],
    references: [shifts.id],
  }),
}));

// Define models
export type User = InferModel<typeof users>;
export type Shift = InferModel<typeof shifts>;
export type SwapRequest = InferModel<typeof swapRequests>;
export type TimeOffRequest = InferModel<typeof timeOffRequests>;
export type UserPreferences = InferModel<typeof userPreferences>;

// Define schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);

export const insertSwapRequestSchema = createInsertSchema(swapRequests);
export const selectSwapRequestSchema = createSelectSchema(swapRequests);

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests);
export const selectTimeOffRequestSchema = createSelectSchema(timeOffRequests);

export const insertUserPreferencesSchema = createInsertSchema(userPreferences);
export const selectUserPreferencesSchema = createSelectSchema(userPreferences);