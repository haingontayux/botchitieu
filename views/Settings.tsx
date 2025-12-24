import React, { useState } from 'react';
import { UserSettings } from '../types';
import { exportData, importData, syncFromCloud, syncToCloud, sendTelegramNotification } from '../services/storageService';

interface SettingsProps {
  settings: UserSettings;
  onSave: (s: UserSettings) => void;
  onDataUpdate: () => void;
}

// Fixed \\n for correct escaping in pre/code block
const GAS_SCRIPT_CODE = `// ============================================================
// HƯỚNG DẪN FIX LỖI (BẢN FINAL V2 - Hỗ trợ Person & Location):
// 1. Dán code này đè lên code cũ.
// 2. Nhấn "Deploy" -> "New deployment" -> "Deploy".
// 3. Copy URL Web App (đuôi /exec) dán vào dòng 2 dưới đây.
// 4. Chọn hàm 'setup' ở thanh công cụ và nhấn 'Run'.
// ============================================================

const WEB_APP_URL = ""; // <--- DÁN URL WEB APP CỦA BẠN VÀO GIỮA 2 DẤU NGOẶC KÉP
const TELEGRAM_BOT_TOKEN = ""; // <--- Dán Token Bot vào đây nếu chưa có

function doPost(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      const contents = JSON.parse(e.postData.contents);
      
      if (contents.action === 'NOTIFY') {
         sendTelegramMessage(contents.chatId, "🔔 " + contents.message);
      } else if (contents.action) {
         handleWebAppSync(contents);
      } else if (contents.message) {
         handleTelegramMessage(contents.message);
      }
    }
  } catch (err) {
    try {
       const c = JSON.parse(e.postData.contents);
       if(c.message) sendTelegramMessage(c.message.chat.id, "⚠️ Lỗi: " + err.toString());
    } catch(ex) {}
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success", 
    data: getSheetData()
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- LOGIC ---

function getSheetData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() <= 1) return []; // Chỉ có header hoặc trống
  
  const rows = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    if(rows[i][0]) {
      data.push({
        id: rows[i][0], 
        date: rows[i][1], 
        description: rows[i][2],
        amount: Number(rows[i][3]), 
        category: rows[i][4], 
        type: rows[i][5], 
        status: rows[i][6],
        person: rows[i][7] || "", // Col H
        location: rows[i][8] || "" // Col I
      });
    }
  }
  return data;
}

function handleWebAppSync(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const t = data.data;

  // Tạo header nếu chưa có (Thêm Person, Location)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Date", "Description", "Amount", "Category", "Type", "Status", "Person", "Location"]);
  }

  // Row Data array
  const rowData = [t.id, t.date, t.description, t.amount, t.category, t.type, t.status, t.person || "", t.location || ""];

  if (data.action === 'ADD') {
    sheet.appendRow(rowData);
  } else {
    // Tìm dòng để update/delete
    const ids = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues().flat();
    const rowIndex = ids.indexOf(t.id); // Trả về index tính từ 0 (tương ứng dòng 2 trong sheet)
    
    if (rowIndex !== -1) {
      if (data.action === 'UPDATE') {
         // Update 9 columns
         sheet.getRange(rowIndex + 2, 1, 1, 9).setValues([rowData]);
      } else if (data.action === 'DELETE') {
         sheet.deleteRow(rowIndex + 2);
      }
    }
  }
}

function handleTelegramMessage(msg) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const text = msg.text;
  const chatId = msg.chat.id;

  if (!text) return;

  if (text === '/id' || text === '/start') {
     sendTelegramMessage(chatId, "🆔 ID: <code>" + chatId + "</code>");
     return;
  }

  const date = new Date().toISOString();
  const id = 'TG_' + msg.message_id;

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Date", "Description", "Amount", "Category", "Type", "Status", "Person", "Location"]);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) { 
    const existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    if (existingIds.includes(id)) return; 
  }
  
  // Mặc định Person/Location trống khi nhận từ Telegram (sẽ được AI điền sau khi xử lý trên App)
  sheet.appendRow([id, date, text, 0, 'Khác', 'EXPENSE', 'PENDING', '', '']);
  sendTelegramMessage(chatId, "✅ Đã nhận: " + text);
}

function sendTelegramMessage(chatId, text) {
  try {
    if(!TELEGRAM_BOT_TOKEN) return;
    UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify({ "chat_id": chatId, "text": text, "parse_mode": "HTML" })
    });
  } catch(e) { Logger.log(e); }
}

function setup() {
  if (!WEB_APP_URL || WEB_APP_URL.indexOf("exec") === -1) {
    Logger.log("❌ LỖI: Chưa điền URL Web App (đuôi /exec) vào dòng 2.");
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
     Logger.log("⚠️ CẢNH BÁO: Chưa điền Token Bot Telegram. Bot sẽ không phản hồi.");
  }
  const url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/setWebhook?url=" + WEB_APP_URL;
  const response = UrlFetchApp.fetch(url);
  Logger.log("✅ KẾT QUẢ: " + response.getContentText());
}
`;

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onDataUpdate }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);

  const handleSave = () => {
    // Ensure 3 slots exist even if empty
    const times = localSettings.notificationTimes || [];
    onSave({...localSettings, notificationTimes: times});
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTimeChange = (index: number, value: string) => {
    const currentTimes = [...(localSettings.notificationTimes || [])];
    // Fill array if shorter with defaults
    while (currentTimes.length <= index) {
        currentTimes.push(index === 0 ? '09:00' : index === 1 ? '12:00' : '20:00');
    }
    currentTimes[index] = value;
    setLocalSettings({...localSettings, notificationTimes: currentTimes});
  };

  const handleTestConnection = async () => {
    if (!localSettings.appScriptUrl) {
        alert("Vui lòng nhập URL trước.");
        return;
    }
    setIsTesting(true);
    try {
        const result = await syncFromCloud(localSettings.appScriptUrl);
        if (result !== null) {
            alert(`✅ Kết nối thành công!\nTìm thấy ${result.length} giao dịch từ Sheet.`);
        } else {
            alert("❌ Kết nối thất bại.\nKiểm tra URL và quyền 'Anyone'.");
        }
    } catch (e) {
        alert("❌ Lỗi mạng hoặc URL không hợp lệ.");
    } finally {
        setIsTesting(false);
    }
  };

  const handleTestNotification = async () => {
    if (!localSettings.appScriptUrl || !localSettings.telegramChatId) {
      alert("Cần nhập Script URL và Chat ID trước.");
      return;
    }
    
    // Save temporarily to ensure latest data used
    onSave(localSettings);
    
    try {
      await sendTelegramNotification(localSettings.appScriptUrl, localSettings.telegramChatId, "Đây là tin nhắn test từ FinBot!");
      alert("Đã gửi lệnh! Hãy kiểm tra tin nhắn Telegram.");
    } catch (e) {
      alert("Không thể gửi tin nhắn.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = await importData(file);
      if (success) {
        alert("Nhập dữ liệu thành công!");
        onDataUpdate();
      } else {
        alert("File không hợp lệ.");
      }
    }
  };

  const handleNotificationToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    
    if (enabled) {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Lưu ý: Bạn đã chặn thông báo trình duyệt, nhưng thông báo qua Telegram vẫn sẽ hoạt động nếu đã cấu hình.");
        }
      }
      setLocalSettings({
          ...localSettings, 
          notificationEnabled: true,
          // Initialize defaults if empty
          notificationTimes: localSettings.notificationTimes?.length ? localSettings.notificationTimes : ['09:00', '12:00', '20:00']
      });
    } else {
      setLocalSettings({...localSettings, notificationEnabled: false});
    }
  };

  const copyScriptToClipboard = () => {
      navigator.clipboard.writeText(GAS_SCRIPT_CODE);
      alert("Đã sao chép mã! Hãy cập nhật lại Google Apps Script của bạn.");
  };

  // Logic handle number input with dots
  const handleCurrencyInputChange = (field: keyof UserSettings, value: string) => {
    // Remove non-digit characters to get raw number
    const rawValue = value.replace(/\D/g, '');
    const numberValue = rawValue ? parseInt(rawValue, 10) : 0;
    setLocalSettings({ ...localSettings, [field]: numberValue });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0 relative">
      
      {/* Finance Settings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">Cấu hình tài chính</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Số dư đầu kỳ</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={localSettings.initialBalance ? localSettings.initialBalance.toLocaleString('vi-VN') : ''}
              onChange={(e) => handleCurrencyInputChange('initialBalance', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Hạn mức/ngày</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={localSettings.dailyLimit ? localSettings.dailyLimit.toLocaleString('vi-VN') : ''} 
              onChange={(e) => handleCurrencyInputChange('dailyLimit', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">Thông báo & Nhắc nhở</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
             <label className="font-bold text-slate-700 text-sm">Nhắc ghi chi tiêu</label>
             <p className="text-xs text-slate-400">Gửi thông báo qua Web và Telegram</p>
          </div>
          <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
              <input 
                type="checkbox" 
                name="toggle" 
                id="toggle" 
                checked={localSettings.notificationEnabled || false}
                onChange={handleNotificationToggle}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 transform translate-x-0 checked:translate-x-full checked:border-indigo-600"
                style={{borderColor: localSettings.notificationEnabled ? '#4F46E5' : '#E2E8F0', right: localSettings.notificationEnabled ? '0' : 'auto', left: localSettings.notificationEnabled ? 'auto' : '0'}}
              />
              <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${localSettings.notificationEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}></label>
          </div>
        </div>
        
        {localSettings.notificationEnabled && (
           <div className="animate-fade-in-up space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-3">Chọn 3 khung giờ nhận thông báo:</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[0, 1, 2].map((idx) => (
                        <div key={idx} className="relative bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${idx === 0 ? 'bg-orange-100 text-orange-600' : idx === 1 ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {idx === 0 ? '🌅' : idx === 1 ? '☀️' : '🌙'}
                                </div>
                                <span className="text-xs font-bold text-slate-600 uppercase">
                                    {idx === 0 ? 'Sáng' : idx === 1 ? 'Trưa' : 'Tối'}
                                </span>
                            </div>
                            <input 
                                type="time" 
                                value={localSettings.notificationTimes?.[idx] || (idx === 0 ? '09:00' : idx === 1 ? '12:00' : '20:00')}
                                onChange={(e) => handleTimeChange(idx, e.target.value)}
                                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <label className="block text-xs font-bold text-slate-500 mb-2">Telegram Chat ID (Để Bot nhắn riêng cho bạn)</label>
                <div className="flex space-x-2">
                   <div className="relative flex-1">
                     <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                     </span>
                     <input 
                      type="text" 
                      placeholder="VD: 123456789"
                      value={localSettings.telegramChatId || ''}
                      onChange={(e) => setLocalSettings({...localSettings, telegramChatId: e.target.value})}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                     />
                   </div>
                   <button 
                     onClick={handleTestNotification}
                     className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center"
                   >
                     Test Bot
                   </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Chat với Bot cú pháp <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">/id</span> để lấy mã số này.
                </p>
              </div>
           </div>
        )}
      </div>

      {/* Cloud Sync Settings */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 shadow-lg text-white">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
            <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <h3 className="text-base font-bold">Kết nối Cloud & Bot</h3>
            </div>
            <button 
                onClick={() => setShowScriptModal(true)}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors text-blue-200 font-medium"
            >
                {'<>'} Lấy mã Script Mới
            </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Web App URL (Google Apps Script)</label>
            <div className="flex space-x-2">
                <input 
                type="text" 
                placeholder="https://script.google.com/macros/s/..."
                value={localSettings.appScriptUrl || ''} 
                onChange={(e) => setLocalSettings({...localSettings, appScriptUrl: e.target.value})}
                className="flex-1 p-2.5 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-white placeholder-slate-600 text-xs font-mono"
                />
                <button 
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white transition-all whitespace-nowrap"
                >
                    {isTesting ? '...' : 'Kiểm tra'}
                </button>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-lg ${isSaved ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'}`}
      >
        {isSaved ? 'Đã lưu thành công!' : 'Lưu cài đặt'}
      </button>

      {/* Backup/Restore */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">Dữ liệu</h3>
        <div className="flex space-x-3">
          <button 
            onClick={exportData}
            className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 text-sm font-bold transition-colors"
          >
             Sao lưu (Tải về)
          </button>
          <label className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 text-sm font-bold transition-colors cursor-pointer text-center block">
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            Khôi phục (Upload)
          </label>
        </div>
      </div>

      {/* Script Modal */}
      {showScriptModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl animate-fade-in-up">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                      <h3 className="font-bold text-slate-800">Mã Google Apps Script (Mới)</h3>
                      <button onClick={() => setShowScriptModal(false)} className="text-slate-400 hover:text-slate-600">Đóng</button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-slate-900">
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all select-all">
                          {GAS_SCRIPT_CODE}
                      </pre>
                  </div>
                  <div className="p-4 border-t border-slate-100 flex justify-end bg-white rounded-b-2xl">
                      <button 
                        onClick={copyScriptToClipboard}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/30 transition-all"
                      >
                          Sao chép toàn bộ
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};