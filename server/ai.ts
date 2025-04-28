import { Router } from 'express';
import { authenticateToken, AuthRequest } from './auth';
import { IStorage } from './storage';

export function createAIRouter(storage: IStorage) {
  const router = Router();

  router.post('/assist', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { query, userData } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user's financial data from the database
      const [incomes, expenses, assets, liabilities, goals] = await Promise.all([
        storage.getAllIncomes(userId),
        storage.getAllExpenses(userId),
        storage.getAllAssets(userId),
        storage.getAllLiabilities(userId),
        storage.getAllGoals(userId),
      ]);

      // Calculate financial metrics
      const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalAssets = assets.reduce((sum, asset) => sum + parseFloat(asset.value.toString()), 0);
      const totalLiabilities = liabilities.reduce((sum, liability) => sum + parseFloat(liability.amount.toString()), 0);
      const netWorth = totalAssets - totalLiabilities;
      const monthlyCashFlow = totalIncome - totalExpenses;

      // Generate personalized financial advice based on the query and user's data
      let advice = '';

      if (query.toLowerCase().includes('reduce expense')) {
        const topExpenses = expenses
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3);
        
        advice = `Here are some suggestions to reduce your expenses:\n\n`;
        advice += `1. Your top expenses are:\n`;
        topExpenses.forEach(expense => {
          advice += `   - ${expense.description}: $${expense.amount}\n`;
        });
        advice += `\n2. Consider setting a budget for these categories and tracking your spending.\n`;
        advice += `3. Look for ways to reduce recurring expenses, such as negotiating bills or finding cheaper alternatives.\n`;
      } else if (query.toLowerCase().includes('increase asset')) {
        advice = `Here are some strategies to increase your assets:\n\n`;
        advice += `1. Your current total assets: $${totalAssets}\n`;
        advice += `2. Consider diversifying your investments across different asset classes.\n`;
        advice += `3. Look for opportunities to increase your income, which can be used to acquire more assets.\n`;
        advice += `4. Focus on appreciating assets like stocks, real estate, or business investments.\n`;
      } else if (query.toLowerCase().includes('pay off liability')) {
        const sortedLiabilities = liabilities
          .sort((a, b) => parseFloat(b.amount.toString()) - parseFloat(a.amount.toString()));
        
        advice = `Here's a strategy to pay off your liabilities:\n\n`;
        advice += `1. Your total liabilities: $${totalLiabilities}\n`;
        advice += `2. Prioritize paying off high-interest debt first.\n`;
        advice += `3. Consider the debt snowball method: Pay minimum payments on all debts, then put extra money toward the smallest debt.\n`;
        advice += `4. Your monthly cash flow is $${monthlyCashFlow}. Use this to accelerate debt repayment.\n`;
      } else if (query.toLowerCase().includes('goal')) {
        const activeGoals = goals.filter(goal => goal.currentAmount < goal.targetAmount);
        
        advice = `Here's advice on achieving your financial goals:\n\n`;
        if (activeGoals.length > 0) {
          advice += `Your active goals:\n`;
          activeGoals.forEach(goal => {
            advice += `- ${goal.description}: $${goal.targetAmount} by ${new Date(goal.targetDate).toLocaleDateString()}\n`;
          });
          advice += `\n1. Break down each goal into smaller, manageable steps.\n`;
          advice += `2. Set up automatic savings to work toward your goals.\n`;
          advice += `3. Track your progress regularly and adjust your strategy as needed.\n`;
        } else {
          advice += `You don't have any active financial goals. Consider setting some goals to help guide your financial decisions.\n`;
        }
      } else {
        // General financial advice based on the user's current situation
        advice = `Based on your current financial situation:\n\n`;
        advice += `1. Your net worth is $${netWorth}\n`;
        advice += `2. Monthly cash flow: $${monthlyCashFlow}\n`;
        advice += `3. Total assets: $${totalAssets}\n`;
        advice += `4. Total liabilities: $${totalLiabilities}\n\n`;
        
        if (monthlyCashFlow < 0) {
          advice += `Your expenses exceed your income. Consider:\n`;
          advice += `- Reducing discretionary spending\n`;
          advice += `- Finding ways to increase your income\n`;
          advice += `- Creating a detailed budget to track spending\n`;
        } else {
          advice += `You have a positive cash flow. Consider:\n`;
          advice += `- Increasing your savings rate\n`;
          advice += `- Investing the surplus\n`;
          advice += `- Paying down debt faster\n`;
        }
      }

      res.json({ advice });
    } catch (error) {
      console.error('Error in AI assistance:', error);
      res.status(500).json({ error: 'Failed to generate financial advice' });
    }
  });

  return router;
} 