import { pgTable, text, serial, integer, timestamp, jsonb, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Define enums
export const ShiftStatus = ['confirmed', 'pending_swap', 'swapped', 'inactive'] as const;
export type ShiftStatus = typeof ShiftStatus[number];

export const UserRole = ['admin', 'scheduler', 'physician', 'app'] as const;
export type UserRole = typeof UserRole[number];

export const ProviderType = ['physician', 'app'] as const;
export type ProviderType = typeof ProviderType[number];

// Define tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title").notNull(), // M.D., D.O., APRN, RNP, PA, etc
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
  providerType: text("provider_type", { enum: ProviderType }).notNull().default('physician'),
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
  source: text("source").default('manual'),
  schedulingNotes: jsonb("scheduling_notes").default({}),
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
  requestedSwaps: many(swapRequests, { relationName: "requestor" }),
  receivedSwaps: many(swapRequests, { relationName: "recipient" }),
  timeOffRequests: many(timeOffRequests),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  provider: one(providers, {
    fields: [shifts.providerId],
    references: [providers.id],
  }),
}));

// Define schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertProviderSchema = createInsertSchema(providers);
export const selectProviderSchema = createSelectSchema(providers);

export const insertShiftSchema = createInsertSchema(shifts);
export const selectShiftSchema = createSelectSchema(shifts);

export const insertSwapRequestSchema = createInsertSchema(swapRequests);
export const selectSwapRequestSchema = createSelectSchema(swapRequests);

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests);
export const selectTimeOffRequestSchema = createSelectSchema(timeOffRequests);