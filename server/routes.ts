import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { Router } from "express";
import { z } from "zod";
import { incomeSchema, expenseSchema, assetSchema, liabilitySchema, goalSchema } from "@shared/schema";
import { authenticateToken, AuthRequest, hashPassword, login } from "./auth";
import { generateToken } from "./auth";
import { generateFinancialAdvice } from './ai-assistant';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import jwt from 'jsonwebtoken';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Verify environment variables are loaded
const requiredEnvVars = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
};

console.log('Environment variables loaded:', requiredEnvVars);

// Validate required environment variables
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const router = Router();

// Initialize Google OAuth client with validated credentials
const oauth2Client = new OAuth2Client(
  requiredEnvVars.GOOGLE_CLIENT_ID,
  requiredEnvVars.GOOGLE_CLIENT_SECRET,
  requiredEnvVars.GOOGLE_REDIRECT_URI
);

// Google OAuth routes
router.get("/auth/google/url", async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Google OAuth configuration is missing');
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      prompt: 'consent'
    });

    res.json({ url });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate Google OAuth URL' });
  }
});

router.get("/auth/google/callback", async (req, res) => {
  try {
    console.log('Google OAuth callback received');
    const { code } = req.query;
    if (!code) {
      throw new Error('No authorization code received');
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Google OAuth configuration is missing');
    }

    console.log('Exchanging code for tokens...');
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    console.log('Verifying ID token...');
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    const { sub: googleId, email, name, picture } = payload;
    if (!email) {
      throw new Error('Email is required from Google OAuth');
    }

    console.log('Google user data:', { googleId, email, name, picture });

    // Ensure the picture URL is complete
    const pictureUrl = picture ?
      (picture.startsWith('http') ? picture : `https://${picture}`) :
      undefined;

    // Find or create user
    console.log('Looking for existing user with Google ID:', googleId);
    let user = await storage.getUserByGoogleId(googleId);

    if (!user) {
      console.log('No existing user found, creating new user...');
      // Create new user
      const username = email.split('@')[0] || `user_${Date.now()}`;
      user = await storage.createGoogleUser({
        username,
        email,
        googleId,
        googleName: name,
        googlePicture: pictureUrl
      });
      console.log('New user created:', user);
    } else {
      console.log('Existing user found:', user);
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, username: user.username });
    console.log('Generated JWT token for user:', user.id);

    // Update last login
    console.log('Updating last login for user:', user.id);
    await storage.updateUser(user.id, { lastLogin: new Date() });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log('Redirecting to frontend:', `${frontendUrl}/auth/callback?token=${token}`);
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth?error=google_auth_failed`);
  }
});

// Auth routes
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await hashPassword(password);
    const user = await storage.createUser({ username, password: hashedPassword, email });

    // Generate token and return user info in the same format as login
    const token = generateToken({ id: user.id, username: user.username });
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await login(username, password);
    res.json(result);
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  }
});

// Protected routes
router.use(authenticateToken);

// User routes
router.get("/users/me", async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Income routes
router.get("/incomes", async (req: AuthRequest, res) => {
  try {
    const incomes = await storage.getAllIncomes(req.user!.id);
    res.json(incomes);
  } catch (error) {
    res.status(500).json({ error: "Failed to get incomes" });
  }
});

router.get("/incomes/:id", async (req: AuthRequest, res) => {
  try {
    const income = await storage.getIncome(req.params.id, req.user!.id);
    if (!income) {
      return res.status(404).json({ error: "Income not found" });
    }
    res.json(income);
  } catch (error) {
    res.status(500).json({ error: "Failed to get income" });
  }
});

router.post("/incomes", async (req: AuthRequest, res) => {
  try {
    console.log('POST /incomes - Request body:', req.body);
    console.log('POST /incomes - User ID:', req.user?.id);
    const validatedData = incomeSchema.omit({ id: true, createdAt: true }).parse({
      ...req.body,
      userId: req.user!.id,
    });
    console.log('POST /incomes - Validated data:', validatedData);
    const income = await storage.createIncome(validatedData);
    console.log('POST /incomes - Created income:', income);
    res.json(income);
  } catch (error) {
    console.error("Error creating income:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create income" });
    }
  }
});

router.put("/incomes", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /incomes - Request method:', req.method);
    console.log('PUT /incomes - Request body:', req.body);
    console.log('PUT /incomes - User ID:', req.user?.id);
    const incomes = req.body;
    const userId = req.user!.id;

    await Promise.all(incomes.map(async (income: any) => {
      console.log('Processing income:', income);
      if (income.id) {
        console.log('Updating income:', income.id);
        await storage.updateIncome(income.id, {
          source: income.source,
          category: income.category,
          amount: income.amount,
          type: income.type,
          frequency: income.frequency,
          notes: income.notes
        }, userId);
      } else {
        console.log('Creating new income via PUT (should be using POST)');
        await storage.createIncome({
          userId,
          source: income.source,
          category: income.category,
          amount: income.amount,
          type: income.type,
          frequency: income.frequency,
          notes: income.notes
        });
      }
    }));

    const updatedIncomes = await storage.getAllIncomes(userId);
    console.log('Updated incomes:', updatedIncomes);
    res.json(updatedIncomes);
  } catch (error) {
    console.error("Error syncing incomes:", error);
    res.status(500).json({ error: "Failed to sync incomes" });
  }
});

router.delete("/incomes/:id", async (req: AuthRequest, res) => {
  try {
    await storage.deleteIncome(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete income" });
  }
});

// Expense routes
router.get("/expenses", async (req: AuthRequest, res) => {
  try {
    const expenses = await storage.getAllExpenses(req.user!.id);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: "Failed to get expenses" });
  }
});

router.get("/expenses/:id", async (req: AuthRequest, res) => {
  try {
    const expense = await storage.getExpense(req.params.id, req.user!.id);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to get expense" });
  }
});

router.post("/expenses", async (req: AuthRequest, res) => {
  try {
    console.log('POST /expenses - Request body:', req.body);
    const expenseData = {
      ...req.body,
      userId: req.user!.id,
      date: new Date(req.body.date)
    };
    delete expenseData.notes; // Remove notes field

    const validatedData = expenseSchema.omit({ id: true, createdAt: true }).parse(expenseData);
    const expense = await storage.createExpense(validatedData);
    res.json(expense);
  } catch (error) {
    console.error("Error creating expense:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create expense" });
    }
  }
});

router.put("/expenses", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /expenses - Request body:', req.body);
    console.log('User ID:', req.user?.id);
    const expenses = req.body;
    const userId = req.user!.id;

    await Promise.all(expenses.map(async (expense: any) => {
      console.log('Processing expense:', expense);
      const expenseData = {
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        date: new Date(expense.date)
      };

      if (expense.id) {
        console.log('Updating expense:', expense.id);
        await storage.updateExpense(expense.id, expenseData, userId);
      } else {
        console.log('Creating new expense');
        await storage.createExpense({
          userId,
          ...expenseData
        });
      }
    }));

    const updatedExpenses = await storage.getAllExpenses(userId);
    console.log('Updated expenses:', updatedExpenses);
    res.json(updatedExpenses);
  } catch (error) {
    console.error("Error syncing expenses:", error);
    res.status(500).json({ error: "Failed to sync expenses" });
  }
});

router.delete("/expenses/:id", async (req: AuthRequest, res) => {
  try {
    await storage.deleteExpense(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// Asset routes
router.get("/assets", async (req: AuthRequest, res) => {
  try {
    const assets = await storage.getAllAssets(req.user!.id);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: "Failed to get assets" });
  }
});

router.get("/assets/:id", async (req: AuthRequest, res) => {
  try {
    const asset = await storage.getAsset(req.params.id, req.user!.id);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: "Failed to get asset" });
  }
});

router.post("/assets", async (req: AuthRequest, res) => {
  try {
    const validatedData = assetSchema.omit({ id: true, createdAt: true }).parse({
      ...req.body,
      userId: req.user!.id,
    });
    const asset = await storage.createAsset(validatedData);
    res.json(asset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create asset" });
    }
  }
});

router.put("/assets", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /assets - Request body:', req.body);
    console.log('User ID:', req.user?.id);
    const assets = req.body;
    const userId = req.user!.id;

    await Promise.all(assets.map(async (asset: any) => {
      console.log('Processing asset:', asset);
      if (asset.id) {
        console.log('Updating asset:', asset.id);
        await storage.updateAsset(asset.id, {
          name: asset.name,
          category: asset.category,
          value: asset.value,
          incomeGenerated: asset.incomeGenerated,
          notes: asset.notes
        }, userId);
      } else {
        console.log('Creating new asset');
        await storage.createAsset({
          userId,
          name: asset.name,
          category: asset.category,
          value: asset.value,
          incomeGenerated: asset.incomeGenerated,
          notes: asset.notes
        });
      }
    }));

    const updatedAssets = await storage.getAllAssets(userId);
    console.log('Updated assets:', updatedAssets);
    res.json(updatedAssets);
  } catch (error) {
    console.error("Error syncing assets:", error);
    res.status(500).json({ error: "Failed to sync assets" });
  }
});

router.delete("/assets/:id", async (req: AuthRequest, res) => {
  try {
    await storage.deleteAsset(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

// Liability routes
router.get("/liabilities", async (req: AuthRequest, res) => {
  try {
    const liabilities = await storage.getAllLiabilities(req.user!.id);
    res.json(liabilities);
  } catch (error) {
    res.status(500).json({ error: "Failed to get liabilities" });
  }
});

router.get("/liabilities/:id", async (req: AuthRequest, res) => {
  try {
    const liability = await storage.getLiability(req.params.id, req.user!.id);
    if (!liability) {
      return res.status(404).json({ error: "Liability not found" });
    }
    res.json(liability);
  } catch (error) {
    res.status(500).json({ error: "Failed to get liability" });
  }
});

router.post("/liabilities", async (req: AuthRequest, res) => {
  try {
    console.log('POST /liabilities - Request body:', req.body);
    console.log('POST /liabilities - User ID:', req.user?.id);

    if (!req.user?.id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const liabilityData = {
      ...req.body,
      userId: req.user.id,
      amount: Number(req.body.amount),
      interestRate: Number(req.body.interestRate)
    };

    console.log('POST /liabilities - Processed data:', liabilityData);

    const validatedData = liabilitySchema.omit({ id: true, createdAt: true }).parse(liabilityData);
    console.log('POST /liabilities - Validated data:', validatedData);

    const liability = await storage.createLiability(validatedData);
    console.log('POST /liabilities - Created liability:', liability);

    res.json(liability);
  } catch (error) {
    console.error('Error creating liability:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create liability" });
  }
});

router.put("/liabilities", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /liabilities - Request body:', req.body);
    console.log('User ID:', req.user?.id);

    // Handle both single liability and array of liabilities
    const liabilities = Array.isArray(req.body) ? req.body : [req.body];
    const userId = req.user!.id;

    await Promise.all(liabilities.map(async (liability: any) => {
      console.log('Processing liability:', liability);
      if (liability.id) {
        console.log('Updating liability:', liability.id);
        await storage.updateLiability(liability.id, {
          description: liability.description,
          type: liability.type,
          amount: Number(liability.amount),
          interestRate: Number(liability.interestRate),
          notes: liability.notes
        }, userId);
      } else {
        console.log('Creating new liability');
        await storage.createLiability({
          userId,
          description: liability.description,
          type: liability.type,
          amount: Number(liability.amount),
          interestRate: Number(liability.interestRate),
          notes: liability.notes
        });
      }
    }));

    const updatedLiabilities = await storage.getAllLiabilities(userId);
    console.log('Updated liabilities:', updatedLiabilities);
    res.json(updatedLiabilities);
  } catch (error) {
    console.error("Error syncing liabilities:", error);
    res.status(500).json({ error: "Failed to sync liabilities" });
  }
});

router.delete("/liabilities/:id", async (req: AuthRequest, res) => {
  try {
    await storage.deleteLiability(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete liability" });
  }
});

// Goal routes
router.get("/goals", async (req: AuthRequest, res) => {
  try {
    const goals = await storage.getAllGoals(req.user!.id);
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: "Failed to get goals" });
  }
});

router.get("/goals/:id", async (req: AuthRequest, res) => {
  try {
    const goal = await storage.getGoal(req.params.id, req.user!.id);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    res.json(goal);
  } catch (error) {
    res.status(500).json({ error: "Failed to get goal" });
  }
});

router.post("/goals", async (req: AuthRequest, res) => {
  try {
    console.log('POST /goals - Request body:', req.body);
    const goalData = {
      ...req.body,
      userId: req.user!.id,
      targetDate: new Date(req.body.targetDate),
      targetAmount: Number(req.body.targetAmount),
      currentAmount: Number(req.body.currentAmount)
    };

    const validatedData = goalSchema.omit({ id: true, createdAt: true }).parse(goalData);
    const goal = await storage.createGoal(validatedData);
    res.json(goal);
  } catch (error) {
    console.error('Error creating goal:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create goal" });
    }
  }
});

router.put("/goals", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /goals - Request body:', req.body);
    console.log('User ID:', req.user?.id);
    const goals = req.body;
    const userId = req.user!.id;

    await Promise.all(goals.map(async (goal: any) => {
      console.log('Processing goal:', goal);
      if (goal.id) {
        console.log('Updating goal:', goal.id);
        await storage.updateGoal(goal.id, {
          description: goal.description,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          targetDate: new Date(goal.targetDate)
        }, userId);
      } else {
        console.log('Creating new goal');
        await storage.createGoal({
          userId,
          description: goal.description,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          targetDate: new Date(goal.targetDate)
        });
      }
    }));

    const updatedGoals = await storage.getAllGoals(userId);
    console.log('Updated goals:', updatedGoals);
    res.json(updatedGoals);
  } catch (error) {
    console.error("Error syncing goals:", error);
    res.status(500).json({ error: "Failed to sync goals" });
  }
});

router.delete("/goals/:id", async (req: AuthRequest, res) => {
  try {
    await storage.deleteGoal(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

// AI Assistant endpoint
router.post("/ai/assist", authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('AI Assistant Request:', req.body);
    const advice = generateFinancialAdvice(req.body);
    console.log('AI Assistant Response:', advice);
    res.json({ advice });
  } catch (error) {
    console.error("Error generating financial advice:", error);
    res.status(500).json({ error: "Failed to generate financial advice" });
  }
});

// Test endpoint
router.post('/test', (req, res) => {
  console.log('Test endpoint hit:', req.body);
  res.json({ success: true, message: 'Test endpoint reached' });
});

// AI Chat endpoint
router.post('/ai/chat', authenticateToken, async (req: AuthRequest, res) => {
  console.log('AI Chat endpoint hit');
  try {
    console.log('AI Chat Request:', req.body);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user's financial data for context
    const userId = req.user!.id;
    const [incomes, expenses, assets, liabilities, goals] = await Promise.all([
      storage.getAllIncomes(userId),
      storage.getAllExpenses(userId),
      storage.getAllAssets(userId),
      storage.getAllLiabilities(userId),
      storage.getAllGoals(userId)
    ]);

    // Create context from user's financial data
    const financialContext = createFinancialContext(incomes, expenses, assets, liabilities, goals);

    console.log('Sending prompt to OpenRouter API');

    // Use OpenRouter API with Llama 4 Maverick model
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://balancesheettracker.com", // Replace with your actual domain
          "X-Title": "Balance Sheet Tracker"
        },
        method: "POST",
        body: JSON.stringify({
          model: "meta-llama/llama-4-maverick:free",
          messages: [
            {
              role: "system",
              content: "You are a financial advisor AI assistant. Your role is to provide personalized financial advice based on the user's financial data. Always give specific, actionable advice that relates to the user's actual financial situation. If the user asks a general question, still try to relate it to their specific financial data when possible."
            },
            {
              role: "user",
              content: `Here is my financial data:\n\n${financialContext}\n\nMy question is: ${message}\n\nPlease provide personalized advice based on my financial situation.`
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API Error:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouter Response:', data);

    // Extract the generated text from the response
    let generatedText = 'I apologize, but I encountered an error generating a response.';

    if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
      generatedText = data.choices[0].message.content;
    }

    // Clean up the response
    generatedText = generatedText.trim();

    // Ensure we're sending a proper JSON response
    const responseData = {
      response: generatedText,
      success: true
    };

    console.log('Sending response to client:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('AI Chat Error:', error);
    // Send a more detailed error response
    res.status(500).json({
      error: 'Failed to generate AI response',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
});

// Test endpoint for AI chat
router.get('/ai/test', authenticateToken, async (req: AuthRequest, res) => {
  console.log('AI Test endpoint hit');
  try {
    // Hardcoded test question
    const testQuestion = "How can I increase my assets?";
    console.log('Test question:', testQuestion);

    // Get user's financial data for context
    const userId = req.user!.id;
    const [incomes, expenses, assets, liabilities, goals] = await Promise.all([
      storage.getAllIncomes(userId),
      storage.getAllExpenses(userId),
      storage.getAllAssets(userId),
      storage.getAllLiabilities(userId),
      storage.getAllGoals(userId)
    ]);

    // Create context from user's financial data
    const financialContext = createFinancialContext(incomes, expenses, assets, liabilities, goals);

    console.log('Sending test request to OpenRouter API');

    // Use OpenRouter API with Llama 4 Maverick model
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://balancesheettracker.com",
          "X-Title": "Balance Sheet Tracker"
        },
        method: "POST",
        body: JSON.stringify({
          model: "meta-llama/llama-4-maverick:free",
          messages: [
            {
              role: "system",
              content: "You are a financial advisor AI assistant. Your role is to provide personalized financial advice based on the user's financial data. Always give specific, actionable advice that relates to the user's actual financial situation. If the user asks a general question, still try to relate it to their specific financial data when possible."
            },
            {
              role: "user",
              content: `Here is my financial data:\n\n${financialContext}\n\nMy question is: ${testQuestion}\n\nPlease provide personalized advice based on my financial situation.`
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API Error:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouter Test Response:', JSON.stringify(data, null, 2));

    // Extract the generated text from the response
    let generatedText = 'I apologize, but I encountered an error generating a response.';

    if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
      generatedText = data.choices[0].message.content;
    }

    // Clean up the response
    generatedText = generatedText.trim();

    console.log('AI Test Response:', generatedText);

    // Return the response
    res.json({
      question: testQuestion,
      response: generatedText,
      success: true
    });
  } catch (error) {
    console.error('AI Test Error:', error);
    res.status(500).json({
      error: 'Failed to generate AI response',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
});

// Helper function to create financial context
function createFinancialContext(incomes: any[], expenses: any[], assets: any[], liabilities: any[], goals: any[]): string {
  const context = [];

  // Add income information
  if (incomes.length > 0) {
    context.push('INCOMES:');
    incomes.forEach(income => {
      context.push(`- ${income.source}: $${income.amount} (${income.frequency})`);
    });
  }

  // Add expense information
  if (expenses.length > 0) {
    context.push('\nEXPENSES:');
    expenses.forEach(expense => {
      context.push(`- ${expense.category}: $${expense.amount}`);
    });
  }

  // Add asset information
  if (assets.length > 0) {
    context.push('\nASSETS:');
    assets.forEach(asset => {
      context.push(`- ${asset.name}: $${asset.value}`);
    });
  }

  // Add liability information
  if (liabilities.length > 0) {
    context.push('\nLIABILITIES:');
    liabilities.forEach(liability => {
      context.push(`- ${liability.description}: $${liability.amount}`);
    });
  }

  // Add goal information
  if (goals.length > 0) {
    context.push('\nGOALS:');
    goals.forEach(goal => {
      context.push(`- ${goal.description}: $${goal.currentAmount} / $${goal.targetAmount}`);
    });
  }

  return context.join('\n');
}

export const registerRoutes = async (app: Express): Promise<Server> => {
  app.use("/api", router);
  return createServer(app);
};

export default router;
