
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export enum Category {
  FOOD = 'Ăn uống',
  TRANSPORT = 'Di chuyển',
  SHOPPING = 'Mua sắm',
  BILLS = 'Hóa đơn',
  ENTERTAINMENT = 'Giải trí',
  HEALTH = 'Sức khỏe',
  EDUCATION = 'Giáo dục',
  SALARY = 'Lương',
  INVESTMENT = 'Đầu tư',
  OTHER = 'Khác'
}

export const CategoryIcons: Record<string, string> = {
  'Ăn uống': '🍔',
  'Di chuyển': '🛵',
  'Mua sắm': '🛍️',
  'Hóa đơn': '🧾',
  'Giải trí': '🎬',
  'Sức khỏe': '💊',
  'Giáo dục': '📚',
  'Lương': '💰',
  'Đầu tư': '📈',
  'Khác': '📦'
};

export const EXPENSE_CATEGORIES = [
  Category.FOOD, Category.TRANSPORT, Category.SHOPPING, Category.BILLS, 
  Category.ENTERTAINMENT, Category.HEALTH, Category.EDUCATION, Category.OTHER
];

export const INCOME_CATEGORIES = [
  Category.SALARY, Category.INVESTMENT, Category.OTHER
];

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO date string
  type: TransactionType;
  status?: 'PENDING' | 'CONFIRMED';
  person?: string;
  location?: string;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'CARD';
  isSynced?: boolean; // New field for offline support
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: number;
  isProcessing?: boolean;
  relatedTransactionId?: string;
  audioBase64?: string;
}

export interface UserSettings {
  initialBalance: number; // Số dư Tiền mặt đầu kỳ
  initialBankBalance: number; // Số dư Ngân hàng đầu kỳ
  dailyLimit: number;
  appScriptUrl?: string;
  telegramChatId?: string;
  notificationEnabled?: boolean;
  notificationTimes?: string[];
  geminiApiKey?: string;
  themeColor?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue';
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
