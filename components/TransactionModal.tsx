
import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Category, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TransactionModalProps { 
    onClose: () => void;
    onSave: (t: Transaction) => void;
    initialData?: Transaction;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ onClose, onSave, initialData }) => {
    const [amount, setAmount] = useState(initialData ? initialData.amount.toLocaleString('en-US') : '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [type, setType] = useState<TransactionType>(initialData?.type || TransactionType.EXPENSE);
    
    // Logic chọn danh mục mặc định thông minh
    const defaultCategory = initialData?.category || (type === TransactionType.EXPENSE ? Category.FOOD : Category.SALARY);
    const [category, setCategory] = useState<string>(defaultCategory);
    
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    
    // Additional Fields
    const [person, setPerson] = useState(initialData?.person || '');
    const [location, setLocation] = useState(initialData?.location || '');
    
    // Payment Method: 'CASH' (Tiền mặt) or 'TRANSFER' (Ngân hàng)
    // Map existing types: 'CARD' & 'TRANSFER' -> Bank, 'CASH' -> Cash
    // FIX: Nếu không có initialData (thêm mới), mặc định là CASH.
    // Nếu có initialData nhưng không có paymentMethod (data cũ/lỗi), mặc định là CASH.
    // Chỉ chọn TRANSFER nếu initialData.paymentMethod rõ ràng là TRANSFER hoặc CARD.
    const initialMethod = (initialData?.paymentMethod === 'TRANSFER' || initialData?.paymentMethod === 'CARD') ? 'TRANSFER' : 'CASH';
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>(initialMethod);

    // Cập nhật danh mục khi đổi loại giao dịch
    useEffect(() => {
        if (!initialData) { // Chỉ reset khi đang thêm mới
            if (type === TransactionType.EXPENSE && !EXPENSE_CATEGORIES.includes(category as Category)) {
                setCategory(Category.FOOD);
            } else if (type === TransactionType.INCOME && !INCOME_CATEGORIES.includes(category as Category)) {
                setCategory(Category.SALARY);
            }
        }
    }, [type]);

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
            paymentMethod: paymentMethod, // Sử dụng giá trị từ UI
            isSynced: initialData ? initialData.isSynced : false,
            person: person.trim() || undefined,
            location: location.trim() || undefined
        });
        onClose();
    };

    const currentCategories = type === TransactionType.EXPENSE ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-800 mb-4 shrink-0">{initialData ? 'Sửa giao dịch' : 'Thêm giao dịch mới'}</h3>
                
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 px-1">
                    {/* Tab: Loại giao dịch */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setType(TransactionType.EXPENSE)} className={`flex-1 py-3 text-base font-bold rounded-lg transition-all ${type === TransactionType.EXPENSE ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}>Chi tiêu</button>
                        <button onClick={() => setType(TransactionType.INCOME)} className={`flex-1 py-3 text-base font-bold rounded-lg transition-all ${type === TransactionType.INCOME ? 'bg-white text-green-500 shadow-sm' : 'text-slate-400'}`}>Thu nhập</button>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Số tiền</label>
                        <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ","))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-bold focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0" autoFocus />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Mô tả</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Ví dụ: Ăn phở..." />
                    </div>
                    
                    {/* Nguồn tiền */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nguồn tiền</label>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${paymentMethod === 'CASH' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-400'}`}
                             >
                                 <span>💵</span> Tiền mặt
                             </button>
                             <button 
                                onClick={() => setPaymentMethod('TRANSFER')}
                                className={`flex-1 py-2 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${paymentMethod === 'TRANSFER' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-400'}`}
                             >
                                 <span>🏦</span> Ngân hàng
                             </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cho ai / Với ai</label>
                            <input type="text" value={person} onChange={e => setPerson(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Mẹ, Nam..." />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ở đâu</label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Shop, chợ..." />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Danh mục</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none appearance-none">
                                {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ngày</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6 shrink-0">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl transition-all active:scale-95 text-base">Hủy</button>
                    <button onClick={handleSubmit} className="flex-1 py-3 bg-brand-600 font-bold text-white rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all active:scale-95 text-base">Lưu</button>
                </div>
            </div>
        </div>
    );
};
