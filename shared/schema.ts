import { pgTable, text, serial, integer, boolean, numeric, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),
  email: text("email").notNull().unique(),
  googleId: text("google_id").unique(),
  googleName: text("google_name"),
  googlePicture: text("google_picture"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  googleId: true,
  googleName: true,
  googlePicture: true,
  lastLogin: true,
});

// Drizzle table definitions
export const incomes = pgTable("incomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id),
  source: text("source").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount").notNull(),
  type: text("type", { enum: ["active", "passive"] }).notNull(),
  frequency: text("frequency", { enum: ["monthly", "bi-weekly", "weekly", "annually", "one-time"] }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id),
  category: text("category").notNull(),
  amount: numeric("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  value: numeric("value").notNull(),
  incomeGenerated: numeric("income_generated").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const liabilities = pgTable("liabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount").notNull(),
  interestRate: numeric("interest_rate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  targetAmount: numeric("target_amount").notNull(),
  currentAmount: numeric("current_amount").notNull(),
  targetDate: date("target_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const incomeSchema = z.object({
  id: z.string(),
  userId: z.number(),
  source: z.string(),
  category: z.string(),
  amount: z.number(),
  type: z.enum(["active", "passive"]),
  frequency: z.enum(["monthly", "bi-weekly", "weekly", "annually", "one-time"]),
  notes: z.string().optional(),
  createdAt: z.date(),
});

export const expenseSchema = z.object({
  id: z.string(),
  userId: z.number(),
  category: z.string(),
  amount: z.number(),
  description: z.string(),
  date: z.date(),
  notes: z.string().optional(),
  createdAt: z.date(),
});

export const insertIncomeSchema = incomeSchema.omit({ id: true, createdAt: true });
export const insertExpenseSchema = expenseSchema.omit({ id: true, createdAt: true });

export const assetSchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  name: z.string().min(1, { message: "Asset name is required" }),
  category: z.string().min(1, { message: "Category is required" }),
  value: z.number().min(0, { message: "Value must be non-negative" }),
  incomeGenerated: z.number().min(0, { message: "Income must be non-negative" }),
  notes: z.string().optional(),
  createdAt: z.date()
});

export const liabilitySchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  description: z.string().min(1, { message: "Description is required" }),
  type: z.string().min(1, { message: "Type is required" }),
  amount: z.number().min(0, { message: "Amount must be non-negative" }),
  interestRate: z.number().min(0, { message: "Interest rate must be non-negative" }),
  notes: z.string().optional(),
  createdAt: z.date()
});

export const goalSchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  description: z.string().min(1, { message: "Description is required" }),
  targetAmount: z.number().min(0, { message: "Target amount must be non-negative" }),
  currentAmount: z.number().min(0, { message: "Current amount must be non-negative" }),
  targetDate: z.date(),
  createdAt: z.date()
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Income = z.infer<typeof incomeSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Liability = z.infer<typeof liabilitySchema>;
export type Goal = z.infer<typeof goalSchema>;
