import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Category, CategoryIcons } from '../types';
import { formatCurrency } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface HistoryProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onAdd: (transaction: Transaction) => void; 
}

const TransactionModal: React.FC<{ 
    onClose: () => void, 
    onSave: (t: Transaction) => void,
    initialData?: Transaction 
}> = ({ onClose, onSave, initialData }) => {
    const [amount, setAmount] = useState(initialData ? initialData.amount.toLocaleString('en-US') : '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState<string>(initialData?.category || Category.OTHER);
    const [type, setType] = useState<TransactionType>(initialData?.type || TransactionType.EXPENSE);
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    
    // Additional Fields
    const [person, setPerson] = useState(initialData?.person || '');
    const [location, setLocation] = useState(initialData?.location || '');

    const handleSubmit = () => {
        if (!amount || !description) return alert("Vui lòng nhập số tiền và mô tả");
        const numAmount = parseInt(amount.replace(/\D/g, ''), 10);
        
        onSave({
            id: initialData?.id || uuidv4(),
            amount: numAmount,
            description,
            category,
            type,
            date,
            status: 'CONFIRMED',
            paymentMethod: initialData?.paymentMethod || 'CASH',
            isSynced: initialData ? initialData.isSynced : false,
            person: person.trim() || undefined,
            location: location.trim() || undefined
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 mb-4 shrink-0">{initialData ? 'Sửa giao dịch' : 'Thêm giao dịch mới'}</h3>
                
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 px-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setType(TransactionType.EXPENSE)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === TransactionType.EXPENSE ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}>Chi tiêu</button>
                        <button onClick={() => setType(TransactionType.INCOME)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === TransactionType.INCOME ? 'bg-white text-green-500 shadow-sm' : 'text-slate-400'}`}>Thu nhập</button>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Số tiền</label>
                        <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ","))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0" autoFocus />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Mô tả</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Ví dụ: Ăn phở..." />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cho ai / Với ai</label>
                            <input type="text" value={person} onChange={e => setPerson(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Mẹ, Nam..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ở đâu</label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Shop, chợ..." />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Danh mục</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none appearance-none">
                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ngày</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6 shrink-0">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl transition-all active:scale-95">Hủy</button>
                    <button onClick={handleSubmit} className="flex-1 py-3 bg-brand-600 font-bold text-white rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all active:scale-95">Lưu</button>
                </div>
            </div>
        </div>
    );
}

export const History: React.FC<HistoryProps> = ({ transactions, onDelete, onEdit, onAdd }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [displayLimit, setDisplayLimit] = useState(7);
  
  const groupedData = useMemo(() => {
    let filtered = transactions.filter(t => {
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        const matchesDate = !filterDate || t.date === filterDate;
        return matchesCategory && matchesDate;
    });

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const groups: Record<string, { transactions: Transaction[], income: number, expense: number }> = {};
    
    filtered.forEach(t => {
        if (!groups[t.date]) {
            groups[t.date] = { transactions: [], income: 0, expense: 0 };
        }
        groups[t.date].transactions.push(t);
        if (t.type === TransactionType.INCOME) groups[t.date].income += t.amount;
        else groups[t.date].expense += t.amount;
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return sortedKeys.map(date => ({
        date,
        ...groups[date]
    }));

  }, [transactions, filterCategory, filterDate]);

  const visibleGroups = groupedData.slice(0, displayLimit);
  const hasMore = groupedData.length > displayLimit;

  const handleEditClick = (t: Transaction) => {
      setEditingTransaction(t);
      setModalMode('EDIT');
  };

  return (
    <div className="space-y-4 pb-32 md:pb-10 animate-fade-in relative h-full">
      
      {/* Filters Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
         <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)} 
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none shrink-0"
         >
            <option value="all">Tất cả danh mục</option>
            {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
         </select>
         <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none shrink-0" 
         />
         {(filterCategory !== 'all' || filterDate) && (
             <button onClick={() => { setFilterCategory('all'); setFilterDate(''); }} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold whitespace-nowrap">
                 Xóa lọc
             </button>
         )}
      </div>

      <div className="space-y-6">
        {visibleGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <div className="text-4xl mb-2 opacity-40">📭</div>
             <p className="text-sm font-medium">Không tìm thấy giao dịch nào</p>
          </div>
        ) : (
          visibleGroups.map(group => (
            <div key={group.date} className="space-y-2 animate-fade-in">
                {/* Date Header with Daily Totals */}
                <div className="flex items-center justify-between px-2 sticky top-14 z-10 bg-slate-50/80 backdrop-blur-sm py-2 rounded-lg">
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            {new Date(group.date).toLocaleDateString('vi-VN', { weekday: 'long' })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                            {new Date(group.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {group.income > 0 && (
                            <div className="bg-green-50 px-2 py-1 rounded-lg text-right">
                                <p className="text-[8px] uppercase font-bold text-green-500 leading-none">Thu</p>
                                <p className="text-[10px] font-black text-green-600">{formatCurrency(group.income)}</p>
                            </div>
                        )}
                        {group.expense > 0 && (
                            <div className="bg-red-50 px-2 py-1 rounded-lg text-right">
                                <p className="text-[8px] uppercase font-bold text-red-400 leading-none">Chi</p>
                                <p className="text-[10px] font-black text-red-600">{formatCurrency(group.expense)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Daily Transactions */}
                <div className="space-y-2">
                    {group.transactions.map(t => (
                        <div key={t.id} className="relative w-full overflow-hidden rounded-2xl shadow-sm border border-slate-100 bg-white group">
                            <div className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar" style={{ scrollBehavior: 'smooth' }}>
                                {/* Main Content (Swipeable) */}
                                <div className="min-w-full snap-start bg-white p-4 flex items-center justify-between relative">
                                    {!t.isSynced && <div className="absolute top-0 right-0 w-2 h-2 bg-amber-400 rounded-full m-1.5" title="Chưa đồng bộ"></div>}
                                    <div className="flex items-center gap-3 min-w-0 pr-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">{CategoryIcons[t.category] || '📦'}</div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate">{t.description}</p>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">{t.category}</span>
                                                {t.person && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">👤 {t.person}</span>}
                                                {t.location && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">📍 {t.location}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`font-black text-sm whitespace-nowrap ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                                            {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                                        </span>
                                        <div className="text-slate-300 md:hidden flex items-center">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Slide Actions */}
                                <div className="flex snap-end">
                                    <button onClick={() => handleEditClick(t)} className="w-16 bg-blue-500 text-white flex flex-col items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        <span className="text-[9px] font-bold mt-1">Sửa</span>
                                    </button>
                                    <button onClick={() => onDelete(t.id)} className="w-16 bg-red-500 text-white flex flex-col items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        <span className="text-[9px] font-bold mt-1">Xóa</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          ))
        )}
        
        {hasMore && (
            <button 
                onClick={() => setDisplayLimit(prev => prev + 7)}
                className="w-full py-4 text-xs font-black uppercase tracking-widest text-brand-600 bg-brand-50 rounded-2xl hover:bg-brand-100 transition-all active:scale-[0.98]"
            >
                Xem thêm ngày cũ hơn
            </button>
        )}
      </div>

      {/* Floating Add Button */}
      <button 
        onClick={() => { setEditingTransaction(undefined); setModalMode('ADD'); }}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-brand-600 text-white rounded-full shadow-2xl shadow-brand-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-30"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
      </button>

      {modalMode && (
        <TransactionModal 
            onClose={() => setModalMode(null)} 
            onSave={(t) => {
                if (modalMode === 'ADD') onAdd(t);
                else onEdit(t);
            }}
            initialData={editingTransaction}
        />
      )}
    </div>
  );
};