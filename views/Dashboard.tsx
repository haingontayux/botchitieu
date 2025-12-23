import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, UserSettings, CategoryIcons } from '../types';
import { formatCurrency } from '../services/geminiService';

interface DashboardProps {
  transactions: Transaction[];
  settings: UserSettings;
  onProcessPending?: (t: Transaction) => void;
  isProcessingId?: string | null;
  onUpdateSettings?: (s: UserSettings) => void;
}

// --- Animated Number Component ---
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0; 
    const end = value;
    if (start === end) return;

    const duration = 1500; 
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = 1 - Math.pow(1 - progress, 4);
      
      const current = start + (end - start) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <>{formatCurrency(displayValue)}</>;
};

export const Dashboard: React.FC<DashboardProps> = ({ transactions, settings, onProcessPending, isProcessingId, onUpdateSettings }) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState<string>('');

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'PENDING');
  }, [transactions]);

  const confirmedTransactions = useMemo(() => {
    return transactions.filter(t => t.status !== 'PENDING');
  }, [transactions]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthTransactions = confirmedTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = currentMonthTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    
    // Lifetime totals for balance calculation
    const totalIncome = confirmedTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = confirmedTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    
    return {
      monthIncome: income,
      monthExpense: expense,
      totalBalance: (settings.initialBalance || 0) + totalIncome - totalExpense,
      totalIncomeLifetime: totalIncome,
      totalExpenseLifetime: totalExpense
    };
  }, [confirmedTransactions, settings]);

  const todayExpense = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return confirmedTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.date === today)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [confirmedTransactions]);

  const dailyProgress = Math.min((todayExpense / settings.dailyLimit) * 100, 100);

  const handleEditBalanceClick = () => {
    // Format initial value with commas
    setNewBalanceInput(stats.totalBalance.toLocaleString('en-US'));
    setIsEditingBalance(true);
  };

  const handleBalanceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-digit characters to keep logic clean
    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
    if (!rawValue) {
        setNewBalanceInput('');
        return;
    }
    // Re-format with commas
    const formatted = Number(rawValue).toLocaleString('en-US');
    setNewBalanceInput(formatted);
  };

  const saveNewBalance = (e: React.FormEvent) => {
      e.preventDefault();
      if (!onUpdateSettings) return;

      // Parse back to number
      const targetBalance = Number(newBalanceInput.replace(/,/g, ''));
      if (isNaN(targetBalance)) return;

      // Logic: Target = Initial + LifetimeIncome - LifetimeExpense
      // So: Initial = Target - (LifetimeIncome - LifetimeExpense)
      const netLifetimeFlow = stats.totalIncomeLifetime - stats.totalExpenseLifetime;
      const newInitial = targetBalance - netLifetimeFlow;

      onUpdateSettings({
          ...settings,
          initialBalance: newInitial
      });
      setIsEditingBalance(false);
  };

  // Group transactions ONLY for TODAY
  const timelineData = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      // Filter for today only, sort newest first
      const todayTransactions = confirmedTransactions
          .filter(t => t.date === today)
          .sort((a, b) => {
              // Assuming new transactions are appended, simply reversing gives newest first if date is same.
              // Ideally we might want a timestamp but date string is sufficient for grouping
              return -1; 
          });

      // No need for complex grouping since it's just one day, 
      // but keeping structure consistent if we want to expand later or for render logic
      if (todayTransactions.length === 0) return [];

      return [['Hôm nay', todayTransactions]] as [string, Transaction[]][];
  }, [confirmedTransactions]);


  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
      
      {/* Pending Transactions Section (From Telegram) */}
      {pendingTransactions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-6 shadow-sm animate-pulse-slow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-yellow-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Ghi nhận từ Telegram
            </h3>
            <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">{pendingTransactions.length} mới</span>
          </div>
          <div className="space-y-3">
            {pendingTransactions.map(t => (
              <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 flex items-center justify-between">
                <div>
                   <p className="font-bold text-slate-800">{t.description}</p>
                   <p className="text-xs text-slate-500">{new Date(t.date).toLocaleString('vi-VN')}</p>
                </div>
                <button 
                  onClick={() => onProcessPending && onProcessPending(t)}
                  disabled={isProcessingId === t.id}
                  className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-md flex items-center gap-2 ${
                    isProcessingId === t.id 
                    ? 'bg-slate-400 cursor-wait' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isProcessingId === t.id ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Phân tích AI
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div 
        onClick={handleEditBalanceClick}
        className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-600/30 relative overflow-hidden cursor-pointer transform transition-all hover:scale-[1.01] active:scale-[0.99]"
      >
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
                <p className="text-indigo-100 font-medium">Tổng số dư hiện tại</p>
                <svg className="w-4 h-4 text-indigo-300 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </div>
            <h2 className="text-4xl font-bold tracking-tight">
                <AnimatedNumber value={stats.totalBalance} />
            </h2>
            
            <div className="mt-8 flex items-center space-x-8">
              <div>
                <div className="flex items-center space-x-2 text-indigo-100 text-sm mb-1">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                     <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </div>
                  <span>Thu nhập tháng này</span>
                </div>
                <p className="text-xl font-semibold">
                    <AnimatedNumber value={stats.monthIncome} />
                </p>
              </div>
              <div>
                 <div className="flex items-center space-x-2 text-indigo-100 text-sm mb-1">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                     <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  </div>
                  <span>Chi tiêu tháng này</span>
                </div>
                <p className="text-xl font-semibold">
                    <AnimatedNumber value={stats.monthExpense} />
                </p>
              </div>
            </div>
         </div>
      </div>

      {/* Edit Balance Modal */}
      {isEditingBalance && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsEditingBalance(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Điều chỉnh số dư</h3>
                <p className="text-sm text-slate-500 mb-4">Nhập số tiền thực tế bạn đang có. Hệ thống sẽ tự động cập nhật số dư đầu kỳ.</p>
                <form onSubmit={saveNewBalance}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số dư thực tế</label>
                    <input 
                        type="text" 
                        inputMode="numeric"
                        autoFocus
                        value={newBalanceInput}
                        onChange={handleBalanceInputChange}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
                        placeholder="Ví dụ: 5,000,000"
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsEditingBalance(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                        <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-colors">Cập nhật</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Daily Limit Progress */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
         <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="font-bold text-slate-800">Hạn mức chi tiêu hôm nay</h3>
              <p className="text-sm text-slate-500 mt-1">
                Đã tiêu <span className="font-bold text-slate-700">{formatCurrency(todayExpense)}</span> / {formatCurrency(settings.dailyLimit)}
              </p>
            </div>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${dailyProgress > 90 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {Math.round(dailyProgress)}%
            </span>
         </div>
         <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
           <div 
             className={`h-full rounded-full transition-all duration-500 ${dailyProgress > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} 
             style={{ width: `${dailyProgress}%` }}
           ></div>
         </div>
      </div>

      {/* Timeline - Recent Activity */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
         <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
             <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Hoạt động hôm nay
         </h3>
         
         <div className="pl-2">
             {timelineData.map(([dateLabel, items], groupIndex) => (
                 <div key={dateLabel} className="relative pl-6 pb-2 border-l-2 border-slate-100 last:border-0 last:pb-0">
                     <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 border-2 border-white box-content"></div>
                     <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 -mt-1">{dateLabel}</h4>
                     
                     <div className="space-y-3 mb-6">
                         {items.map(t => (
                             <div key={t.id} className="relative flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100 group">
                                 <div className="flex items-center space-x-3">
                                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${t.type === TransactionType.INCOME ? 'bg-green-100' : 'bg-white border border-slate-200'}`}>
                                         {CategoryIcons[t.category] || '📦'}
                                     </div>
                                     <div>
                                         <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{t.description}</p>
                                         <p className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded-md inline-block mt-0.5 shadow-sm border border-slate-100">{t.category}</p>
                                     </div>
                                 </div>
                                 <span className={`font-bold text-sm ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-800'}`}>
                                     {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                                 </span>
                             </div>
                         ))}
                     </div>
                 </div>
             ))}
             
             {timelineData.length === 0 && (
                 <div className="text-center py-8">
                     <p className="text-slate-400 text-sm">Hôm nay chưa có giao dịch nào</p>
                 </div>
             )}
         </div>
      </div>
    </div>
  );
};