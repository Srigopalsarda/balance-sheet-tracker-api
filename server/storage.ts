import { users, incomes, expenses, assets, liabilities, goals, type User, type InsertUser, type Income, type Expense, type Asset, type Liability, type Goal } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// User storage interface
export interface IUserStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createGoogleUser(userData: {
    username: string;
    email: string;
    googleId: string;
    googleName?: string;
    googlePicture?: string;
  }): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<void>;
}

// Income storage interface
export interface IIncomeStorage {
  getAllIncomes(userId: number): Promise<Income[]>;
  getIncome(id: string, userId: number): Promise<Income | undefined>;
  createIncome(income: Omit<Income, "id" | "createdAt">): Promise<Income>;
  updateIncome(id: string, income: Partial<Omit<Income, "id" | "createdAt">>, userId: number): Promise<void>;
  deleteIncome(id: string, userId: number): Promise<void>;
}

// Expense storage interface
export interface IExpenseStorage {
  getAllExpenses(userId: number): Promise<Expense[]>;
  getExpense(id: string, userId: number): Promise<Expense | undefined>;
  createExpense(expense: Omit<Expense, "id" | "createdAt">): Promise<Expense>;
  updateExpense(id: string, expense: Partial<Omit<Expense, "id" | "createdAt">>, userId: number): Promise<void>;
  deleteExpense(id: string, userId: number): Promise<void>;
}

// Asset storage interface
export interface IAssetStorage {
  getAllAssets(userId: number): Promise<Asset[]>;
  getAsset(id: string, userId: number): Promise<Asset | undefined>;
  createAsset(asset: Omit<Asset, "id" | "createdAt">): Promise<Asset>;
  updateAsset(id: string, asset: Partial<Omit<Asset, "id" | "createdAt">>, userId: number): Promise<void>;
  deleteAsset(id: string, userId: number): Promise<void>;
}

// Liability storage interface
export interface ILiabilityStorage {
  getAllLiabilities(userId: number): Promise<Liability[]>;
  getLiability(id: string, userId: number): Promise<Liability | undefined>;
  createLiability(liability: Omit<Liability, "id" | "createdAt">): Promise<Liability>;
  updateLiability(id: string, liability: Partial<Omit<Liability, "id" | "createdAt">>, userId: number): Promise<void>;
  deleteLiability(id: string, userId: number): Promise<void>;
}

// Goal storage interface
export interface IGoalStorage {
  getAllGoals(userId: number): Promise<Goal[]>;
  getGoal(id: string, userId: number): Promise<Goal | undefined>;
  createGoal(goal: Omit<Goal, "id" | "createdAt">): Promise<Goal>;
  updateGoal(id: string, goal: Partial<Omit<Goal, "id" | "createdAt">>, userId: number): Promise<void>;
  deleteGoal(id: string, userId: number): Promise<void>;
}

// Combined storage interface
export interface IStorage extends IUserStorage, IIncomeStorage, IExpenseStorage, IAssetStorage, ILiabilityStorage, IGoalStorage {}

// PostgreSQL implementation
export class PostgresStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    console.log('Getting user:', id);
    const result = await db.select().from(users).where(eq(users.id, id));
    console.log('User result:', result);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log('Getting user by username:', username);
    const result = await db.select().from(users).where(eq(users.username, username));
    console.log('User by username result:', result);
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    console.log('Getting user by Google ID:', googleId);
    const result = await db.select().from(users).where(eq(users.googleId, googleId));
    console.log('User by Google ID result:', result);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    console.log('Creating user:', insertUser);
    const result = await db.insert(users).values(insertUser).returning();
    console.log('Create user result:', result);
    return result[0];
  }

  async createGoogleUser(userData: {
    username: string;
    email: string;
    googleId: string;
    googleName?: string;
    googlePicture?: string;
  }): Promise<User> {
    try {
      console.log('Creating Google user with data:', userData);
      // Ensure the picture URL is complete
      const pictureUrl = userData.googlePicture ? 
        (userData.googlePicture.startsWith('http') ? userData.googlePicture : `https://${userData.googlePicture}`) : 
        undefined;
      
      const now = new Date();
      const userToCreate = {
        ...userData,
        googlePicture: pictureUrl,
        password: null,
        createdAt: now,
        lastLogin: now
      };
      
      console.log('Attempting to create user with data:', userToCreate);
      const result = await db.insert(users).values(userToCreate).returning();
      console.log('Create Google user result:', result);
      
      if (!result[0]) {
        throw new Error('Failed to create user - no result returned');
      }
      
      return result[0];
    } catch (error) {
      console.error('Error in createGoogleUser:', error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<void> {
    console.log('Updating user:', { id, userData });
    await db.update(users)
      .set(userData)
      .where(eq(users.id, id));
  }

  // Income methods
  async getAllIncomes(userId: number): Promise<Income[]> {
    console.log('=== Income Storage: Getting all incomes ===');
    console.log('User ID:', userId);
    try {
      const result = await db.select().from(incomes).where(eq(incomes.userId, userId));
      console.log('Database query result:', result);
      const mappedResult = result.map(income => ({
        ...income,
        amount: parseFloat(income.amount),
        type: income.type as "active" | "passive",
        frequency: income.frequency as "monthly" | "bi-weekly" | "weekly" | "annually" | "one-time",
        notes: income.notes ?? undefined,
        createdAt: income.createdAt ?? new Date(),
      }));
      console.log('Mapped result:', mappedResult);
      return mappedResult;
    } catch (error) {
      console.error('Error in getAllIncomes:', error);
      throw error;
    }
  }

  async getIncome(id: string, userId: number): Promise<Income | undefined> {
    console.log('=== Income Storage: Getting single income ===');
    console.log('Income ID:', id);
    console.log('User ID:', userId);
    try {
      const result = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
      
      console.log('Database query result:', result);
      
      if (!result[0]) {
        console.log('No income found with given ID');
        return undefined;
      }
      
      const mappedResult = {
        ...result[0],
        amount: parseFloat(result[0].amount),
        type: result[0].type as "active" | "passive",
        frequency: result[0].frequency as "monthly" | "bi-weekly" | "weekly" | "annually" | "one-time",
        notes: result[0].notes ?? undefined,
        createdAt: result[0].createdAt ?? new Date(),
      };
      console.log('Mapped result:', mappedResult);
      return mappedResult;
    } catch (error) {
      console.error('Error in getIncome:', error);
      throw error;
    }
  }

  async createIncome(income: Omit<Income, "id" | "createdAt">): Promise<Income> {
    console.log('=== Income Storage: Creating new income ===');
    console.log('Input income data:', income);
    
    const id = uuidv4();
    const now = new Date();
    const incomeData = {
      id,
      ...income,
      amount: income.amount.toString(),
      notes: income.notes ?? null,
      createdAt: now,
    };
    
    console.log('Prepared income data for database:', incomeData);
    
    try {
      console.log('Attempting to insert income into database...');
      const result = await db.insert(incomes).values(incomeData).returning();
      console.log('Database insert result:', result);
      
      if (!result[0]) {
        console.error('No result returned from database insert');
        throw new Error('Failed to create income - no result returned');
      }
      
      const mappedResult = {
        ...result[0],
        amount: parseFloat(result[0].amount),
        type: result[0].type as "active" | "passive",
        frequency: result[0].frequency as "monthly" | "bi-weekly" | "weekly" | "annually" | "one-time",
        notes: result[0].notes ?? undefined,
        createdAt: result[0].createdAt ?? new Date(),
      };
      console.log('Final mapped result:', mappedResult);
      return mappedResult;
    } catch (error) {
      console.error('Error in createIncome:', error);
      throw error;
    }
  }

  async updateIncome(id: string, income: Partial<Omit<Income, "id" | "createdAt">>, userId: number): Promise<void> {
    console.log('=== Income Storage: Updating income ===');
    console.log('Income ID:', id);
    console.log('Update data:', income);
    console.log('User ID:', userId);
    
    const updateData = {
      ...income,
      amount: income.amount?.toString(),
      notes: income.notes ?? null,
    };
    
    console.log('Prepared update data:', updateData);
    
    try {
      console.log('Attempting to update income in database...');
      const result = await db
        .update(incomes)
        .set(updateData)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
        .returning();
      console.log('Database update result:', result);
    } catch (error) {
      console.error('Error in updateIncome:', error);
      throw error;
    }
  }

  async deleteIncome(id: string, userId: number): Promise<void> {
    console.log('=== Income Storage: Deleting income ===');
    console.log('Income ID:', id);
    console.log('User ID:', userId);
    
    try {
      console.log('Attempting to delete income from database...');
      await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
      console.log('Income successfully deleted');
    } catch (error) {
      console.error('Error in deleteIncome:', error);
      throw error;
    }
  }

  // Expense methods
  async getAllExpenses(userId: number): Promise<Expense[]> {
    console.log('Getting all expenses for user:', userId);
    const result = await db.select().from(expenses).where(eq(expenses.userId, userId));
    console.log('All expenses result:', result);
    return result.map(expense => ({
      ...expense,
      amount: parseFloat(expense.amount),
      notes: expense.notes ?? undefined,
      createdAt: expense.createdAt ?? new Date(),
    }));
  }

  async getExpense(id: string, userId: number): Promise<Expense | undefined> {
    console.log('Getting expense:', { id, userId });
    const result = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    
    if (!result[0]) return undefined;
    
    return {
      ...result[0],
      amount: parseFloat(result[0].amount),
      notes: result[0].notes ?? undefined,
      createdAt: result[0].createdAt ?? new Date(),
    };
  }

  async createExpense(expense: Omit<Expense, "id" | "createdAt">): Promise<Expense> {
    console.log('Creating expense:', expense);
    const id = uuidv4();
    const now = new Date();
    const expenseData = {
      id,
      ...expense,
      amount: expense.amount.toString(),
      notes: expense.notes ?? null,
      createdAt: now,
    };
    try {
      const result = await db.insert(expenses).values(expenseData).returning();
      console.log('Create expense result:', result[0]);
      return {
        ...result[0],
        amount: parseFloat(result[0].amount),
        notes: result[0].notes ?? undefined,
      };
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  async updateExpense(id: string, expense: Partial<Omit<Expense, "id" | "createdAt">>, userId: number): Promise<void> {
    console.log('Updating expense:', { id, expense, userId });
    const updateData = {
      ...expense,
      amount: expense.amount?.toString(),
      notes: expense.notes ?? null,
    };
    try {
      const result = await db
        .update(expenses)
        .set(updateData)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning();
      console.log('Update expense result:', result);
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(id: string, userId: number): Promise<void> {
    console.log('Deleting expense:', { id, userId });
    try {
      await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
      console.log('Expense deleted successfully');
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  // Asset methods
  async getAllAssets(userId: number): Promise<Asset[]> {
    console.log('Getting all assets for user:', userId);
    const result = await db.select().from(assets).where(eq(assets.userId, userId));
    console.log('All assets result:', result);
    return result.map(asset => ({
      ...asset,
      value: parseFloat(asset.value),
      incomeGenerated: parseFloat(asset.incomeGenerated),
      notes: asset.notes ?? undefined,
      createdAt: asset.createdAt ?? new Date(),
    }));
  }

  async getAsset(id: string, userId: number): Promise<Asset | undefined> {
    console.log('Getting asset:', { id, userId });
    const result = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)));
    
    if (!result[0]) return undefined;
    
    return {
      ...result[0],
      value: parseFloat(result[0].value),
      incomeGenerated: parseFloat(result[0].incomeGenerated),
      notes: result[0].notes ?? undefined,
      createdAt: result[0].createdAt ?? new Date(),
    };
  }

  async createAsset(asset: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
    console.log('Creating asset:', asset);
    const id = uuidv4();
    const now = new Date();
    const assetData = {
      id,
      ...asset,
      value: asset.value.toString(),
      incomeGenerated: asset.incomeGenerated.toString(),
      notes: asset.notes ?? null,
      createdAt: now,
    };
    try {
      const result = await db.insert(assets).values(assetData).returning();
      console.log('Create asset result:', result[0]);
      return {
        ...result[0],
        value: parseFloat(result[0].value),
        incomeGenerated: parseFloat(result[0].incomeGenerated),
        notes: result[0].notes ?? undefined,
      };
    } catch (error) {
      console.error('Error creating asset:', error);
      throw error;
    }
  }

  async updateAsset(id: string, asset: Partial<Omit<Asset, "id" | "createdAt">>, userId: number): Promise<void> {
    console.log('Updating asset:', { id, asset, userId });
    const updateData = {
      ...asset,
      value: asset.value?.toString(),
      incomeGenerated: asset.incomeGenerated?.toString(),
      notes: asset.notes ?? null,
    };
    try {
      const result = await db
        .update(assets)
        .set(updateData)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .returning();
      console.log('Update asset result:', result);
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    }
  }

  async deleteAsset(id: string, userId: number): Promise<void> {
    console.log('Deleting asset:', { id, userId });
    try {
      await db.delete(assets).where(and(eq(assets.id, id), eq(assets.userId, userId)));
      console.log('Asset deleted successfully');
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw error;
    }
  }

  // Liability methods
  async getAllLiabilities(userId: number): Promise<Liability[]> {
    console.log('Getting all liabilities for user:', userId);
    const result = await db.select().from(liabilities).where(eq(liabilities.userId, userId));
    console.log('All liabilities result:', result);
    return result.map(liability => ({
      ...liability,
      amount: parseFloat(liability.amount),
      interestRate: parseFloat(liability.interestRate),
      notes: liability.notes ?? undefined,
      createdAt: liability.createdAt ?? new Date(),
    }));
  }

  async getLiability(id: string, userId: number): Promise<Liability | undefined> {
    console.log('Getting liability:', { id, userId });
    const result = await db
      .select()
      .from(liabilities)
      .where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)));
    
    if (!result[0]) return undefined;
    
    return {
      ...result[0],
      amount: parseFloat(result[0].amount),
      interestRate: parseFloat(result[0].interestRate),
      notes: result[0].notes ?? undefined,
      createdAt: result[0].createdAt ?? new Date(),
    };
  }

  async createLiability(liability: Omit<Liability, "id" | "createdAt">): Promise<Liability> {
    console.log('Creating liability:', liability);
    const id = uuidv4();
    const now = new Date();
    const liabilityData = {
      id,
      ...liability,
      amount: liability.amount.toString(),
      interestRate: liability.interestRate.toString(),
      notes: liability.notes ?? null,
      createdAt: now,
    };
    
    const result = await db.insert(liabilities).values(liabilityData).returning();
    if (!result[0]) throw new Error("Failed to create liability");
    
    return {
      ...result[0],
      amount: parseFloat(result[0].amount),
      interestRate: parseFloat(result[0].interestRate),
      notes: result[0].notes ?? undefined,
      createdAt: result[0].createdAt ?? new Date(),
    };
  }

  async updateLiability(id: string, liability: Partial<Omit<Liability, "id" | "createdAt">>, userId: number): Promise<void> {
    console.log('Updating liability:', { id, liability, userId });
    const updateData = {
      ...liability,
      amount: liability.amount?.toString(),
      interestRate: liability.interestRate?.toString(),
      notes: liability.notes ?? null,
    };
    try {
      const result = await db
        .update(liabilities)
        .set(updateData)
        .where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)))
        .returning();
      console.log('Update liability result:', result);
    } catch (error) {
      console.error('Error updating liability:', error);
      throw error;
    }
  }

  async deleteLiability(id: string, userId: number): Promise<void> {
    console.log('Deleting liability:', { id, userId });
    try {
      await db.delete(liabilities).where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)));
      console.log('Liability deleted successfully');
    } catch (error) {
      console.error('Error deleting liability:', error);
      throw error;
    }
  }

  // Goal methods
  async getAllGoals(userId: number): Promise<Goal[]> {
    console.log('Getting all goals for user:', userId);
    const result = await db.select().from(goals).where(eq(goals.userId, userId));
    console.log('All goals result:', result);
    return result.map(goal => ({
      ...goal,
      targetAmount: parseFloat(goal.targetAmount),
      currentAmount: parseFloat(goal.currentAmount),
      targetDate: new Date(goal.targetDate),
      createdAt: goal.createdAt ?? new Date(),
    }));
  }

  async getGoal(id: string, userId: number): Promise<Goal | undefined> {
    console.log('Getting goal:', { id, userId });
    const result = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));
    
    if (!result[0]) return undefined;
    
    return {
      ...result[0],
      targetAmount: parseFloat(result[0].targetAmount),
      currentAmount: parseFloat(result[0].currentAmount),
      targetDate: new Date(result[0].targetDate),
      createdAt: result[0].createdAt ?? new Date(),
    };
  }

  async createGoal(goal: Omit<Goal, "id" | "createdAt">): Promise<Goal> {
    console.log('Creating goal:', goal);
    const id = uuidv4();
    const now = new Date();
    const goalData = {
      id,
      ...goal,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      targetDate: goal.targetDate.toISOString(),
      createdAt: now,
    };
    try {
      const result = await db.insert(goals).values(goalData).returning();
      console.log('Create goal result:', result[0]);
      return {
        ...result[0],
        targetAmount: parseFloat(result[0].targetAmount),
        currentAmount: parseFloat(result[0].currentAmount),
        targetDate: new Date(result[0].targetDate),
      };
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }

  async updateGoal(id: string, goal: Partial<Omit<Goal, "id" | "createdAt">>, userId: number): Promise<void> {
    console.log('Updating goal:', { id, goal, userId });
    const updateData = {
      ...goal,
      targetAmount: goal.targetAmount?.toString(),
      currentAmount: goal.currentAmount?.toString(),
      targetDate: goal.targetDate?.toISOString(),
    };
    try {
      const result = await db
        .update(goals)
        .set(updateData)
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .returning();
      console.log('Update goal result:', result);
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  }

  async deleteGoal(id: string, userId: number): Promise<void> {
    console.log('Deleting goal:', { id, userId });
    try {
      await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
      console.log('Goal deleted successfully');
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  }
}

export const storage = new PostgresStorage();
