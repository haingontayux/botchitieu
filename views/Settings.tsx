import React, { useState } from 'react';
import { UserSettings } from '../types';
import { exportData, importData, syncFromCloud, syncToCloud, sendTelegramNotification, applyTheme } from '../services/storageService';

interface SettingsProps {
  settings: UserSettings;
  onSave: (s: UserSettings) => void;
  onDataUpdate: () => void;
}

const GAS_SCRIPT_CODE = `// CODE GOOGLE APPS SCRIPT
const WEB_APP_URL = ""; 
const TELEGRAM_BOT_TOKEN = ""; 

function doPost(e) { /* ... Logic cũ ... */ return ContentService.createTextOutput(JSON.stringify({status: "success"})); }
function doGet(e) { return ContentService.createTextOutput(JSON.stringify({status: "success", data: getSheetData()})); }
// (Bạn có thể sao chép full code từ các phiên bản trước hoặc link hướng dẫn)
`;

const THEMES = [
  { id: 'indigo', name: 'Xanh tím', bg: 'bg-indigo-600' },
  { id: 'emerald', name: 'Xanh lá', bg: 'bg-emerald-600' },
  { id: 'rose', name: 'Hồng', bg: 'bg-rose-600' },
  { id: 'amber', name: 'Cam', bg: 'bg-amber-600' },
  { id: 'blue', name: 'Xanh dương', bg: 'bg-blue-600' },
];

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onDataUpdate }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSave = () => {
    onSave(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleThemeChange = (color: string) => {
      // Update Local State for UI selection
      setLocalSettings({...localSettings, themeColor: color as any});
      // Instant Preview: Apply CSS vars immediately
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

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0 relative">
      
      {/* Theme Selection */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">Giao diện</h3>
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`flex flex-col items-center space-y-2 min-w-[60px] p-2 rounded-xl border-2 transition-all ${localSettings.themeColor === theme.id ? 'border-slate-800 bg-slate-50' : 'border-transparent'}`}
            >
              <div className={`w-8 h-8 rounded-full shadow-sm ${theme.bg}`}></div>
              <span className="text-[10px] font-bold text-slate-600">{theme.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Finance Settings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">Tài chính</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Số dư đầu kỳ</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={localSettings.initialBalance?.toLocaleString('vi-VN')}
              onChange={(e) => handleCurrencyInputChange('initialBalance', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Hạn mức/ngày</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={localSettings.dailyLimit?.toLocaleString('vi-VN')}
              onChange={(e) => handleCurrencyInputChange('dailyLimit', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 text-sm font-bold"
            />
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">AI & Cloud</h3>
        <div className="space-y-4">
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Gemini API Key</label>
            <div className="relative">
              <input 
                type={showApiKey ? "text" : "password"}
                value={localSettings.geminiApiKey || ''}
                onChange={(e) => setLocalSettings({...localSettings, geminiApiKey: e.target.value})}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 text-sm pr-10"
                placeholder="AIza..."
              />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-2.5 text-slate-400">
                 {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
           </div>
           
           <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Apps Script URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={localSettings.appScriptUrl || ''}
                onChange={(e) => setLocalSettings({...localSettings, appScriptUrl: e.target.value})}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 text-sm"
              />
              <button onClick={handleTestConnection} disabled={isTesting} className="px-3 bg-slate-100 rounded-lg text-xs font-bold">
                 {isTesting ? '...' : 'Check'}
              </button>
            </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
         <h3 className="text-base font-bold text-slate-800 mb-3">Backup Data</h3>
         <div className="flex gap-3">
             <button onClick={exportData} className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-100">Sao lưu</button>
             <label className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-100 text-center cursor-pointer">
                 Khôi phục
                 <input type="file" onChange={(e) => { if(e.target.files?.[0]) importData(e.target.files[0]).then(ok => ok && (alert("OK"), onDataUpdate())) }} className="hidden" accept=".json" />
             </label>
         </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 md:relative md:bg-transparent md:border-0 md:p-0 z-30">
        <button 
            onClick={handleSave}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${isSaved ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700'}`}
        >
            {isSaved ? 'Đã lưu!' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
};