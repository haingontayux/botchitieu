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
import { parseTransactionFromMultimodal, formatCurrency } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [settings, setUserSettings] = useState<UserSettings>({ initialBalance: 0, dailyLimit: 500000 });
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPendingId, setIsProcessingPendingId] = useState<string | null>(null);
  
  // State to hold audio captured from MobileNav
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
          if (cloudData) {
            setTransactions(cloudData);
            console.log("Initial cloud sync done");
          }
        })
        .finally(() => setIsLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Auto Sync Polling (Every 30s) ---
  useEffect(() => {
    if (!settings.appScriptUrl) return;
    
    const pollCloud = () => {
       syncFromCloud(settings.appScriptUrl!)
        .then(cloudData => {
           if (cloudData) {
               // Simple diff check to update state
               setTransactions(prev => {
                   if (prev.length !== cloudData.length || JSON.stringify(prev) !== JSON.stringify(cloudData)) {
                       console.log("Auto-sync: Data updated from cloud");
                       return cloudData;
                   }
                   return prev;
               });
           }
        })
        .catch(err => console.error("Auto-sync failed", err));
    };

    const interval = setInterval(pollCloud, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [settings.appScriptUrl]);

  useEffect(() => {
    saveTransactionsLocal(transactions);
  }, [transactions]);

  useEffect(() => {
    saveChatHistory(chatHistory);
  }, [chatHistory]);

  useEffect(() => {
    const checkNotification = () => {
      if (!settings.notificationEnabled || !settings.notificationTimes || settings.notificationTimes.length === 0) return;

      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      const today = now.toDateString();
      const currentKey = `${today}_${currentTime}`;

      if (settings.notificationTimes.includes(currentTime)) {
        if (lastNotificationKeyRef.current !== currentKey) {
          if (Notification.permission === 'granted') {
            new Notification('FinBot AI nhắc nhở 🔔', {
              body: `Đã ${currentTime} rồi! Đừng quên ghi lại chi tiêu bạn nhé.`,
              icon: '/favicon.ico'
            });
          }

          if (settings.appScriptUrl && settings.telegramChatId) {
              sendTelegramNotification(
                  settings.appScriptUrl, 
                  settings.telegramChatId, 
                  `⏰ Đã ${currentTime}. Hãy dành 1 phút để cập nhật chi tiêu nhé!`
              );
          }
          
          lastNotificationKeyRef.current = currentKey;
        }
      }
    };

    const intervalId = setInterval(checkNotification, 60000);
    return () => clearInterval(intervalId);
  }, [settings]);

  const handleSaveSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
    saveSettings(newSettings);
    if (newSettings.appScriptUrl && newSettings.appScriptUrl !== settings.appScriptUrl) {
       setIsLoading(true);
       syncFromCloud(newSettings.appScriptUrl)
        .then(cloudData => {
          if (cloudData) setTransactions(cloudData);
        })
        .finally(() => setIsLoading(false));
    }
  };

  const addTransactions = (newItems: Transaction | Transaction[]) => {
    const itemsToAdd = Array.isArray(newItems) ? newItems : [newItems];
    setTransactions(prev => [...prev, ...itemsToAdd]);
    if (settings.appScriptUrl) {
      itemsToAdd.forEach(item => {
        syncToCloud(settings.appScriptUrl!, item, 'ADD');
      });
    }
  };

  const editTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
    if (settings.appScriptUrl) {
      syncToCloud(settings.appScriptUrl, updatedTransaction, 'UPDATE');
    }
  };

  const deleteTransaction = (id: string) => {
    const transactionToDelete = transactions.find(t => String(t.id) === String(id));
    setTransactions(prev => prev.filter(t => String(t.id) !== String(id)));
    if (settings.appScriptUrl && transactionToDelete) {
      syncToCloud(settings.appScriptUrl, transactionToDelete, 'DELETE');
    }
  };

  // --- CRITICAL FIX FOR HALLUCINATION ---
  const handleProcessPending = async (pendingTransaction: Transaction) => {
    setIsProcessingPendingId(pendingTransaction.id);
    try {
      // FORCE EMPTY HISTORY: passing [] ensures AI has ZERO context of old data.
      // It will only see: "USER_REQUEST: [description from telegram]"
      const parsedData = await parseTransactionFromMultimodal(
          { text: pendingTransaction.description }, 
          [] // <--- THIS IS THE FIX. No history passed.
      );
      
      if (parsedData && parsedData.transactions && parsedData.transactions.length > 0) {
        const tData = parsedData.transactions[0];
        
        const confirmedTransaction: Transaction = {
          ...pendingTransaction,
          amount: tData.amount,
          category: tData.category,
          date: tData.date || pendingTransaction.date,
          description: tData.description || pendingTransaction.description,
          type: tData.type as TransactionType,
          status: 'CONFIRMED',
          person: tData.person,
          location: tData.location
        };

        // Optimistic UI Update
        setTransactions(prev => prev.map(t => t.id === pendingTransaction.id ? confirmedTransaction : t));
        
        // Cloud Sync
        if (settings.appScriptUrl) {
          await syncToCloud(settings.appScriptUrl, confirmedTransaction, 'UPDATE');
          
          if (settings.telegramChatId) {
             const message = `✅ Đã lưu: ${confirmedTransaction.description}\n💰 ${formatCurrency(confirmedTransaction.amount)} (${confirmedTransaction.category})`;
             await sendTelegramNotification(settings.appScriptUrl, settings.telegramChatId, message);
          }
        }
      } else {
        alert("AI không hiểu nội dung này. Bạn vui lòng tự sửa bằng tay.");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối AI.");
    } finally {
      setIsProcessingPendingId(null);
    }
  };

  const handleGlobalAudioCapture = (blob: Blob, mimeType: string) => {
      setPendingAudio({ blob, mimeType });
      setCurrentTab('chat');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <main className="flex-1 md:ml-72 h-full relative overflow-hidden flex flex-col">
        <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20">
           <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">F</div>
            <span className="font-bold text-slate-800 text-lg">FinBot AI</span>
           </div>
           {isLoading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth">
           <div className="max-w-7xl mx-auto h-full">
            {currentTab === 'dashboard' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                   <div>
                     <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Tổng quan</h1>
                     <p className="text-slate-500 mt-1 font-medium">Bức tranh tài chính của bạn</p>
                   </div>
                   {isLoading && <span className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-pulse">Đang đồng bộ...</span>}
                 </div>
                 <Dashboard 
                    transactions={transactions} 
                    settings={settings} 
                    onProcessPending={handleProcessPending}
                    isProcessingId={isProcessingPendingId}
                    onUpdateSettings={handleSaveSettings}
                 />
              </div>
            )}
            
            {currentTab === 'statistics' && (
              <div className="space-y-6">
                 <div>
                   <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Thống kê chi tiết</h1>
                   <p className="text-slate-500 mt-1 font-medium">Phân tích xu hướng tiêu dùng</p>
                 </div>
                 <Statistics transactions={transactions} />
              </div>
            )}

            {currentTab === 'chat' && (
              <div className="h-[calc(100vh-160px)] md:h-[calc(100vh-120px)] animate-fade-in">
                 <BotChat 
                    chatHistory={chatHistory} 
                    setChatHistory={setChatHistory} 
                    addTransactions={addTransactions} 
                    transactions={transactions}
                    pendingAudio={pendingAudio}
                    clearPendingAudio={() => setPendingAudio(null)}
                  />
              </div>
            )}

            {currentTab === 'history' && (
              <div className="space-y-6">
                 <div>
                   <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Sổ giao dịch</h1>
                   <p className="text-slate-500 mt-1 font-medium">Quản lý và chỉnh sửa thu chi</p>
                 </div>
                 <History 
                   transactions={transactions} 
                   onDelete={deleteTransaction} 
                   onEdit={editTransaction} 
                   onAdd={addTransactions} 
                 />
              </div>
            )}

            {currentTab === 'settings' && (
              <div className="space-y-6">
                 <div>
                   <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Cài đặt</h1>
                   <p className="text-slate-500 mt-1 font-medium">Cấu hình ví và dữ liệu</p>
                 </div>
                 <Settings settings={settings} onSave={handleSaveSettings} onDataUpdate={loadData} />
              </div>
            )}
           </div>
        </div>
      </main>

      <MobileNav 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        onAudioCapture={handleGlobalAudioCapture}
      />
    </div>
  );
};

export default App;