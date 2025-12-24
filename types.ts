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
  initialBalance: number;
  dailyLimit: number;
  appScriptUrl?: string;
  telegramChatId?: string;
  notificationEnabled?: boolean;
  notificationTimes?: string[];
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}