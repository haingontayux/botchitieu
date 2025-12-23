import { Transaction, ChatMessage, UserSettings, TransactionType } from '../types';

const TRANSACTIONS_KEY = 'finbot_transactions';
const CHAT_HISTORY_KEY = 'finbot_chat_history';
const SETTINGS_KEY = 'finbot_settings';

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
      dailyLimit: parsed.dailyLimit || 500000,
      appScriptUrl: parsed.appScriptUrl || '',
      telegramChatId: parsed.telegramChatId || '',
      notificationEnabled: parsed.notificationEnabled || false,
      notificationTimes: times
    };
  } catch (error) {
    return { 
        initialBalance: 0, 
        dailyLimit: 500000, 
        appScriptUrl: '', 
        telegramChatId: '', 
        notificationEnabled: false, 
        notificationTimes: ['09:00', '12:00', '20:00'] 
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
      const parsedData: Transaction[] = data.data
        .map((item: any) => ({
          id: item.id,
          date: item.date,
          description: item.description,
          amount: item.amount,
          category: item.category,
          type: item.type,
          status: item.status || 'CONFIRMED',
          person: item.person || undefined, 
          location: item.location || undefined 
        }))
        // FAILSAFE FILTER: Remove items that look like system messages (start with emoji check)
        .filter((item: Transaction) => {
             const desc = item.description || "";
             return !desc.startsWith("✅") && !desc.startsWith("📩") && !desc.startsWith("🔔") && !desc.startsWith("🆔");
        });
      
      saveTransactionsLocal(parsedData);
      return parsedData;
    }
    return null;
  } catch (error) {
    console.error("Cloud Sync Error (Read):", error);
    return null;
  }
};

export const syncToCloud = async (scriptUrl: string, transaction: Transaction, action: 'ADD' | 'DELETE' | 'UPDATE' = 'ADD') => {
  if (!scriptUrl) return;
  
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify({
        action: action,
        data: transaction
      })
    });
  } catch (error) {
    console.error("Cloud Sync Error (Write):", error);
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