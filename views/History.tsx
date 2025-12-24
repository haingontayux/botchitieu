import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Category, CategoryIcons } from '../types';
import { formatCurrency } from '../services/geminiService';

interface HistoryProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

const SwipeableTransactionRow: React.FC<{
  t: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ t, onEdit, onDelete }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef(false);
  const ACTION_WIDTH = 140;

  // Handlers for both Touch and Mouse
  const onStart = (clientX: number) => {
    startX.current = clientX;
    isDragging.current = true;
    isHorizontal.current = false;
  };

  const onMove = (clientX: number) => {
    if (!isDragging.current) return;
    const deltaX = clientX - startX.current;
    
    if (!isHorizontal.current && Math.abs(deltaX) > 10) {
        isHorizontal.current = true;
    }

    if (isHorizontal.current) {
        // Only allow swiping left
        let newOffset = deltaX;
        if (newOffset > 0) newOffset = 0;
        if (newOffset < -ACTION_WIDTH - 20) newOffset = -ACTION_WIDTH - 20;
        setOffset(newOffset);
    }
  };

  const onEnd = () => {
    isDragging.current = false;
    if (offset < -ACTION_WIDTH / 2) {
      setOffset(-ACTION_WIDTH);
    } else {
      setOffset(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-3 bg-slate-100 select-none h-[80px]">
      {/* Action Buttons Background */}
      <div className="absolute inset-y-0 right-0 w-[140px] flex">
         <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex-1 bg-blue-500 text-white flex flex-col items-center justify-center active:bg-blue-600">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
           <span className="text-[10px] font-bold mt-1">Sửa</span>
         </button>
         <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex-1 bg-red-500 text-white flex flex-col items-center justify-center active:bg-red-600">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
           <span className="text-[10px] font-bold mt-1">Xoá</span>
         </button>
      </div>

      {/* Foreground Content */}
      <div 
        className="bg-white p-4 h-full relative z-10 border border-slate-100 shadow-sm flex items-center justify-between transition-transform duration-200 cursor-grab active:cursor-grabbing"
        style={{ transform: `translateX(${offset}px)` }}
        
        // Touch Events
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}

        // Mouse Events (PC support)
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0 pointer-events-none">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl shadow-inner shrink-0">
            {CategoryIcons[t.category] || '📦'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{t.description}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{t.category}</span>
              {t.paymentMethod === 'TRANSFER' && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-100">🏦 Chuyển khoản</span>}
              {t.paymentMethod === 'CARD' && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-bold border border-purple-100">💳 Thẻ</span>}
              {t.person && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">👤 {t.person}</span>}
            </div>
          </div>
        </div>
        
        <div className="text-right pointer-events-none ml-2">
            <p className={`font-bold text-base ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
              {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
            </p>
            <p className="text-[9px] text-slate-400 font-medium">{new Date(t.date).toLocaleDateString('vi-VN')}</p>
        </div>
      </div>
    </div>
  );
};

export const History: React.FC<HistoryProps> = ({ transactions, onDelete, onEdit }) => {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  
  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesDate = t.date.startsWith(filterDate);
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (t.person && t.person.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesDate && matchesSearch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterDate, searchTerm]);

  return (
    <div className="space-y-4 pb-32 md:pb-10 animate-fade-in">
      {/* Search & Filter Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex gap-2">
            <input 
                type="month" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
            <div className="relative flex-[2]">
                <input 
                    type="text" 
                    placeholder="Tìm theo mô tả, tên..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
        </div>
      </div>

      <div className="px-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
             <div className="text-4xl mb-2">📭</div>
             <p className="text-sm">Không tìm thấy giao dịch nào</p>
          </div>
        ) : (
          filtered.map(t => (
            <SwipeableTransactionRow 
                key={t.id} 
                t={t} 
                onEdit={() => onEdit(t)} 
                onDelete={() => onDelete(t.id)} 
            />
          ))
        )}
      </div>
    </div>
  );
};