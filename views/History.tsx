
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Transaction, TransactionType, Category, CategoryIcons, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { formatCurrency } from '../services/geminiService';
import { TransactionModal } from '../components/TransactionModal';

interface HistoryProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onAdd: (transaction: Transaction) => void; 
}

// Helper để format ngày thân thiện
const getFriendlyDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const dayBeforeYesterday = new Date(today); dayBeforeYesterday.setDate(today.getDate() - 2);

    // Xóa phần giờ để so sánh chính xác ngày
    date.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    yesterday.setHours(0,0,0,0);
    dayBeforeYesterday.setHours(0,0,0,0);

    if (date.getTime() === today.getTime()) return "Hôm nay";
    if (date.getTime() === yesterday.getTime()) return "Hôm qua";
    if (date.getTime() === dayBeforeYesterday.getTime()) return "Hôm kia";
    
    // Nếu không phải 3 ngày trên thì trả về Thứ
    return date.toLocaleDateString('vi-VN', { weekday: 'long' });
};

// Helper format date input YYYY-MM-DD
const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const History: React.FC<HistoryProps> = ({ transactions, onDelete, onEdit, onAdd }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL'); // State cho Tab
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Thay thế filterDate đơn lẻ bằng startDate và endDate
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // State mới cho Search và Source Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterSource, setFilterSource] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');

  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  
  // State quản lý hiển thị nút FAB (Floating Action Button)
  const [showFab, setShowFab] = useState(true);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRowOpenRef = useRef(false); // Theo dõi xem có hàng nào đang bị vuốt mở không

  // Xử lý sự kiện cuộn để ẩn/hiện nút FAB và tự động đóng row khi cuộn dọc
  useEffect(() => {
    const handleScroll = (e: Event) => {
        const target = e.target as HTMLElement;
        const isSwipeContainer = target.hasAttribute('data-swipe-container');

        if (isSwipeContainer) {
            if (target.scrollLeft > 10) {
                isRowOpenRef.current = true;
                setShowFab(false);
                if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            } else {
                if (isRowOpenRef.current) {
                    isRowOpenRef.current = false;
                    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                    scrollTimeout.current = setTimeout(() => setShowFab(true), 300);
                }
            }
        } else {
            if (isRowOpenRef.current) {
                const openRows = document.querySelectorAll('[data-swipe-container="true"]');
                openRows.forEach(row => {
                    if (row.scrollLeft > 0) {
                        row.scrollTo({ left: 0, behavior: 'smooth' });
                    }
                });
                isRowOpenRef.current = false;
            }

            setShowFab(false);
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            scrollTimeout.current = setTimeout(() => {
                if (!isRowOpenRef.current) {
                    setShowFab(true);
                }
            }, 300);
        }
    };

    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => {
        window.removeEventListener('scroll', handleScroll, { capture: true });
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);
  
  // Reset filterCategory khi chuyển Tab loại giao dịch
  useEffect(() => {
    setFilterCategory('all');
  }, [filterType]);

  // Lấy danh sách danh mục hiển thị dựa trên Tab đang chọn
  const availableCategories = useMemo(() => {
      if (filterType === 'EXPENSE') return EXPENSE_CATEGORIES;
      if (filterType === 'INCOME') return INCOME_CATEGORIES;
      return Object.values(Category);
  }, [filterType]);

  const groupedData = useMemo(() => {
    // Reverse trước để các giao dịch mới thêm (nằm cuối mảng) được đưa lên đầu trước khi sort ngày
    let filtered = [...transactions].reverse().filter(t => {
        // Lọc theo Tab (Loại giao dịch)
        const matchesType = filterType === 'ALL' || 
                            (filterType === 'EXPENSE' && t.type === TransactionType.EXPENSE) ||
                            (filterType === 'INCOME' && t.type === TransactionType.INCOME);
        
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        
        // Lọc theo khoảng thời gian
        const matchesDate = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
        
        // Lọc theo Nguồn tiền (Cash/Bank)
        const matchesSource = filterSource === 'ALL' ||
            (filterSource === 'CASH' && (!t.paymentMethod || t.paymentMethod === 'CASH')) ||
            (filterSource === 'BANK' && (t.paymentMethod === 'TRANSFER' || t.paymentMethod === 'CARD'));

        // Lọc theo Tìm kiếm (Description, Person, Location)
        const normalizedSearch = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            t.description.toLowerCase().includes(normalizedSearch) ||
            (t.person && t.person.toLowerCase().includes(normalizedSearch)) ||
            (t.location && t.location.toLowerCase().includes(normalizedSearch));

        return matchesType && matchesCategory && matchesDate && matchesSource && matchesSearch;
    });

    // Stable sort by date descending
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

  }, [transactions, filterType, filterCategory, startDate, endDate, searchTerm, filterSource]);

  const handleEditClick = (t: Transaction) => {
      setEditingTransaction(t);
      setModalMode('EDIT');
  };

  // Các hàm chọn nhanh thời gian
  const setRangeLastWeek = () => {
    const today = new Date();
    const lastWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 - (today.getDay() || 7) + 1);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    setStartDate(formatDateInput(lastWeekStart));
    setEndDate(formatDateInput(lastWeekEnd));
  };

  const setRangeLastMonth = () => {
    const today = new Date();
    const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    setStartDate(formatDateInput(firstDayPrevMonth));
    setEndDate(formatDateInput(lastDayPrevMonth));
  };

  const setRangeThisMonth = () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDateInput(firstDay));
      setEndDate(formatDateInput(lastDay));
  };

  const clearFilters = () => {
      setFilterCategory('all');
      setStartDate('');
      setEndDate('');
      setFilterSource('ALL');
      setSearchTerm('');
  };

  const hasActiveFilters = filterCategory !== 'all' || startDate || endDate || filterSource !== 'ALL' || searchTerm;

  return (
    // Padding bottom lớn để đảm bảo nội dung cuối cùng nằm trên nút FAB
    <div className="space-y-4 pb-32 md:pb-10 animate-fade-in relative">
      
      {/* 1. Main Tabs (Type Filter) - Sticky Top */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl pt-2 pb-2 transition-transform duration-300 shadow-sm border-b border-slate-100/50">
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner mx-1">
            <button 
                onClick={() => setFilterType('ALL')} 
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${filterType === 'ALL' ? 'bg-white text-indigo-600 shadow-sm scale-[1.02]' : 'text-slate-400'}`}
            >
                Tất cả
            </button>
            <button 
                onClick={() => setFilterType('EXPENSE')} 
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${filterType === 'EXPENSE' ? 'bg-white text-red-500 shadow-sm scale-[1.02]' : 'text-slate-400'}`}
            >
                Chi tiêu
            </button>
            <button 
                onClick={() => setFilterType('INCOME')} 
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${filterType === 'INCOME' ? 'bg-white text-green-500 shadow-sm scale-[1.02]' : 'text-slate-400'}`}
            >
                Thu nhập
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="mt-2 px-1">
             <div className="relative">
                 <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="🔍 Tìm theo tên, địa điểm, người..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                 />
                 <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                 </div>
                 {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 )}
             </div>
          </div>
      </div>

      {/* 2. Secondary Filters (Source, Category & Date Range) */}
      <div className="flex flex-col gap-2 px-1">
          {/* Row 1: Source & Category */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value as any)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none shrink-0 shadow-sm text-slate-600"
            >
                <option value="ALL">💰 Tất cả nguồn</option>
                <option value="CASH">💵 Tiền mặt</option>
                <option value="BANK">🏦 Ngân hàng</option>
            </select>

            <select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)} 
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none shrink-0 shadow-sm text-slate-600"
            >
                <option value="all">📁 Tất cả danh mục</option>
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
             
            {/* Quick Date Shortcuts */}
            <button onClick={setRangeLastWeek} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm border border-indigo-100">
                 Tuần trước
            </button>
            <button onClick={setRangeLastMonth} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm border border-indigo-100">
                 Tháng trước
            </button>
             <button onClick={setRangeThisMonth} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm border border-indigo-100">
                 Tháng này
            </button>

            {hasActiveFilters && (
                <button onClick={clearFilters} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm">
                    ✕ Bỏ lọc
                </button>
            )}
          </div>

          {/* Row 2: Date Range Inputs */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase">Từ:</span>
              <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="flex-1 bg-white border border-slate-200 rounded-lg text-xs font-bold p-1.5 focus:ring-1 focus:ring-brand-500 outline-none min-w-0" 
              />
              <span className="text-xs font-bold text-slate-400 uppercase">Đến:</span>
              <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="flex-1 bg-white border border-slate-200 rounded-lg text-xs font-bold p-1.5 focus:ring-1 focus:ring-brand-500 outline-none min-w-0" 
              />
          </div>
      </div>

      <div className="space-y-3 mt-2">
        {groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <div className="text-4xl mb-2 opacity-40">📭</div>
             <p className="text-sm font-medium">Không tìm thấy giao dịch nào</p>
          </div>
        ) : (
          groupedData.map(group => {
            const netAmount = group.income - group.expense;
            return (
            <div key={group.date} className="space-y-1.5 animate-fade-in">
                {/* Date Header: Chữ to hơn, dùng Friendly Date */}
                <div className="flex items-center justify-between px-3 sticky top-[165px] z-20 bg-slate-50/95 backdrop-blur-md py-2 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 transition-all">
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                            {getFriendlyDate(group.date)}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">
                            {new Date(group.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Summary Block */}
                        <div className="flex flex-col items-end">
                            <div className={`text-lg font-black tracking-tight ${netAmount >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                                {netAmount > 0 ? '+' : ''}{formatCurrency(netAmount)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    {group.transactions.map(t => (
                        <div key={t.id} className="relative w-full overflow-hidden rounded-xl shadow-sm border border-slate-100 bg-white group">
                            <div 
                                data-swipe-container="true"
                                className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar" 
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                {/* Main Content: Tăng font size (text-base cho mô tả và tiền) */}
                                <div className="min-w-full snap-start bg-white p-3 flex items-center justify-between relative">
                                    {!t.isSynced && <div className="absolute top-0 right-0 w-2 h-2 bg-amber-400 rounded-full m-1.5" title="Chưa đồng bộ"></div>}
                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shrink-0">{CategoryIcons[t.category] || '📦'}</div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 text-base truncate">{t.description}</p>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                <span className="text-xs text-slate-500 font-bold whitespace-nowrap">{t.category}</span>
                                                {/* Thêm indicator Bank/Cash */}
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200 ${t.paymentMethod === 'TRANSFER' || t.paymentMethod === 'CARD' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {(t.paymentMethod === 'TRANSFER' || t.paymentMethod === 'CARD') ? '🏦 Bank' : '💵 Ví'}
                                                </span>
                                                {t.person && <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">👤 {t.person}</span>}
                                                {t.location && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">📍 {t.location}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`font-black text-base whitespace-nowrap ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                                            {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                                        </span>
                                        <div className="text-slate-300 md:hidden flex items-center">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Slide Actions */}
                                <div className="flex snap-end">
                                    <button onClick={() => handleEditClick(t)} className="w-16 bg-blue-500 text-white flex flex-col items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        <span className="text-[10px] font-bold mt-1">Sửa</span>
                                    </button>
                                    <button onClick={() => onDelete(t.id)} className="w-16 bg-red-500 text-white flex flex-col items-center justify-center rounded-r-xl">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        <span className="text-[10px] font-bold mt-1">Xóa</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            );
          })
        )}
      </div>

      {/* Floating Add Button with Scroll Logic */}
      <button 
        onClick={() => { setEditingTransaction(undefined); setModalMode('ADD'); }}
        className={`fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-brand-600 text-white rounded-full shadow-2xl shadow-brand-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 z-30 ${showFab ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}
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
