
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
  const ACTION_WIDTH = 140;

  // Touch Events
  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; isDragging.current = true; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.touches[0].clientX - startX.current;
    if (deltaX < 0) setOffset(Math.max(deltaX, -ACTION_WIDTH * 1.2));
  };
  const handleTouchEnd = () => {
    isDragging.current = false;
    setOffset(offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
  };

  // Mouse Events (For Desktop Observation)
  const handleMouseDown = (e: React.MouseEvent) => { startX.current = e.clientX; isDragging.current = true; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - startX.current;
    if (deltaX < 0) setOffset(Math.max(deltaX, -ACTION_WIDTH * 1.2));
  };
  const handleMouseUp = () => {
    isDragging.current = false;
    setOffset(offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl mb-3 bg-slate-100 select-none">
      <div className="absolute inset-y-0 right-0 w-[140px] flex">
         <button onClick={onEdit} className="flex-1 bg-blue-500 text-white text-xs font-bold">Sửa</button>
         <button onClick={onDelete} className="flex-1 bg-red-500 text-white text-xs font-bold">Xoá</button>
      </div>
      <div 
        className="bg-white p-4 relative z-10 border border-slate-100 transition-transform duration-200 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-xl">{CategoryIcons[t.category] || '📦'}</div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{t.description}</p>
            <div className="flex gap-1 mt-1">
              <span className="text-[9px] bg-slate-100 px-1 rounded">{t.category}</span>
              {t.paymentMethod === 'TRANSFER' && <span className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded">🏦 CK</span>}
              {t.paymentMethod === 'CARD' && <span className="text-[9px] bg-purple-50 text-purple-600 px-1 rounded">💳 Thẻ</span>}
            </div>
          </div>
        </div>
        <span className={`font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
          {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
        </span>
      </div>
    </div>
  );
};

export const History: React.FC<HistoryProps> = ({ transactions, onDelete, onEdit }) => {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 7));
  
  const filtered = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(filterDate)).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterDate]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur p-3 rounded-xl border border-slate-100 shadow-sm">
        <input type="month" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" />
      </div>
      <div className="pb-24">
        {filtered.length === 0 ? <p className="text-center text-slate-400 py-10">Không có dữ liệu</p> : 
          // Fix: Use t.id instead of non-existent variable id in the onDelete callback.
          filtered.map(t => <SwipeableTransactionRow key={t.id} t={t} onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />)}
      </div>
    </div>
  );
};
