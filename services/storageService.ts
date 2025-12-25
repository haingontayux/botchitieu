
import { Transaction, ChatMessage, UserSettings, TransactionType } from '../types';

const TRANSACTIONS_KEY = 'finbot_transactions';
const CHAT_HISTORY_KEY = 'finbot_chat_history';
const SETTINGS_KEY = 'finbot_settings';

// --- Theme Helpers ---

export const COLOR_MAP: Record<string, any> = {
  indigo: { 
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 
    500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' 
  },
  emerald: { 
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 
    500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' 
  },
  rose: { 
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 
    500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' 
  },
  amber: { 
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 
    500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' 
  },
  blue: { 
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 
    500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' 
  },
};

export const applyTheme = (themeColor: string) => {
    const palette = COLOR_MAP[themeColor] || COLOR_MAP['indigo'];
    const root = document.documentElement;
    Object.keys(palette).forEach(key => {
       root.style.setProperty(`--brand-${key}`, palette[key]);
    });
};

// --- Local Storage Helpers ---

export const getStoredTransactions = (): Transaction[] => {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error loading transactions", error);
    return [];
  }
};

export const saveTransactionsLocal = (transactions: Transaction[]) => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("Error saving transactions", error);
  }
};

export const getStoredChatHistory = (): ChatMessage[] => {
  try {
    const data = localStorage.getItem(CHAT_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const saveChatHistory = (history: ChatMessage[]) => {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving chat", error);
  }
};

export const getSettings = (): UserSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    
    // Migration logic
    let times = parsed.notificationTimes;
    if (!times) {
        if (parsed.notificationTime) {
            times = [parsed.notificationTime];
        } else {
            times = ['09:00', '12:00', '20:00'];
        }
    }

    return {
      initialBalance: parsed.initialBalance || 0,
      initialBankBalance: parsed.initialBankBalance || 0,
      dailyLimit: parsed.dailyLimit || 500000,
      appScriptUrl: parsed.appScriptUrl || '',
      telegramChatId: parsed.telegramChatId || '',
      notificationEnabled: parsed.notificationEnabled || false,
      notificationTimes: times,
      geminiApiKey: parsed.geminiApiKey || '',
      themeColor: parsed.themeColor || 'indigo'
    };
  } catch (error) {
    return { 
        initialBalance: 0, 
        initialBankBalance: 0,
        dailyLimit: 500000, 
        appScriptUrl: '', 
        telegramChatId: '', 
        notificationEnabled: false, 
        notificationTimes: ['09:00', '12:00', '20:00'],
        geminiApiKey: '',
        themeColor: 'indigo'
    };
  }
};

export const saveSettings = (settings: UserSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Error saving settings", error);
  }
};

// --- Google Sheets Sync (Cloud) ---

export const syncFromCloud = async (scriptUrl: string): Promise<Transaction[] | null> => {
  if (!scriptUrl) return null;
  try {
    const response = await fetch(scriptUrl, { method: 'GET' });
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    if (data.status === 'success' && Array.isArray(data.data)) {
      // Map data from sheet to Transaction type
      const parsedData: Transaction[] = data.data.map((item: any) => ({
        id: item.id,
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category,
        type: item.type,
        status: item.status || 'CONFIRMED',
        person: item.person || undefined, 
        location: item.location || undefined,
        paymentMethod: item.paymentMethod || 'CASH',
        isSynced: true // Data from cloud is always synced
      }));
      
      saveTransactionsLocal(parsedData);
      return parsedData;
    }
    return null;
  } catch (error) {
    console.error("Cloud Sync Error (Read):", error);
    return null;
  }
};

// Modified to return boolean for success/fail
export const syncToCloud = async (scriptUrl: string, transaction: Transaction, action: 'ADD' | 'DELETE' | 'UPDATE' = 'ADD'): Promise<boolean> => {
  if (!scriptUrl) return false;
  
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify({
        action: action,
        data: transaction
      })
    });
    return res.ok;
  } catch (error) {
    console.error("Cloud Sync Error (Write):", error);
    return false;
  }
};

export const sendTelegramNotification = async (scriptUrl: string, chatId: string, message: string) => {
  if (!scriptUrl || !chatId) return;
  try {
    await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'NOTIFY',
            chatId: chatId,
            message: message
        })
    });
  } catch (error) {
      console.error("Failed to send telegram notification", error);
  }
};

// Data Management
export const exportData = () => {
  const data = {
    transactions: getStoredTransactions(),
    settings: getSettings(),
    chatHistory: getStoredChatHistory(),
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finbot_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};

export const importData = async (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.transactions) localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(json.transactions));
        if (json.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(json.settings));
        if (json.chatHistory) localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(json.chatHistory));
        resolve(true);
      } catch (error) {
        console.error("Import failed", error);
        resolve(false);
      }
    };
    reader.readAsText(file);
  });
};
