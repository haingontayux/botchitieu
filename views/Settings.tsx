
import React, { useState, useEffect, useMemo } from 'react';
import { UserSettings, Transaction, TransactionType } from '../types';
import { exportData, importData, syncFromCloud, applyTheme, getStoredTransactions } from '../services/storageService';
import { formatCurrency } from '../services/geminiService';

interface SettingsProps {
  settings: UserSettings;
  onSave: (s: UserSettings) => void;
  onDataUpdate: () => void;
}

const THEMES = [
  { id: 'indigo', name: 'Xanh tím', bg: 'bg-indigo-600' },
  { id: 'emerald', name: 'Xanh lá', bg: 'bg-emerald-600' },
  { id: 'rose', name: 'Hồng', bg: 'bg-rose-600' },
  { id: 'amber', name: 'Cam', bg: 'bg-amber-600' },
  { id: 'blue', name: 'Xanh dương', bg: 'bg-blue-600' },
];

// MÃ APPS SCRIPT ĐÃ ĐƯỢC NÂNG CẤP ĐỂ CHỐNG TRÙNG LẶP
const APPS_SCRIPT_CODE = `
// --- COPY TOÀN BỘ CODE DƯỚI ĐÂY ---
const SHEET_NAME = 'Transactions';
const HEADERS = ['ID', 'Date', 'Amount', 'Type', 'Category', 'Description', 'Person', 'Location', 'Payment Method', 'Status', 'Last Updated'];

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);
    const transactions = rows.map(row => ({
      id: String(row[0]),
      date: formatDateISO(row[1]),
      amount: Number(row[2]),
      type: row[3],
      category: row[4],
      description: row[5],
      person: row[6] ? String(row[6]) : undefined,
      location: row[7] ? String(row[7]) : undefined,
      paymentMethod: row[8] ? String(row[8]) : 'CASH',
      status: row[9] || 'CONFIRMED'
    })).filter(t => t.id && t.id !== "");
    return createJSONOutput({ status: 'success', data: transactions });
  } catch (err) {
    return createJSONOutput({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = getOrCreateSheet();
    const content = JSON.parse(e.postData.contents);
    const action = content.action;
    const data = content.data;

    if (!data || !data.id) throw new Error("Missing data or ID");
    
    // Lấy toàn bộ ID để kiểm tra trùng
    const ids = sheet.getRange("A:A").getValues().flat();
    // Index thực tế trong mảng ids (chưa +1 cho row thực tế)
    const existingIndex = ids.indexOf(data.id); 

    // LOGIC CHỐNG TRÙNG LẶP (UPSERT)
    // Nếu action là ADD nhưng ID đã tồn tại -> Chuyển thành UPDATE
    if (action === 'ADD' && existingIndex !== -1) {
       updateRow(sheet, existingIndex + 1, data);
    } 
    else if (action === 'ADD') {
      sheet.appendRow([
        data.id, data.date, data.amount, data.type, data.category, data.description,
        data.person || '', data.location || '', data.paymentMethod || 'CASH', 
        data.status || 'CONFIRMED', new Date()
      ]);
    } 
    else if (action === 'UPDATE' && existingIndex !== -1) {
      updateRow(sheet, existingIndex + 1, data);
    } 
    else if (action === 'DELETE' && existingIndex !== -1) {
      sheet.deleteRow(existingIndex + 1);
    }

    return createJSONOutput({ status: 'success', action: action });
  } catch (err) {
    return createJSONOutput({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function updateRow(sheet, rowIndex, data) {
  const range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);
  range.setValues([[
    data.id, data.date, data.amount, data.type, data.category, data.description,
    data.person || '', data.location || '', data.paymentMethod || 'CASH', 
    data.status || 'CONFIRMED', new Date()
  ]]);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function formatDateISO(dateInput) {
  if (!dateInput) return "";
  if (dateInput instanceof Date) {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    return \`\${year}-\${month}-\${day}\`;
  }
  return String(dateInput);
}
`.trim();

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onDataUpdate }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  
  // Tính toán số dư hiện tại để hiển thị
  const [currentBalances, setCurrentBalances] = useState({ cash: 0, bank: 0 });

  useEffect(() => {
    setLocalSettings(settings);
    
    // Tính toán số dư
    const transactions = getStoredTransactions().filter(t => t.status !== 'PENDING');
    let cash = settings.initialBalance || 0;
    let bank = settings.initialBankBalance || 0;

    transactions.forEach(t => {
        const isCash = !t.paymentMethod || t.paymentMethod === 'CASH';
        const amount = t.amount;
        
        if (t.type === TransactionType.INCOME) {
            if (isCash) cash += amount; else bank += amount;
        } else {
            if (isCash) cash -= amount; else bank -= amount;
        }
    });
    setCurrentBalances({ cash, bank });

  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleThemeChange = (color: string) => {
      setLocalSettings({...localSettings, themeColor: color as any});
      applyTheme(color);
  };

  const handleCurrencyInputChange = (field: keyof UserSettings, value: string) => {
    const rawValue = value.replace(/\D/g, '');
    setLocalSettings({ ...localSettings, [field]: rawValue ? parseInt(rawValue, 10) : 0 });
  };

  const handleTestConnection = async () => {
      if (!localSettings.appScriptUrl) return alert("Vui lòng nhập URL.");
      setIsTesting(true);
      try {
          const res = await syncFromCloud(localSettings.appScriptUrl);
          alert(res ? `✅ Kết nối OK! (${res.length} giao dịch)` : "❌ Thất bại.");
      } catch(e) { alert("❌ Lỗi mạng."); }
      setIsTesting(false);
  };

  const copyScriptCode = () => {
      navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      alert("Đã copy code mới! Hãy dán đè vào Google Apps Script.");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header cho mobile dễ nhìn hơn */}
      <div className="flex items-center justify-between mb-2">
         <h2 className="text-2xl font-black text-slate-800">Cài đặt</h2>
         {isSaved && <span className="text-green-600 font-bold animate-fade-in">Đã lưu!</span>}
      </div>

      {/* Theme Selection */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider text-slate-400">Giao diện</h3>
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`flex flex-col items-center space-y-2 min-w-[60px] p-2 rounded-xl border-2 transition-all ${localSettings.themeColor === theme.id ? 'border-brand-600 bg-brand-50' : 'border-transparent'}`}
            >
              <div className={`w-8 h-8 rounded-full shadow-sm ${theme.bg}`}></div>
              <span className={`text-[10px] font-bold ${localSettings.themeColor === theme.id ? 'text-brand-700' : 'text-slate-500'}`}>{theme.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key - Quan trọng */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-brand-200 ring-4 ring-brand-50/50">
        <h3 className="text-sm font-bold text-brand-600 mb-3 uppercase tracking-wider">🤖 Kết nối AI (Bắt buộc)</h3>
        <div className="space-y-3">
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Google Gemini API Key</label>
            <div className="relative">
              <input 
                type={showApiKey ? "text" : "password"}
                value={localSettings.geminiApiKey || ''}
                onChange={(e) => setLocalSettings({...localSettings, geminiApiKey: e.target.value})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm font-mono pr-10"
                placeholder="Dán API Key vào đây..."
              />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-3 text-slate-400">
                 {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Lấy key miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-brand-600 underline font-bold">Google AI Studio</a>.
            </p>
           </div>
        </div>
      </div>

      {/* Finance Settings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Tài chính</h3>
        <div className="grid grid-cols-1 gap-4">
          
          {/* Cash Section */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
             <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-700 flex items-center gap-1">💵 Ví tiền mặt</span>
                <span className="font-bold text-brand-600">{formatCurrency(currentBalances.cash)}</span>
             </div>
             <label className="block text-[10px] font-bold text-slate-400 mb-1">Số dư đầu kỳ (Ví)</label>
             <input 
               type="text" 
               inputMode="numeric"
               value={localSettings.initialBalance?.toLocaleString('vi-VN')}
               onChange={(e) => handleCurrencyInputChange('initialBalance', e.target.value)}
               className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 text-sm font-bold"
             />
          </div>

          {/* Bank Section */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
             <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-700 flex items-center gap-1">🏦 Ngân hàng</span>
                <span className="font-bold text-indigo-600">{formatCurrency(currentBalances.bank)}</span>
             </div>
             <label className="block text-[10px] font-bold text-slate-400 mb-1">Số dư đầu kỳ (Ngân hàng)</label>
             <input 
               type="text" 
               inputMode="numeric"
               value={localSettings.initialBankBalance?.toLocaleString('vi-VN')}
               onChange={(e) => handleCurrencyInputChange('initialBankBalance', e.target.value)}
               className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 text-sm font-bold"
             />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Hạn mức chi tiêu / ngày</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={localSettings.dailyLimit?.toLocaleString('vi-VN')}
              onChange={(e) => handleCurrencyInputChange('dailyLimit', e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm font-bold"
            />
          </div>
        </div>
      </div>

      {/* Cloud Settings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Đồng bộ Cloud (Tùy chọn)</h3>
         <div className="space-y-3">
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Apps Script URL</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={localSettings.appScriptUrl || ''}
                    onChange={(e) => setLocalSettings({...localSettings, appScriptUrl: e.target.value})}
                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm"
                    placeholder="https://script.google.com/..."
                  />
                  <button onClick={handleTestConnection} disabled={isTesting} className="px-4 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                     Check
                  </button>
                </div>
                
                {/* Apps Script Code Button */}
                <button onClick={() => setShowScriptCode(!showScriptCode)} className="text-xs text-brand-600 font-bold underline mb-2">
                    {showScriptCode ? 'Ẩn mã nguồn' : 'Lấy mã Script mới (Fix lỗi trùng)'}
                </button>
                
                {showScriptCode && (
                    <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 relative">
                        <div className="absolute top-2 right-2">
                            <button onClick={copyScriptCode} className="bg-brand-600 text-white px-2 py-1 rounded text-[10px] font-bold">COPY</button>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap max-h-60">
                            {APPS_SCRIPT_CODE}
                        </pre>
                    </div>
                )}
             </div>
         </div>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
         <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Dữ liệu</h3>
         <div className="flex gap-3">
             <button onClick={exportData} className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-100 transition-colors">Sao lưu</button>
             <label className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-100 transition-colors text-center cursor-pointer">
                 Khôi phục
                 <input type="file" onChange={(e) => { if(e.target.files?.[0]) importData(e.target.files[0]).then(ok => ok && (alert("Đã khôi phục dữ liệu"), onDataUpdate())) }} className="hidden" accept=".json" />
             </label>
         </div>
      </div>

      {/* Save Button - Static Position */}
      <div className="pt-4 pb-8">
        <button 
            onClick={handleSave}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95 ${isSaved ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700'}`}
        >
            {isSaved ? '✅ Đã lưu thành công!' : 'Lưu tất cả cài đặt'}
        </button>
      </div>
    </div>
  );
};
