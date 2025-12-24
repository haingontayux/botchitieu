import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Category, CategoryIcons } from '../types';
import { formatCurrency } from '../services/geminiService';

interface HistoryProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

// Separate Categories for Filtering Logic
const INCOME_CATEGORIES = [Category.SALARY, Category.INVESTMENT, Category.OTHER];
const EXPENSE_CATEGORIES = [Category.FOOD, Category.TRANSPORT, Category.SHOPPING, Category.BILLS, Category.ENTERTAINMENT, Category.HEALTH, Category.EDUCATION, Category.OTHER];

// --- Swipeable Row (Edit + Delete Pattern) ---
const SwipeableTransactionRow: React.FC<{
  t: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ t, onEdit, onDelete }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef(false); 
  const ACTION_WIDTH = 140; // Width of both buttons combined

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isHorizontal.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - startX.current;
    const deltaY = touchY - startY.current;

    if (!isHorizontal.current) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
            isHorizontal.current = true;
        } else if (Math.abs(deltaY) > 5) {
            isDragging.current = false;
            return;
        }
    }

    if (isHorizontal.current) {
        if (e.cancelable) e.preventDefault();
        
        let newOffset = deltaX;
        if (newOffset > 0) newOffset = 0; // Prevent swipe right
        if (newOffset < -ACTION_WIDTH * 1.2) newOffset = -ACTION_WIDTH * 1.2; // Elastic limit

        setOffset(newOffset);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    isDragging.current = false;
    // Snap logic
    if (offset < -ACTION_WIDTH / 3) {
      setOffset(-ACTION_WIDTH);
    } else {
      setOffset(0);
    }
  };

  const handleDeleteImmediate = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOffset(-1000); // Animation out
      setTimeout(() => onDelete(), 200);
  };

  const handleEditClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOffset(0); // Close swipe
      onEdit();
  };

  return (
    <div className="relative overflow-hidden rounded-xl mb-3 select-none h-auto min-h-[85px] w-full bg-slate-100">
      {/* Background Actions */}
      <div className="absolute inset-y-0 right-0 w-[140px] flex">
         <button 
          onClick={handleEditClick}
          className="flex-1 bg-blue-500 text-white flex flex-col items-center justify-center active:bg-blue-600 border-r border-blue-400"
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <span className="text-[10px] font-bold">Sửa</span>
        </button>
        <button 
          onClick={handleDeleteImmediate}
          className="flex-1 bg-red-500 text-white flex flex-col items-center justify-center active:bg-red-600"
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span className="text-[10px] font-bold">Xoá</span>
        </button>
      </div>

      {/* Foreground Content */}
      <div 
        className="bg-white p-4 h-full shadow-sm border border-slate-100 absolute inset-0 z-10 flex items-center justify-between transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
            if (offset !== 0) setOffset(0);
            else onEdit(); 
        }} 
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${t.type === TransactionType.INCOME ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}>
             {CategoryIcons[t.category] || '📦'}
          </div>

          <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <p className="font-bold text-slate-800 text-base truncate mr-2 leading-tight">{t.description}</p>
                  <span className={`font-bold text-base whitespace-nowrap ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                 </span>
              </div>
              
              <div className="flex flex-wrap items-center mt-1 gap-2">
                 <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                    {t.category}
                 </span>
                 {t.person && (
                   <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-100">
                     👤 {t.person}
                   </span>
                 )}
                 {t.location && (
                   <span className="text-[10px] font-medium bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded flex items-center gap-1 border border-orange-100">
                     📍 {t.location}
                   </span>
                 )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const History: React.FC<HistoryProps> = ({ transactions, onDelete, onEdit }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchText, setSearchText] = useState('');
  const [visibleDaysCount, setVisibleDaysCount] = useState(7);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleDaysCount(7);
  }, [filterType, filterCategory, filterDate, searchText]);

  // Determine available categories based on type
  const availableCategories = useMemo(() => {
      if (filterType === 'INCOME') return INCOME_CATEGORIES;
      if (filterType === 'EXPENSE') return EXPENSE_CATEGORIES;
      return Object.values(Category);
  }, [filterType]);

  const filteredList = useMemo(() => {
    return transactions
      .filter(t => {
          const matchType = filterType === 'ALL' || t.type === filterType;
          const matchCat = filterCategory === 'ALL' || t.category === filterCategory;
          const matchDate = t.date.startsWith(filterDate);
          
          let matchSearch = true;
          if (searchText.trim()) {
              const lowerSearch = searchText.toLowerCase();
              matchSearch = t.description.toLowerCase().includes(lowerSearch) || 
                            (t.person && t.person.toLowerCase().includes(lowerSearch)) || 
                            (t.location && t.location.toLowerCase().includes(lowerSearch)) || 
                            false;
          }

          return matchType && matchCat && matchDate && matchSearch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, filterCategory, filterDate, searchText]);

  const groupedByDateEntries = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    filteredList.forEach(t => {
       const dateObj = new Date(t.date);
       let key = dateObj.toLocaleDateString('vi-VN');
       if (dateObj.toDateString() === today) key = "Hôm nay";
       else if (dateObj.toDateString() === yesterday) key = "Hôm qua";
       
       if (!groups[key]) groups[key] = [];
       groups[key].push(t);
    });
    return Object.entries(groups);
  }, [filteredList]);

  // Apply Pagination
  const visibleGroups = groupedByDateEntries.slice(0, visibleDaysCount);
  const hasMore = visibleDaysCount < groupedByDateEntries.length;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      onEdit(editingTransaction);
      setEditingTransaction(null);
    }
  };

  const handleDeleteFromModal = () => {
    if (editingTransaction) {
        onDelete(editingTransaction.id);
        setEditingTransaction(null);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingTransaction) return;
    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
    const val = rawValue ? Number(rawValue) : 0;
    setEditingTransaction({ ...editingTransaction, amount: val });
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20 md:pb-0">
      
      {/* Filters Container */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 space-y-3 sticky top-0 z-20">
          {/* Type Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full">
            <button onClick={() => setFilterType('ALL')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tất cả</button>
            <button onClick={() => setFilterType('EXPENSE')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'EXPENSE' ? 'bg-white shadow-sm text-red-500' : 'text-slate-500'}`}>Chi tiêu</button>
            <button onClick={() => setFilterType('INCOME')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'INCOME' ? 'bg-white shadow-sm text-green-500' : 'text-slate-500'}`}>Thu nhập</button>
          </div>

          {/* Search Input */}
          <div>
            <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
                <input 
                    type="text"
                    placeholder="Tìm theo người, địa điểm, nội dung..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
          </div>

          <div className="flex gap-3">
              <div className="flex-1">
                  <input 
                      type="month" 
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
              </div>
              <div className="flex-1">
                  <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                      <option value="ALL">Tất cả danh mục</option>
                      {availableCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                      ))}
                  </select>
              </div>
          </div>
      </div>

      {/* Main List */}
      <div className="space-y-6">
        {groupedByDateEntries.length === 0 && (
           <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
             <div className="text-2xl mb-2">📭</div>
             <p className="text-slate-400 text-sm">Không tìm thấy giao dịch</p>
           </div>
        )}

        {visibleGroups.map(([dateLabel, items]) => {
            const dayNet = (items as Transaction[]).reduce((acc, t) => acc + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);

            return (
                <div key={dateLabel}>
                    <div className="sticky top-[150px] z-10 bg-[#F8FAFC]/95 backdrop-blur-md py-3 mb-2 flex justify-between items-center border-b border-slate-100/50 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{dateLabel}</h3>
                        <div className="mr-1">
                            <span className={`text-lg font-bold ${dayNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {dayNet > 0 ? '+' : ''}{formatCurrency(dayNet)}
                            </span>
                        </div>
                    </div>
                    {(items as Transaction[]).map(t => (
                        <SwipeableTransactionRow 
                            key={t.id} 
                            t={t} 
                            onDelete={() => onDelete(t.id)} 
                            onEdit={() => setEditingTransaction(t)} 
                        />
                    ))}
                </div>
            );
        })}

        {/* Load More Button */}
        {hasMore && (
            <button 
                onClick={() => setVisibleDaysCount(prev => prev + 7)}
                className="w-full py-3 bg-white border border-slate-200 text-indigo-600 font-bold rounded-xl shadow-sm hover:bg-indigo-50 transition-colors"
            >
                Xem thêm 7 ngày
            </button>
        )}
      </div>

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingTransaction(null)}>
           <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Sửa giao dịch</h3>
                <button onClick={() => setEditingTransaction(null)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <form onSubmit={handleUpdate} className="space-y-3 overflow-y-auto pr-1">
                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả</label>
                   <input 
                      type="text" 
                      value={editingTransaction.description} 
                      onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                   />
                </div>
                
                {/* Person & Location Inputs */}
                <div className="grid grid-cols-2 gap-3">
                   <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Người (Với ai/Cho ai)</label>
                       <input 
                          type="text" 
                          placeholder="VD: Nam"
                          value={editingTransaction.person || ''} 
                          onChange={e => setEditingTransaction({...editingTransaction, person: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Địa điểm</label>
                       <input 
                          type="text" 
                          placeholder="VD: Vinmart"
                          value={editingTransaction.location || ''} 
                          onChange={e => setEditingTransaction({...editingTransaction, location: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số tiền</label>
                    <input 
                        type="text" 
                        inputMode="numeric"
                        value={editingTransaction.amount ? editingTransaction.amount.toLocaleString('en-US') : ''}
                        onChange={handleAmountChange}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Loại</label>
                    <select 
                       value={editingTransaction.type}
                       onChange={e => setEditingTransaction({...editingTransaction, type: e.target.value as TransactionType})}
                       className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={TransactionType.EXPENSE}>Chi tiêu</option>
                      <option value={TransactionType.INCOME}>Thu nhập</option>
                    </select>
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1">Danh mục</label>
                   <select 
                      value={editingTransaction.category} 
                      onChange={e => setEditingTransaction({...editingTransaction, category: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   >
                     {Object.values(Category).map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                </div>
                
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1">Ngày</label>
                   <input 
                      type="date" 
                      value={editingTransaction.date.split('T')[0]} 
                      onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   />
                </div>

                <div className="pt-2 flex flex-col gap-3">
                   <div className="flex gap-3">
                      <button type="button" onClick={() => setEditingTransaction(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-200">Hủy</button>
                      <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-lg text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">Lưu</button>
                   </div>
                   <button 
                    type="button" 
                    onClick={handleDeleteFromModal}
                    className="w-full py-2.5 border border-red-200 text-red-600 font-bold rounded-lg text-sm hover:bg-red-50 flex items-center justify-center gap-2"
                   >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Xóa giao dịch này
                   </button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};