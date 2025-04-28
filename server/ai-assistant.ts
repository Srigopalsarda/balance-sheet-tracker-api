import { z } from 'zod';
import { Income, Expense, Asset, Liability, Goal } from '@shared/schema';

// Define the schema for the AI assistant request
const aiAssistantRequestSchema = z.object({
  query: z.string().min(1),
  userData: z.object({
    incomes: z.array(z.any()),
    expenses: z.array(z.any()),
    assets: z.array(z.any()),
    liabilities: z.array(z.any()),
    goals: z.array(z.any()),
    summary: z.object({
      totalIncome: z.number(),
      totalExpenses: z.number(),
      cashFlow: z.number(),
      perDay: z.number(),
      passiveIncome: z.number(),
      netWorth: z.number(),
      netWorthChange: z.number(),
      largestExpenseCategory: z.string(),
      largestExpenseAmount: z.number()
    })
  })
});

type AIAssistantRequest = z.infer<typeof aiAssistantRequestSchema>;

// Function to analyze user data and generate personalized advice
export function generateFinancialAdvice(request: AIAssistantRequest): string {
  const { query, userData } = request;
  const { 
    incomes, 
    expenses, 
    assets, 
    liabilities, 
    goals, 
    summary 
  } = userData;

  // Extract key financial metrics
  const totalIncome = summary.totalIncome;
  const totalExpenses = summary.totalExpenses;
  const cashFlow = summary.cashFlow;
  const passiveIncome = summary.passiveIncome;
  const netWorth = summary.netWorth;
  const largestExpenseCategory = summary.largestExpenseCategory;
  const largestExpenseAmount = summary.largestExpenseAmount;

  // Analyze the query and generate appropriate advice
  const lowerQuery = query.toLowerCase();

  // Expense reduction advice
  if (lowerQuery.includes('reduce') && (lowerQuery.includes('expense') || lowerQuery.includes('spending'))) {
    return generateExpenseReductionAdvice(expenses, totalExpenses, largestExpenseCategory, largestExpenseAmount);
  }

  // Asset increase advice
  if (lowerQuery.includes('increase') && lowerQuery.includes('asset')) {
    return generateAssetIncreaseAdvice(assets, netWorth, passiveIncome);
  }

  // Liability reduction advice
  if ((lowerQuery.includes('reduce') || lowerQuery.includes('pay off')) && lowerQuery.includes('liability')) {
    return generateLiabilityReductionAdvice(liabilities, cashFlow);
  }

  // Goal achievement advice
  if (lowerQuery.includes('goal') || lowerQuery.includes('reach')) {
    return generateGoalAchievementAdvice(goals, cashFlow, netWorth);
  }

  // General financial advice
  return generateGeneralFinancialAdvice(
    incomes, 
    expenses, 
    assets, 
    liabilities, 
    goals, 
    cashFlow, 
    passiveIncome, 
    netWorth
  );
}

// Helper functions to generate specific advice

function generateExpenseReductionAdvice(
  expenses: Expense[], 
  totalExpenses: number, 
  largestExpenseCategory: string, 
  largestExpenseAmount: number
): string {
  const largestExpensePercentage = (largestExpenseAmount / totalExpenses) * 100;
  
  let advice = `Based on your expense data, here are some recommendations to reduce your spending:\n\n`;
  
  // Advice about largest expense category
  advice += `1. Your largest expense category is ${largestExpenseCategory} (${largestExpensePercentage.toFixed(1)}% of total expenses). `;
  advice += `Consider if there are ways to reduce this expense, such as:\n`;
  
  if (largestExpenseCategory === 'Housing') {
    advice += `   - Downsizing to a smaller home or apartment\n`;
    advice += `   - Refinancing your mortgage for a lower rate\n`;
    advice += `   - Taking on a roommate to share costs\n`;
  } else if (largestExpenseCategory === 'Transportation') {
    advice += `   - Using public transportation more often\n`;
    advice += `   - Carpooling or ride-sharing\n`;
    advice += `   - Maintaining your vehicle properly to avoid costly repairs\n`;
  } else if (largestExpenseCategory === 'Food') {
    advice += `   - Meal planning to reduce grocery waste\n`;
    advice += `   - Cooking at home instead of eating out\n`;
    advice += `   - Buying in bulk for non-perishable items\n`;
  } else {
    advice += `   - Reviewing subscriptions and canceling unnecessary ones\n`;
    advice += `   - Looking for cheaper alternatives\n`;
    advice += `   - Setting a strict budget for this category\n`;
  }
  
  // General expense reduction advice
  advice += `\n2. General expense reduction strategies:\n`;
  advice += `   - Create a detailed budget and track all expenses\n`;
  advice += `   - Use the 50/30/20 rule: 50% for needs, 30% for wants, 20% for savings\n`;
  advice += `   - Look for recurring subscriptions you can cancel\n`;
  advice += `   - Consider negotiating bills like insurance, internet, and phone plans\n`;
  advice += `   - Use cash-back or rewards credit cards for purchases you already make\n`;
  
  return advice;
}

function generateAssetIncreaseAdvice(
  assets: Asset[], 
  netWorth: number, 
  passiveIncome: number
): string {
  let advice = `Here are strategies to increase your assets and build wealth:\n\n`;
  
  // Analyze current assets
  const realEstateAssets = assets.filter(a => a.category === 'Real Estate');
  const investmentAssets = assets.filter(a => a.category === 'Investments');
  const businessAssets = assets.filter(a => a.category === 'Business');
  
  // Advice based on current asset mix
  advice += `1. Based on your current assets:\n`;
  
  if (realEstateAssets.length === 0) {
    advice += `   - Consider investing in real estate for long-term appreciation and rental income\n`;
  } else {
    advice += `   - Look for opportunities to increase the value of your existing properties\n`;
    advice += `   - Consider refinancing to access equity for additional investments\n`;
  }
  
  if (investmentAssets.length === 0) {
    advice += `   - Start investing in stocks, bonds, or ETFs for long-term growth\n`;
  } else {
    advice += `   - Diversify your investment portfolio across different asset classes\n`;
    advice += `   - Consider increasing your regular investment contributions\n`;
  }
  
  if (businessAssets.length === 0) {
    advice += `   - Explore starting a side business or investing in existing businesses\n`;
  } else {
    advice += `   - Look for ways to scale your existing business operations\n`;
    advice += `   - Consider reinvesting profits to grow the business\n`;
  }
  
  // General asset building advice
  advice += `\n2. General strategies to increase assets:\n`;
  advice += `   - Increase your savings rate to invest more money\n`;
  advice += `   - Focus on building passive income streams (rental properties, dividends, etc.)\n`;
  advice += `   - Invest in your skills and education to increase earning potential\n`;
  advice += `   - Consider tax-advantaged accounts like 401(k)s, IRAs, or HSAs\n`;
  advice += `   - Look for opportunities to convert expenses into assets (e.g., buying a home instead of renting)\n`;
  
  return advice;
}

function generateLiabilityReductionAdvice(
  liabilities: Liability[], 
  cashFlow: number
): string {
  let advice = `Here are strategies to reduce your liabilities and become debt-free:\n\n`;
  
  // Analyze current liabilities
  const highInterestLiabilities = liabilities.filter(l => l.interestRate > 5);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
  
  // Advice based on current liabilities
  advice += `1. Based on your current liabilities:\n`;
  
  if (highInterestLiabilities.length > 0) {
    advice += `   - Prioritize paying off high-interest debt first (debt avalanche method)\n`;
    advice += `   - Consider debt consolidation or refinancing to lower interest rates\n`;
  }
  
  if (totalLiabilities > 0) {
    advice += `   - Create a debt repayment plan with specific timelines\n`;
    advice += `   - Allocate ${Math.min(20, Math.max(5, (cashFlow / totalLiabilities) * 100)).toFixed(0)}% of your monthly cash flow to debt repayment\n`;
  }
  
  // Specific debt reduction strategies
  advice += `\n2. Specific debt reduction strategies:\n`;
  advice += `   - Use the debt snowball method: pay minimum on all debts, then put extra toward the smallest debt\n`;
  advice += `   - Consider balance transfer cards with 0% introductory rates for credit card debt\n`;
  advice += `   - Look for ways to increase your income to accelerate debt repayment\n`;
  advice += `   - Cut unnecessary expenses to free up more money for debt payments\n`;
  advice += `   - Consider selling assets to pay down high-interest debt\n`;
  
  return advice;
}

function generateGoalAchievementAdvice(
  goals: Goal[], 
  cashFlow: number, 
  netWorth: number
): string {
  let advice = `Here are strategies to help you achieve your financial goals:\n\n`;
  
  // Analyze current goals
  const shortTermGoals = goals.filter(g => {
    const targetDate = new Date(g.targetDate);
    const today = new Date();
    const monthsUntilTarget = (targetDate.getFullYear() - today.getFullYear()) * 12 + 
                             (targetDate.getMonth() - today.getMonth());
    return monthsUntilTarget <= 12;
  });
  
  const longTermGoals = goals.filter(g => {
    const targetDate = new Date(g.targetDate);
    const today = new Date();
    const monthsUntilTarget = (targetDate.getFullYear() - today.getFullYear()) * 12 + 
                             (targetDate.getMonth() - today.getMonth());
    return monthsUntilTarget > 12;
  });
  
  // Advice based on current goals
  advice += `1. Based on your current goals:\n`;
  
  if (shortTermGoals.length > 0) {
    advice += `   - For short-term goals (within 1 year), focus on saving a specific amount each month\n`;
    advice += `   - Consider using a high-yield savings account for short-term goals\n`;
  }
  
  if (longTermGoals.length > 0) {
    advice += `   - For long-term goals, invest in growth-oriented assets like stocks or real estate\n`;
    advice += `   - Take advantage of compound interest by starting early\n`;
  }
  
  // General goal achievement strategies
  advice += `\n2. General strategies to achieve your goals:\n`;
  advice += `   - Make your goals SMART: Specific, Measurable, Achievable, Relevant, Time-bound\n`;
  advice += `   - Automate savings and investments to ensure consistent progress\n`;
  advice += `   - Review your goals regularly and adjust as needed\n`;
  advice += `   - Celebrate small wins along the way to stay motivated\n`;
  advice += `   - Consider using apps or tools to track your progress\n`;
  
  return advice;
}

function generateGeneralFinancialAdvice(
  incomes: Income[], 
  expenses: Expense[], 
  assets: Asset[], 
  liabilities: Liability[], 
  goals: Goal[], 
  cashFlow: number, 
  passiveIncome: number, 
  netWorth: number
): string {
  let advice = `Based on your financial data, here's a comprehensive overview and advice:\n\n`;
  
  // Income analysis
  const activeIncome = incomes.filter(i => i.type === 'active').reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const passiveIncomePercentage = activeIncome > 0 ? (passiveIncome / activeIncome) * 100 : 0;
  
  advice += `1. Income: Your active income is ${activeIncome.toFixed(2)}, with ${passiveIncomePercentage.toFixed(1)}% coming from passive sources. `;
  advice += `To increase your income:\n`;
  advice += `   - Look for opportunities to increase your active income (raises, side hustles)\n`;
  advice += `   - Focus on building passive income streams (investments, rental properties)\n`;
  advice += `   - Develop new skills that command higher pay\n\n`;
  
  // Expense analysis
  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  advice += `2. Expenses: Your monthly expenses total ${totalExpenses.toFixed(2)}. `;
  advice += `To optimize your spending:\n`;
  advice += `   - Review your largest expense categories for potential savings\n`;
  advice += `   - Consider the 50/30/20 budget rule\n`;
  advice += `   - Look for ways to reduce recurring expenses\n\n`;
  
  // Asset analysis
  const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.value.toString()), 0);
  advice += `3. Assets: Your total assets are valued at ${totalAssets.toFixed(2)}. `;
  advice += `To grow your assets:\n`;
  advice += `   - Diversify your investments across different asset classes\n`;
  advice += `   - Reinvest returns to take advantage of compound growth\n`;
  advice += `   - Consider tax-advantaged investment accounts\n\n`;
  
  // Liability analysis
  const totalLiabilities = liabilities.reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);
  advice += `4. Liabilities: Your total liabilities are ${totalLiabilities.toFixed(2)}. `;
  advice += `To reduce your debt:\n`;
  advice += `   - Prioritize high-interest debt first\n`;
  advice += `   - Consider debt consolidation for lower interest rates\n`;
  advice += `   - Create a specific debt repayment plan\n\n`;
  
  // Net worth analysis
  advice += `5. Net Worth: Your current net worth is ${netWorth.toFixed(2)}. `;
  advice += `To increase your net worth:\n`;
  advice += `   - Focus on increasing assets while reducing liabilities\n`;
  advice += `   - Maintain a positive cash flow to fund investments\n`;
  advice += `   - Set specific net worth goals and track progress regularly\n\n`;
  
  // Goals analysis
  advice += `6. Goals: You have ${goals.length} financial goals. `;
  advice += `To achieve your goals:\n`;
  advice += `   - Prioritize goals based on importance and timeline\n`;
  advice += `   - Allocate your resources (time, money) accordingly\n`;
  advice += `   - Review and adjust your goals regularly\n`;
  
  return advice;
} 