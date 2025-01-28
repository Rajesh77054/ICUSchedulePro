import { pgTable, text, serial, integer, timestamp, jsonb, date, integer as int, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import type { InferModel } from "drizzle-orm";

// Define enums
export const TimeOffRequestStatus = ['pending', 'approved', 'rejected'] as const;
export type TimeOffRequestStatus = typeof TimeOffRequestStatus[number];

export const ShiftStatus = ['confirmed', 'pending_swap', 'swapped', 'archived'] as const;
export type ShiftStatus = typeof ShiftStatus[number];

export const UserType = ['physician', 'app'] as const;
export type UserType = typeof UserType[number];

export const MessageType = ['text', 'shift_swap', 'urgent_coverage'] as const;
export type MessageType = typeof MessageType[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
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
  updatedAt: timestamp("updated_at").defaultNow(),
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

// New tables for chat functionality
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default('group'), // 'group' or 'direct'
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => chatRooms.id),
  senderId: integer("sender_id").references(() => users.id),
  content: text("content").notNull(),
  messageType: text("message_type", { enum: MessageType }).notNull().default('text'),
  metadata: jsonb("metadata").default({}), // For shift swap requests or urgent coverage needs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const roomMembers = pgTable("room_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => chatRooms.id),
  userId: integer("user_id").references(() => users.id),
  role: text("role").notNull().default('member'), // 'admin' or 'member'
  lastRead: timestamp("last_read"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  shifts: many(shifts),
  requestedSwaps: many(swapRequests, { relationName: "requestor" }),
  receivedSwaps: many(swapRequests, { relationName: "recipient" }),
  timeOffRequests: many(timeOffRequests),
  preferences: many(userPreferences),
  messages: many(messages, { relationName: "sent_messages" }),
  rooms: many(roomMembers),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
  swapRequests: many(swapRequests),
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
    relationName: "requestor",
  }),
  recipient: one(users, {
    fields: [swapRequests.recipientId],
    references: [users.id],
    relationName: "recipient",
  }),
  shift: one(shifts, {
    fields: [swapRequests.shiftId],
    references: [shifts.id],
  }),
}));

export const chatRoomsRelations = relations(chatRooms, ({ many, one }) => ({
  messages: many(messages),
  members: many(roomMembers),
  creator: one(users, {
    fields: [chatRooms.createdBy],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(chatRooms, {
    fields: [messages.roomId],
    references: [chatRooms.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(chatRooms, {
    fields: [roomMembers.roomId],
    references: [chatRooms.id],
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id],
  }),
}));

// Define models
export type User = InferModel<typeof users>;
export type Shift = InferModel<typeof shifts>;
export type SwapRequest = InferModel<typeof swapRequests>;
export type TimeOffRequest = InferModel<typeof timeOffRequests>;
export type UserPreferences = InferModel<typeof userPreferences>;
export type ChatRoom = InferModel<typeof chatRooms>;
export type Message = InferModel<typeof messages>;
export type RoomMember = InferModel<typeof roomMembers>;

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

export const insertChatRoomSchema = createInsertSchema(chatRooms);
export const selectChatRoomSchema = createSelectSchema(chatRooms);

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export const insertRoomMemberSchema = createInsertSchema(roomMembers);
export const selectRoomMemberSchema = createSelectSchema(roomMembers);

// New enums for conflict resolution
export const ConflictType = ['overlap', 'consecutive_shifts', 'overtime', 'understaffed'] as const;
export type ConflictType = typeof ConflictType[number];

export const ResolutionStrategy = ['auto_reassign', 'notify_admin', 'suggest_swap', 'enforce_rule'] as const;
export type ResolutionStrategy = typeof ResolutionStrategy[number];

export const ConflictStatus = ['detected', 'resolving', 'resolved', 'escalated'] as const;
export type ConflictStatus = typeof ConflictStatus[number];

// Scheduling rules table
export const schedulingRules = pgTable("scheduling_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priority: integer("priority").notNull(), // Higher number = higher priority
  conditions: jsonb("conditions").notNull(), // JSON structure defining when rule applies
  strategy: text("strategy", { enum: ResolutionStrategy }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conflict detection and resolution history
export const conflicts = pgTable("conflicts", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ConflictType }).notNull(),
  status: text("status", { enum: ConflictStatus }).notNull().default('detected'),
  affectedShiftIds: integer("affected_shift_ids").array(),
  affectedUserIds: integer("affected_user_ids").array(),
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolutionDetails: jsonb("resolution_details"),
  appliedRuleId: integer("applied_rule_id").references(() => schedulingRules.id),
});

// Resolution attempts tracking
export const resolutionAttempts = pgTable("resolution_attempts", {
  id: serial("id").primaryKey(),
  conflictId: integer("conflict_id").references(() => conflicts.id),
  strategy: text("strategy", { enum: ResolutionStrategy }).notNull(),
  successful: boolean("successful").notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow(),
  details: jsonb("details"),
});

// Add relations
export const schedulingRulesRelations = relations(schedulingRules, ({ many }) => ({
  conflicts: many(conflicts),
}));

export const conflictsRelations = relations(conflicts, ({ one, many }) => ({
  rule: one(schedulingRules, {
    fields: [conflicts.appliedRuleId],
    references: [schedulingRules.id],
  }),
  resolutionAttempts: many(resolutionAttempts),
}));

// Add new types
export type SchedulingRule = InferModel<typeof schedulingRules>;
export type Conflict = InferModel<typeof conflicts>;
export type ResolutionAttempt = InferModel<typeof resolutionAttempts>;

// Add new schemas
export const insertSchedulingRuleSchema = createInsertSchema(schedulingRules);
export const selectSchedulingRuleSchema = createSelectSchema(schedulingRules);

export const insertConflictSchema = createInsertSchema(conflicts);
export const selectConflictSchema = createSelectSchema(conflicts);

export const insertResolutionAttemptSchema = createInsertSchema(resolutionAttempts);
export const selectResolutionAttemptSchema = createSelectSchema(resolutionAttempts);