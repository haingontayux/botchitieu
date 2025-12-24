import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Transaction, TransactionType } from '../types';
import { parseTransactionFromMultimodal, generateBotResponse } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface BotChatProps {
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addTransactions: (t: Transaction | Transaction[]) => void;
  transactions: Transaction[];
  pendingAudio?: { blob: Blob, mimeType: string } | null;
  clearPendingAudio?: () => void;
}

export const BotChat: React.FC<BotChatProps> = ({ 
    chatHistory, 
    setChatHistory, 
    addTransactions, 
    transactions,
    pendingAudio,
    clearPendingAudio
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializingMic, setIsInitializingMic] = useState(false); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm'); 
  const pressStartTimeRef = useRef<number>(0);
  const isStopRequestedRef = useRef<boolean>(false);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isTyping]);

  useEffect(() => {
      return () => stopStream();
  }, []);

  // --- Handle Pending Audio from Global Nav ---
  useEffect(() => {
    if (pendingAudio) {
        // Convert blob to base64 and process
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Url = reader.result as string;
            const base64Content = base64Url.split(',')[1];
            
            const userMsg: ChatMessage = {
                id: uuidv4(),
                role: 'user',
                content: "🎤 Đã gửi ghi âm (Từ Menu)",
                timestamp: Date.now(),
                isProcessing: true,
                audioBase64: base64Url 
            };
            setChatHistory(prev => [...prev, userMsg]);
            
            if (clearPendingAudio) clearPendingAudio();
            
            await processInput(undefined, undefined, base64Content, pendingAudio.mimeType);
        };
        reader.readAsDataURL(pendingAudio.blob);
    }
  }, [pendingAudio]);

  const stopStream = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      mediaRecorderRef.current = null;
  };

  const processInput = async (text?: string, imageBase64?: string, audioBase64?: string, mimeType?: string) => {
    setIsTyping(true);
    try {
      const result = await parseTransactionFromMultimodal({ text, imageBase64, audioBase64, mimeType }, transactions);

      if (result) {
        if (result.analysisAnswer) {
           const botMsg: ChatMessage = {
             id: uuidv4(),
             role: 'bot',
             content: result.analysisAnswer,
             timestamp: Date.now()
           };
           setChatHistory(prev => [...prev, botMsg]);
        }
        
        if (result.transactions && result.transactions.length > 0) {
          const newMessages: ChatMessage[] = [];
          const transactionsToAdd: Transaction[] = [];
          
          result.transactions.forEach(tData => {
             if (tData.amount > 0) {
                const newTransaction: Transaction = {
                    id: uuidv4(),
                    amount: tData.amount,
                    category: tData.category,
                    date: tData.date || new Date().toISOString().split('T')[0],
                    description: tData.description || 'Chi tiêu',
                    type: tData.type as TransactionType,
                    person: tData.person, // New
                    location: tData.location // New
                };
                
                transactionsToAdd.push(newTransaction);
                
                newMessages.push({
                    id: uuidv4(),
                    role: 'bot',
                    content: generateBotResponse(tData),
                    timestamp: Date.now(),
                    relatedTransactionId: newTransaction.id
                });
             }
          });

          if (transactionsToAdd.length > 0) {
            addTransactions(transactionsToAdd);
          }

          if (newMessages.length > 0) {
             setChatHistory(prev => [...prev, ...newMessages]);
          }
        } 
        
        if (!result.analysisAnswer && (!result.transactions || result.transactions.length === 0)) {
           const botResponse: ChatMessage = {
            id: uuidv4(),
            role: 'bot',
            content: "Xin lỗi, tôi chưa hiểu rõ. Bạn muốn ghi chi tiêu hay hỏi về lịch sử?",
            timestamp: Date.now()
          };
          setChatHistory(prev => [...prev, botResponse]);
        }

      } else {
        setChatHistory(prev => [...prev, { id: uuidv4(), role: 'bot', content: "Lỗi xử lý, vui lòng thử lại.", timestamp: Date.now() }]);
      }
    } catch (error) {
       console.error(error);
       setChatHistory(prev => [...prev, { id: uuidv4(), role: 'bot', content: "Lỗi kết nối AI.", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendText = async () => {
    if (!inputValue.trim()) return;
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: inputValue, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setInputValue('');
    await processInput(userMsg.content);
  };

  const sendAudioData = (blob: Blob, mimeType: string) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64Url = reader.result as string;
          const base64Content = base64Url.split(',')[1];
          
          const userMsg: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: "🎤 Đã gửi ghi âm",
            timestamp: Date.now(),
            isProcessing: true,
            audioBase64: base64Url 
          };
          setChatHistory(prev => [...prev, userMsg]);
          await processInput(undefined, undefined, base64Content, mimeType);
      };
      reader.readAsDataURL(blob);
  };

  const startRecording = async () => {
    pressStartTimeRef.current = Date.now();
    isStopRequestedRef.current = false;
    setIsInitializingMic(true); 
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (isStopRequestedRef.current) {
          const duration = Date.now() - pressStartTimeRef.current;
          stream.getTracks().forEach(t => t.stop());
          setIsInitializingMic(false);
          if (duration < 300) textInputRef.current?.focus(); 
          return;
      }

      const supportedType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      if (!supportedType) { 
          alert("Trình duyệt không hỗ trợ ghi âm."); 
          setIsInitializingMic(false);
          return; 
      }
      
      mimeTypeRef.current = supportedType;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsInitializingMic(false);

    } catch (err) {
      console.error("Mic error:", err);
      setIsInitializingMic(false);
    }
  };

  const stopRecording = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    isStopRequestedRef.current = true;
    const pressDuration = Date.now() - pressStartTimeRef.current;

    if (pressDuration < 300) {
        setIsRecording(false);
        setIsInitializingMic(false);
        stopStream();
        textInputRef.current?.focus();
        return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.onstop = () => {
            stopStream();
            const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
            if (blob.size > 0) {
                sendAudioData(blob, mimeTypeRef.current);
            }
            setIsRecording(false);
        };
        mediaRecorderRef.current.stop();
    } else {
        setIsRecording(false);
        setIsInitializingMic(false);
        stopStream();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setChatHistory(prev => [...prev, { id: uuidv4(), role: 'user', content: "📎 Đã gửi ảnh...", timestamp: Date.now() }]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await processInput(undefined, base64String.split(',')[1], undefined, file.type);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl overflow-hidden shadow-xl border border-white/50 relative">
      <div className="bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">AI</div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Trợ lý ảo</h3>
            <p className="text-[10px] text-slate-500 font-medium leading-none">Hỏi đáp & Ghi chép</p>
          </div>
        </div>
        <button onClick={() => setChatHistory([])} className="text-xs text-slate-400 hover:text-red-500">Xóa chat</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50 relative">
        {chatHistory.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50 mt-10">
              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm">
                 <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <p className="text-slate-500 text-xs font-medium">Nhấn giữ Mic để nói.<br/>Chạm nhẹ để gõ phím.</p>
           </div>
        )}

        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            <div className={`max-w-[85%] md:max-w-[75%] px-3 py-2 text-sm shadow-sm relative ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-slate-700 rounded-2xl rounded-tl-sm border border-slate-100'}`}>
              <div className="markdown-body leading-relaxed text-sm" dangerouslySetInnerHTML={{__html: msg.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/_(.*?)_/g, '<i>$1</i>')}}></div>
              {msg.audioBase64 && (
                <div className="mt-2 p-1 bg-white/10 rounded-lg">
                  <audio controls src={msg.audioBase64} className="h-8 w-full min-w-[200px]" />
                </div>
              )}
              <div className={`text-[9px] mt-1 text-right font-medium opacity-70 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center space-x-1">
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
        
        {/* Local Recording Visualizer Overlay (Only if triggered from inside this component) */}
        {(isRecording || isInitializingMic) && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fade-in select-none pointer-events-none">
             <div className="flex items-end justify-center space-x-1 h-16 mb-4">
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_1s_infinite] h-8"></div>
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_1.2s_infinite] h-12"></div>
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_0.8s_infinite] h-16"></div>
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_1.1s_infinite] h-10"></div>
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_0.9s_infinite] h-14"></div>
             </div>
             <p className="text-red-500 font-bold animate-pulse">{isInitializingMic ? 'Đang khởi động Mic...' : 'Đang nghe...'}</p>
             <p className="text-slate-400 text-xs mt-2">Thả tay để gửi</p>
          </div>
        )}
      </div>

      <div className="bg-white p-3 border-t border-slate-100 relative">
        <div className={`flex items-center space-x-2 bg-slate-50 rounded-xl p-1 border transition-all ${isRecording || isInitializingMic ? 'border-red-400 ring-2 ring-red-50 bg-red-50' : 'border-slate-200'}`}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg" disabled={isRecording || isInitializingMic}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <input
                ref={textInputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder={isRecording || isInitializingMic ? "" : "Nhập hoặc giữ Mic để nói..."}
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-2 text-sm"
                disabled={isRecording || isInitializingMic}
            />
            {inputValue.trim() ? (
                <button onClick={handleSendText} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
            ) : (
                <button
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={stopRecording}
                onTouchCancel={stopRecording}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onContextMenu={(e) => e.preventDefault()}
                
                className={`p-2 rounded-lg transition-all shadow-sm flex items-center justify-center select-none ${isRecording || isInitializingMic ? 'bg-red-500 text-white scale-110' : 'bg-white text-slate-400 hover:text-indigo-600 border border-slate-200'}`}
                style={{ 
                    width: '40px', 
                    height: '40px', 
                    WebkitUserSelect: 'none', 
                    userSelect: 'none', 
                    WebkitTouchCallout: 'none',
                    touchAction: 'none'
                }}
                >
                    <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};