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

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let start = 0; const end = value; if (start === end) return;
    const duration = 1500; const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(start + (end - start) * ease);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{formatCurrency(displayValue)}</>;
};

export const Dashboard: React.FC<DashboardProps> = ({ transactions, settings, onProcessPending, isProcessingId, onUpdateSettings }) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState<string>('');

  const confirmedTransactions = useMemo(() => transactions.filter(t => t.status !== 'PENDING'), [transactions]);
  const pendingTransactions = useMemo(() => transactions.filter(t => t.status === 'PENDING'), [transactions]);

  const recentTransactions = useMemo(() => {
      return [...confirmedTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [confirmedTransactions]);

  const stats = useMemo(() => {
    const totalIncome = confirmedTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = confirmedTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    const now = new Date();
    const currentMonthTx = confirmedTransactions.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
    
    return {
      monthIncome: currentMonthTx.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0),
      monthExpense: currentMonthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0),
      totalBalance: (settings.initialBalance || 0) + totalIncome - totalExpense,
      totalIncomeLifetime: totalIncome,
      totalExpenseLifetime: totalExpense
    };
  }, [confirmedTransactions, settings]);

  const todayExpense = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return confirmedTransactions.filter(t => t.type === TransactionType.EXPENSE && t.date === today).reduce((acc, t) => acc + t.amount, 0);
  }, [confirmedTransactions]);

  const saveNewBalance = (e: React.FormEvent) => {
      e.preventDefault();
      if (!onUpdateSettings) return;
      const targetBalance = Number(newBalanceInput.replace(/,/g, ''));
      if (isNaN(targetBalance)) return;
      onUpdateSettings({ ...settings, initialBalance: targetBalance - (stats.totalIncomeLifetime - stats.totalExpenseLifetime) });
      setIsEditingBalance(false);
  };

  const dailyProgress = Math.min((todayExpense / settings.dailyLimit) * 100, 100);

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
      
      {pendingTransactions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-6 shadow-sm animate-pulse-slow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-yellow-800">Cần xác nhận</h3>
            <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">{pendingTransactions.length}</span>
          </div>
          <div className="space-y-3">
            {pendingTransactions.map(t => (
              <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 flex items-center justify-between">
                <div className="min-w-0 pr-2"><p className="font-bold text-slate-800 truncate">{t.description}</p></div>
                <button onClick={() => onProcessPending && onProcessPending(t)} disabled={isProcessingId === t.id} className="shrink-0 px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm">
                  {isProcessingId === t.id ? '...' : 'Duyệt'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div onClick={() => { setNewBalanceInput(stats.totalBalance.toLocaleString('en-US')); setIsEditingBalance(true); }} className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-3xl p-8 text-white shadow-xl shadow-brand-500/30 relative overflow-hidden cursor-pointer transform transition-all hover:scale-[1.01]">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         <div className="relative z-10">
            <p className="text-brand-100 font-medium mb-1">Tổng số dư</p>
            <h2 className="text-4xl font-bold tracking-tight"><AnimatedNumber value={stats.totalBalance} /></h2>
            <div className="mt-8 flex items-center space-x-8">
              <div><p className="text-brand-100 text-sm">Thu nhập tháng</p><p className="text-xl font-semibold"><AnimatedNumber value={stats.monthIncome} /></p></div>
              <div><p className="text-brand-100 text-sm">Chi tiêu tháng</p><p className="text-xl font-semibold"><AnimatedNumber value={stats.monthExpense} /></p></div>
            </div>
         </div>
      </div>

      {isEditingBalance && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsEditingBalance(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-800 mb-4">Sửa số dư</h3>
                <form onSubmit={saveNewBalance}>
                    <input autoFocus type="text" value={newBalanceInput} onChange={e => setNewBalanceInput(Number(e.target.value.replace(/,/g, '').replace(/\D/g, '')).toLocaleString('en-US'))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold mb-6 focus:ring-2 focus:ring-brand-500" />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsEditingBalance(false)} className="flex-1 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl">Hủy</button>
                        <button type="submit" className="flex-1 py-3 bg-brand-600 font-bold text-white rounded-xl">Lưu</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
         <div className="flex justify-between items-end mb-2">
            <div><h3 className="font-bold text-slate-800">Hạn mức hôm nay</h3><p className="text-sm text-slate-500">{formatCurrency(todayExpense)} / {formatCurrency(settings.dailyLimit)}</p></div>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${dailyProgress > 90 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{Math.round(dailyProgress)}%</span>
         </div>
         <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
           <div className={`h-full rounded-full transition-all duration-500 ${dailyProgress > 90 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${dailyProgress}%` }}></div>
         </div>
      </div>

      <div className="space-y-4">
         <h3 className="font-bold text-slate-800 ml-1">Hoạt động gần đây</h3>
         {recentTransactions.length === 0 ? (
             <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm">
                 Chưa có giao dịch nào
             </div>
         ) : (
             <div className="pl-4 border-l-2 border-slate-200 space-y-6">
                 {recentTransactions.map(t => (
                    <div key={t.id} className="relative pl-6">
                         <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${t.type === TransactionType.INCOME ? 'bg-green-500' : 'bg-red-500'}`}></div>
                         
                         <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                             <div className="min-w-0 pr-2">
                                <p className="font-bold text-slate-800 text-sm truncate">{t.description}</p>
                                <div className="flex items-center gap-2 mt-1 overflow-hidden">
                                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 whitespace-nowrap">{t.category}</span>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(t.date).toLocaleDateString('vi-VN')}</span>
                                </div>
                             </div>
                             <span className={`font-bold text-sm shrink-0 ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                                 {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                             </span>
                         </div>
                    </div>
                 ))}
             </div>
         )}
      </div>
    </div>
  );
};