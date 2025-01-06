import { pgTable, text, serial, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

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
  status: text("status").notNull().default('confirmed'), // confirmed, pending_swap, swapped
});

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  requestorId: integer("requestor_id").references(() => providers.id),
  recipientId: integer("recipient_id").references(() => providers.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  status: text("status").notNull().default('pending'), // pending, accepted, rejected
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const providersRelations = relations(providers, ({ many }) => ({
  shifts: many(shifts),
  holidays: many(holidays),
  timeOffRequests: many(timeOffRequests),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  provider: one(providers, {
    fields: [shifts.providerId],
    references: [providers.id],
  }),
}));

// Schemas
export const insertProviderSchema = createInsertSchema(providers);
export const selectProviderSchema = createSelectSchema(providers);
export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);
