
import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { exportData, importData, syncFromCloud, applyTheme } from '../services/storageService';

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

const APPS_SCRIPT_CODE = `
// 1. Vào Google Sheet -> Extensions -> Apps Script
// 2. Paste code này vào file Code.gs
// 3. Nhấn Deploy -> New Deployment -> Chọn Web App
// 4. Execute as: Me
// 5. Who has access: Anyone (quan trọng)
// 6. Copy URL dán vào app

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = doc.getSheetByName('Transactions');
    if (!sheet) {
      sheet = doc.insertSheet('Transactions');
      sheet.appendRow(['ID', 'Date', 'Amount', 'Category', 'Description', 'Type', 'Person', 'Location', 'PaymentMethod', 'Status']);
    }

    // Handle GET (Sync Down)
    if (!e.postData) {
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const transactions = data.map(row => ({
        id: row[0], date: row[1], amount: row[2], category: row[3],
        description: row[4], type: row[5], person: row[6],
        location: row[7], paymentMethod: row[8], status: row[9]
      })).filter(t => t.id);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: transactions }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle POST (Sync Up)
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const item = body.data;

    if (action === 'ADD') {
      sheet.appendRow([item.id, item.date, item.amount, item.category, item.description, item.type, item.person, item.location, item.paymentMethod, item.status]);
    } 
    else if (action === 'UPDATE') {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == item.id) {
          sheet.getRange(i + 1, 1, 1, 10).setValues([[item.id, item.date, item.amount, item.category, item.description, item.type, item.person, item.location, item.paymentMethod, item.status]]);
          break;
        }
      }
    } 
    else if (action === 'DELETE') {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == item.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`.trim();

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onDataUpdate }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);

  // Đồng bộ props vào state khi props thay đổi (fix lỗi không hiện dữ liệu mới)
  useEffect(() => {
    setLocalSettings(settings);
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
      alert("Đã copy code vào bộ nhớ đệm!");
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
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Số dư đầu kỳ</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={localSettings.initialBalance?.toLocaleString('vi-VN')}
              onChange={(e) => handleCurrencyInputChange('initialBalance', e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 text-sm font-bold"
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
                <div className="flex gap-2">
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
             </div>

             {/* Script Code Toggle */}
             <div>
                 <button 
                    onClick={() => setShowScriptCode(!showScriptCode)}
                    className="text-xs font-bold text-brand-600 underline"
                 >
                    {showScriptCode ? 'Ẩn mã Apps Script' : 'Hiện mã Apps Script để tạo Server'}
                 </button>
                 
                 {showScriptCode && (
                     <div className="mt-2 relative">
                         <div className="absolute top-2 right-2">
                             <button onClick={copyScriptCode} className="bg-brand-600 text-white text-[10px] px-2 py-1 rounded font-bold shadow-sm hover:bg-brand-700">Copy Code</button>
                         </div>
                         <textarea 
                            readOnly 
                            value={APPS_SCRIPT_CODE} 
                            className="w-full h-64 p-3 bg-slate-800 text-green-400 font-mono text-xs rounded-xl"
                         />
                         <p className="text-[10px] text-slate-500 mt-1 italic">
                            * Làm theo hướng dẫn ở 6 dòng đầu của đoạn code trên để cài đặt server.
                         </p>
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
