
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { BotChat } from './views/BotChat';
import { Dashboard } from './views/Dashboard';
import { History } from './views/History';
import { Statistics } from './views/Statistics';
import { Settings } from './views/Settings';
import { Transaction, ChatMessage, UserSettings, TransactionType } from './types';
import { getStoredTransactions, saveTransactionsLocal, getStoredChatHistory, saveChatHistory, getSettings, saveSettings, syncFromCloud, syncToCloud, sendTelegramNotification } from './services/storageService';
import { parseTransactionFromMultimodal } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [settings, setUserSettings] = useState<UserSettings>({ initialBalance: 0, dailyLimit: 500000 });
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPendingId, setIsProcessingPendingId] = useState<string | null>(null);
  
  const [pendingAudio, setPendingAudio] = useState<{blob: Blob, mimeType: string} | null>(null);
  const lastNotificationKeyRef = useRef<string | null>(null);

  const loadData = () => {
    const localData = getStoredTransactions();
    const localSettings = getSettings();
    const localChat = getStoredChatHistory();

    setTransactions(localData);
    setUserSettings(localSettings);
    setChatHistory(localChat);

    if (localSettings.appScriptUrl) {
      setIsLoading(true);
      syncFromCloud(localSettings.appScriptUrl)
        .then(cloudData => {
          if (cloudData) setTransactions(cloudData);
        })
        .finally(() => setIsLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveTransactionsLocal(transactions);
  }, [transactions]);

  useEffect(() => {
    saveChatHistory(chatHistory);
  }, [chatHistory]);

  const handleSaveSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
    saveSettings(newSettings);
  };

  const addTransactions = (newItems: Transaction | Transaction[]) => {
    const itemsToAdd = Array.isArray(newItems) ? newItems : [newItems];
    setTransactions(prev => [...prev, ...itemsToAdd]);
    if (settings.appScriptUrl) {
      itemsToAdd.forEach(item => syncToCloud(settings.appScriptUrl!, item, 'ADD'));
    }
  };

  const editTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
    if (settings.appScriptUrl) syncToCloud(settings.appScriptUrl, updatedTransaction, 'UPDATE');
  };

  const deleteTransaction = (id: string) => {
    const transactionToDelete = transactions.find(t => String(t.id) === String(id));
    setTransactions(prev => prev.filter(t => String(t.id) !== String(id)));
    if (settings.appScriptUrl && transactionToDelete) syncToCloud(settings.appScriptUrl, transactionToDelete, 'DELETE');
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
        setTransactions(prev => prev.map(t => t.id === pendingTransaction.id ? confirmedTransaction : t));
        if (settings.appScriptUrl) await syncToCloud(settings.appScriptUrl, confirmedTransaction, 'UPDATE');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingPendingId(null);
    }
  };

  const handleGlobalAudioCapture = (blob: Blob, mimeType: string) => {
      setPendingAudio({ blob, mimeType });
      setCurrentTab('chat');
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-72 h-full relative overflow-hidden flex flex-col">
        {/* Header di động */}
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-20"
             style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
           <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">F</div>
            <span className="font-black text-slate-800 text-lg tracking-tight">FinBot AI</span>
           </div>
           {isLoading && <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
        </div>

        {/* Nội dung chính */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 no-scrollbar" 
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
           <div className="max-w-4xl mx-auto h-full">
            {currentTab === 'dashboard' && (
              <Dashboard transactions={transactions} settings={settings} onProcessPending={handleProcessPending} isProcessingId={isProcessingPendingId} onUpdateSettings={handleSaveSettings} />
            )}
            
            {currentTab === 'statistics' && <Statistics transactions={transactions} />}

            {currentTab === 'chat' && (
              <div className="h-full animate-fade-in">
                 <BotChat chatHistory={chatHistory} setChatHistory={setChatHistory} addTransactions={addTransactions} transactions={transactions} pendingAudio={pendingAudio} clearPendingAudio={() => setPendingAudio(null)} />
              </div>
            )}

            {currentTab === 'history' && <History transactions={transactions} onDelete={deleteTransaction} onEdit={editTransaction} />}

            {currentTab === 'settings' && <Settings settings={settings} onSave={handleSaveSettings} onDataUpdate={loadData} />}
           </div>
        </div>
      </main>

      <MobileNav currentTab={currentTab} setCurrentTab={setCurrentTab} onAudioCapture={handleGlobalAudioCapture} />
    </div>
  );
};

export default App;
