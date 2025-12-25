
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { BotChat } from './views/BotChat';
import { Dashboard } from './views/Dashboard';
import { History } from './views/History';
import { Statistics } from './views/Statistics';
import { Settings } from './views/Settings';
import { Transaction, ChatMessage, UserSettings, TransactionType } from './types';
import { getStoredTransactions, saveTransactionsLocal, getStoredChatHistory, saveChatHistory, getSettings, saveSettings, syncFromCloud, syncToCloud, applyTheme } from './services/storageService';
import { parseTransactionFromMultimodal } from './services/geminiService';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [settings, setUserSettings] = useState<UserSettings>({ initialBalance: 0, dailyLimit: 500000, themeColor: 'indigo' });
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPendingId, setIsProcessingPendingId] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{blob: Blob, mimeType: string} | null>(null);

  // Apply Theme CSS Variables on mount and change
  useEffect(() => {
    applyTheme(settings.themeColor || 'indigo');
  }, [settings.themeColor]);

  // Load Data
  const loadData = () => {
    const localData = getStoredTransactions();
    setTransactions(localData);
    const localSettings = getSettings();
    setUserSettings(localSettings);
    setChatHistory(getStoredChatHistory());
    applyTheme(localSettings.themeColor || 'indigo'); // Apply immediately on load

    if (localSettings.appScriptUrl) {
      setIsLoading(true);
      syncFromCloud(localSettings.appScriptUrl)
        .then(cloudData => {
            if (cloudData) setTransactions(cloudData);
        })
        .finally(() => setIsLoading(false));
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { saveTransactionsLocal(transactions); }, [transactions]);
  useEffect(() => { saveChatHistory(chatHistory); }, [chatHistory]);

  // Offline Sync Logic
  const syncOfflineTransactions = async () => {
      if (!settings.appScriptUrl || !navigator.onLine) return;
      const unsynced = transactions.filter(t => t.isSynced === false);
      if (unsynced.length === 0) return;

      console.log(`Syncing ${unsynced.length} offline transactions...`);
      for (const t of unsynced) {
          const success = await syncToCloud(settings.appScriptUrl, t, 'ADD');
          if (success) {
              setTransactions(prev => prev.map(pt => pt.id === t.id ? { ...pt, isSynced: true } : pt));
          }
      }
  };

  // Trigger sync when coming online
  useEffect(() => {
      window.addEventListener('online', syncOfflineTransactions);
      if(navigator.onLine) syncOfflineTransactions();
      return () => window.removeEventListener('online', syncOfflineTransactions);
  }, [settings.appScriptUrl, transactions]);

  const handleSaveSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
    saveSettings(newSettings);
    // Apply theme immediately on save as well
    applyTheme(newSettings.themeColor || 'indigo');
  };

  const addTransactions = async (newItems: Transaction | Transaction[]) => {
    const itemsToAdd = Array.isArray(newItems) ? newItems : [newItems];
    // Optimistic Update: Add immediately as Unsynced
    const markedItems = itemsToAdd.map(t => ({ ...t, isSynced: false }));
    setTransactions(prev => [...prev, ...markedItems]);

    if (settings.appScriptUrl) {
        if(navigator.onLine) {
            for (const item of markedItems) {
                const success = await syncToCloud(settings.appScriptUrl!, item, 'ADD');
                if (success) {
                    setTransactions(prev => prev.map(t => t.id === item.id ? { ...t, isSynced: true } : t));
                }
            }
        }
    }
  };

  const editTransaction = async (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
    if (settings.appScriptUrl && navigator.onLine) {
       await syncToCloud(settings.appScriptUrl, updatedTransaction, 'UPDATE');
    }
  };

  const deleteTransaction = async (id: string) => {
    const transactionToDelete = transactions.find(t => String(t.id) === String(id));
    setTransactions(prev => prev.filter(t => String(t.id) !== String(id)));
    if (settings.appScriptUrl && transactionToDelete && navigator.onLine) {
       await syncToCloud(settings.appScriptUrl, transactionToDelete, 'DELETE');
    }
  };

  const handleProcessPending = async (pendingTransaction: Transaction) => {
    setIsProcessingPendingId(pendingTransaction.id);
    try {
      const parsedData = await parseTransactionFromMultimodal({ text: pendingTransaction.description }, []);
      if (parsedData && parsedData.transactions && parsedData.transactions.length > 0) {
        const tData = parsedData.transactions[0];
        const confirmedTransaction: Transaction = {
          ...pendingTransaction,
          amount: tData.amount,
          category: tData.category,
          date: tData.date || pendingTransaction.date,
          description: tData.description,
          type: tData.type as TransactionType,
          status: 'CONFIRMED'
        };
        // Update local
        setTransactions(prev => prev.map(t => t.id === pendingTransaction.id ? confirmedTransaction : t));
        // Sync Update
        if (settings.appScriptUrl && navigator.onLine) await syncToCloud(settings.appScriptUrl, confirmedTransaction, 'UPDATE');
      }
    } catch (e) { console.error(e); } finally { setIsProcessingPendingId(null); }
  };

  return (
    // Sử dụng h-[100dvh] để đảm bảo chiều cao đúng trên mobile (tránh bị thanh địa chỉ che)
    <div className="flex h-[100dvh] bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-72 h-full relative overflow-hidden flex flex-col">
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-20"
             style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
           <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">F</div>
            <span className="font-black text-slate-800 text-lg tracking-tight">FinBot AI</span>
           </div>
           {isLoading && <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>}
        </div>

        {/* Tăng padding bottom lên 150px để đảm bảo nội dung cuối cùng vượt qua khỏi thanh menu */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 no-scrollbar w-full" 
             style={{ paddingBottom: '150px' }}>
           <div className="max-w-4xl mx-auto h-full">
            {currentTab === 'dashboard' && (
              <Dashboard 
                transactions={transactions} 
                settings={settings} 
                onProcessPending={handleProcessPending} 
                isProcessingId={isProcessingPendingId} 
                onUpdateSettings={handleSaveSettings}
                onViewHistory={() => setCurrentTab('history')} 
              />
            )}
            {currentTab === 'statistics' && <Statistics transactions={transactions} />}
            {currentTab === 'chat' && (
              <div className="h-full animate-fade-in">
                 <BotChat 
                    chatHistory={chatHistory} 
                    setChatHistory={setChatHistory} 
                    addTransactions={addTransactions} 
                    onEditTransaction={editTransaction}
                    transactions={transactions} 
                    pendingAudio={pendingAudio} 
                    clearPendingAudio={() => setPendingAudio(null)} 
                 />
              </div>
            )}
            {currentTab === 'history' && (
                <History transactions={transactions} onDelete={deleteTransaction} onEdit={editTransaction} onAdd={addTransactions} />
            )}
            {currentTab === 'settings' && <Settings settings={settings} onSave={handleSaveSettings} onDataUpdate={loadData} />}
           </div>
        </div>
      </main>

      <MobileNav currentTab={currentTab} setCurrentTab={setCurrentTab} onAudioCapture={(b, m) => { setPendingAudio({ blob: b, mimeType: m }); setCurrentTab('chat'); }} />
    </div>
  );
};

export default App;
