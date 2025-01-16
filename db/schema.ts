import { pgTable, text, serial, integer, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Define enums
export const ShiftStatus = ['confirmed', 'pending_swap', 'swapped', 'inactive'] as const;
export type ShiftStatus = typeof ShiftStatus[number];

export const UserType = ['physician', 'app'] as const;
export type UserType = typeof UserType[number];

// Define tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  userType: text("user_type", { enum: UserType }).notNull(),
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
  userId: integer("user_id").references(() => users.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default('pending'),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  shifts: many(shifts),
  requestedSwaps: many(swapRequests, { relationName: "requestor" }),
  receivedSwaps: many(swapRequests, { relationName: "recipient" }),
  timeOffRequests: many(timeOffRequests),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
}));

// Define schemas
export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertSwapRequestSchema = createInsertSchema(swapRequests);
export const selectSwapRequestSchema = createSelectSchema(swapRequests);

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests);
export const selectTimeOffRequestSchema = createSelectSchema(timeOffRequests);