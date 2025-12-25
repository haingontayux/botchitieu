
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Transaction, TransactionType } from '../types';
import { parseTransactionFromMultimodal, generateBotResponse } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { TransactionModal } from '../components/TransactionModal';

interface BotChatProps {
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addTransactions: (t: Transaction | Transaction[]) => void;
  onEditTransaction: (t: Transaction) => void;
  transactions: Transaction[];
  pendingAudio?: { blob: Blob, mimeType: string } | null;
  clearPendingAudio?: () => void;
}

export const BotChat: React.FC<BotChatProps> = ({ 
    chatHistory, 
    setChatHistory, 
    addTransactions,
    onEditTransaction,
    transactions,
    pendingAudio,
    clearPendingAudio
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializingMic, setIsInitializingMic] = useState(false);
  
  // Edit Modal State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Xử lý âm thanh được gửi từ MobileNav (Global Mic)
  useEffect(() => {
    if (pendingAudio) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Url = reader.result as string;
            const base64Content = base64Url.split(',')[1];
            
            const userMsg: ChatMessage = {
                id: uuidv4(),
                role: 'user',
                content: "🎤 Tin nhắn thoại",
                timestamp: Date.now(),
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
                    description: tData.description || 'Ghi chép',
                    type: tData.type as TransactionType,
                    person: tData.person,
                    location: tData.location,
                    status: 'CONFIRMED',
                    paymentMethod: tData.paymentMethod || 'CASH' // Đã sửa: Gán paymentMethod từ AI
                };
                
                transactionsToAdd.push(newTransaction);
                
                newMessages.push({
                    id: uuidv4(),
                    role: 'bot',
                    content: generateBotResponse(tData),
                    timestamp: Date.now(),
                    relatedTransactionId: newTransaction.id // Link message to transaction
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
            content: "Tôi chưa nhận diện được khoản chi nào. Bạn hãy thử nói lại cụ thể hơn nhé.",
            timestamp: Date.now()
          };
          setChatHistory(prev => [...prev, botResponse]);
        }

      }
    } catch (error) {
       console.error("Chat process error:", error);
       setChatHistory(prev => [...prev, { id: uuidv4(), role: 'bot', content: "Có lỗi xảy ra khi kết nối với AI.", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendText = async () => {
    if (!inputValue.trim()) return;
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: inputValue.trim(), timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setInputValue('');
    await processInput(userMsg.content);
  };

  const startRecording = async () => {
    pressStartTimeRef.current = Date.now();
    isStopRequestedRef.current = false;
    setIsInitializingMic(true); 
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (isStopRequestedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          setIsInitializingMic(false);
          return;
      }
      const supportedType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      if (!supportedType) { 
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
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Url = reader.result as string;
                    setChatHistory(prev => [...prev, { id: uuidv4(), role: 'user', content: "🎤 Tin nhắn thoại", timestamp: Date.now(), audioBase64: base64Url }]);
                    await processInput(undefined, undefined, base64Url.split(',')[1], mimeTypeRef.current);
                };
                reader.readAsDataURL(blob);
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

  const handleMessageClick = (msg: ChatMessage) => {
      if (msg.role === 'bot' && msg.relatedTransactionId) {
          const tx = transactions.find(t => t.id === msg.relatedTransactionId);
          if (tx) {
              setEditingTransaction(tx);
              setIsModalOpen(true);
          }
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-3xl overflow-hidden shadow-sm border border-slate-100 relative">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 z-10 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">AI</div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">FinBot AI</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hỗ trợ ghi chép 24/7</p>
          </div>
        </div>
        <button onClick={() => setChatHistory([])} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500">Xóa chat</button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar relative">
        {chatHistory.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40 px-10">
              <div className="w-16 h-16 bg-white rounded-3xl border border-slate-200 flex items-center justify-center shadow-sm">
                 <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <p className="text-slate-600 text-xs font-bold leading-relaxed">
                  Nhắn: "Phở 50k", "Đi grab 30k"<br/>hoặc giữ Mic để nói nhanh.
              </p>
           </div>
        )}

        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div 
                onClick={() => handleMessageClick(msg)}
                className={`max-w-[85%] px-4 py-2.5 text-sm shadow-sm relative transition-transform active:scale-95
                    ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-slate-700 rounded-2xl rounded-tl-none border border-slate-100'}
                    ${msg.relatedTransactionId ? 'cursor-pointer hover:bg-slate-50 ring-2 ring-transparent hover:ring-indigo-100' : ''}
                `}
            >
              <div className="leading-relaxed" dangerouslySetInnerHTML={{__html: msg.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>')}}></div>
              {msg.audioBase64 && (
                <div className="mt-2 p-1 bg-white/10 rounded-lg">
                  <audio controls src={msg.audioBase64} className="h-8 w-full min-w-[180px]" />
                </div>
              )}
              <div className={`text-[8px] mt-1 text-right font-black uppercase opacity-60 ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center space-x-1">
               <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
               <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
        
        {(isRecording || isInitializingMic) && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fade-in select-none pointer-events-none">
             <div className="flex items-end justify-center space-x-1 h-12 mb-4">
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_1s_infinite] h-8"></div>
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_1.2s_infinite] h-12"></div>
                 <div className="w-2 bg-red-500 rounded-full animate-[bounce_0.8s_infinite] h-10"></div>
             </div>
             <p className="text-red-500 font-bold text-xs uppercase tracking-widest">{isInitializingMic ? 'Đang bật mic...' : 'Thả để gửi'}</p>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="bg-white p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center space-x-2 bg-slate-50 rounded-2xl p-1 border border-slate-200">
            <input
                ref={textInputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Nhập nội dung..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-3 text-sm h-10"
            />
            {inputValue.trim() ? (
                <button onClick={handleSendText} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-md transition-transform active:scale-90">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            ) : (
                <button
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={stopRecording}
                onTouchCancel={stopRecording}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isRecording || isInitializingMic ? 'bg-red-500 text-white scale-110' : 'bg-white text-slate-400 border border-slate-200'}`}
                style={{ touchAction: 'none' }}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
            )}
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingTransaction && (
          <TransactionModal 
              initialData={editingTransaction}
              onClose={() => setIsModalOpen(false)}
              onSave={(t) => {
                  onEditTransaction(t);
                  // Update chat message content if needed, but simple re-render of transactions handles logic
              }}
          />
      )}
    </div>
  );
};
