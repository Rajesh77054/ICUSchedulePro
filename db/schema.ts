import { pgTable, text, serial, integer, timestamp, jsonb, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Define enums
export const ShiftStatus = ['confirmed', 'pending_swap', 'swapped', 'archived'] as const;
export type ShiftStatus = typeof ShiftStatus[number];

export const UserRole = ['admin', 'scheduler', 'physician', 'app'] as const;
export type UserRole = typeof UserRole[number];

// Define tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),  // Made nullable for migration
  password: text("password"),           // Made nullable for migration
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title").notNull(),
  primaryEmail: text("primary_email").unique().notNull(),
  secondaryEmail: text("secondary_email"),
  role: text("role", { enum: UserRole }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  targetDays: integer("target_days").notNull().default(180),
  tolerance: integer("tolerance").default(0),
  maxConsecutiveWeeks: integer("max_consecutive_weeks").notNull().default(2),
  color: text("color").notNull().default('#6366f1'),
  preferences: jsonb("preferences").default({
    defaultView: 'dayGridMonth',
    defaultCalendarDuration: 'month',
    notificationPreferences: {
      emailNotifications: true,
      inAppNotifications: true,
      notifyOnNewShifts: true,
      notifyOnSwapRequests: true,
      notifyOnTimeOffUpdates: true,
      notifyBeforeShift: 24,
    },
    preferredShiftLength: 1,
    maxShiftsPerWeek: 5,
    minDaysBetweenShifts: 1,
    preferredDaysOfWeek: [],
    avoidedDaysOfWeek: [],
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status", { enum: ShiftStatus }).notNull().default('confirmed'),
  satisfactionScore: integer("satisfaction_score"),
  schedulingNotes: jsonb("scheduling_notes").default({}),
  source: text("source").default('manual'),
  externalId: text("external_id"),
  createdAt: timestamp("created_at").defaultNow(),
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

// Define relations
export const usersRelations = relations(users, ({ one }) => ({
  provider: one(providers, {
    fields: [users.id],
    references: [providers.userId],
  }),
}));

export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id],
  }),
  shifts: many(shifts),
  holidays: many(holidays),
  requestedSwaps: many(swapRequests, { relationName: "requestor" }),
  receivedSwaps: many(swapRequests, { relationName: "recipient" }),
  timeOffRequests: many(timeOffRequests),
}));

// Define schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertProviderSchema = createInsertSchema(providers);
export const selectProviderSchema = createSelectSchema(providers);

export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Shift = typeof shifts.$inferSelect;