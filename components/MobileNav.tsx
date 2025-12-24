
import React, { useRef, useState, useEffect } from 'react';

interface MobileNavProps {
  currentTab: string;
  setCurrentTab: (tab: any) => void;
  onAudioCapture: (blob: Blob, mimeType: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, setCurrentTab, onAudioCapture }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const pressStartTimeRef = useRef<number>(0);
  const isStopRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => stopStream();
  }, []);

  const stopStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    mediaRecorderRef.current = null;
  };

  const startRecording = async () => {
      pressStartTimeRef.current = Date.now();
      isStopRequestedRef.current = false;
      setIsInitializing(true);

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isStopRequestedRef.current) {
              stream.getTracks().forEach(t => t.stop());
              setIsInitializing(false);
              return;
          }

          const supportedType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
          if (!supportedType) {
              alert("Thiết bị không hỗ trợ ghi âm.");
              setIsInitializing(false);
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
          setIsInitializing(false);
      } catch (err) {
          console.error("Mic error", err);
          setIsInitializing(false);
      }
  };

  const stopRecording = (e?: React.SyntheticEvent) => {
      if (e) e.preventDefault();
      isStopRequestedRef.current = true;
      const pressDuration = Date.now() - pressStartTimeRef.current;

      // Nếu nhấn nhanh (dưới 300ms) thì chỉ chuyển tab
      if (pressDuration < 300) {
          setIsRecording(false);
          setIsInitializing(false);
          stopStream();
          setCurrentTab('chat');
          return;
      }

      // Nếu nhấn giữ thì kết thúc ghi âm và gửi
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.onstop = () => {
              stopStream();
              const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
              if (blob.size > 0) onAudioCapture(blob, mimeTypeRef.current);
              setIsRecording(false);
          };
          mediaRecorderRef.current.stop();
      } else {
          setIsRecording(false);
          setIsInitializing(false);
          stopStream();
      }
  };

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { id: 'statistics', label: 'Báo cáo', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    )},
    { id: 'chat', label: 'Bot AI', isBot: true, icon: (
      <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    )},
    { id: 'history', label: 'Lịch sử', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )},
    { id: 'settings', label: 'Thêm', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
    )},
  ];

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-between items-center z-40 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.08)] select-none h-16 px-4"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map((item) => {
          if (item.isBot) {
              return (
                <div key={item.id} className="flex flex-col items-center justify-center w-14 h-full">
                    <button
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={stopRecording}
                        onTouchCancel={stopRecording}
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onMouseLeave={stopRecording}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`flex items-center justify-center rounded-full transition-all duration-200 
                            ${isRecording || isInitializing ? 'bg-red-500 scale-110 ring-4 ring-red-100' : (currentTab === 'chat' ? 'bg-brand-600' : 'bg-slate-100')}
                            ${(currentTab === 'chat' || isRecording || isInitializing) ? 'text-white' : 'text-slate-400'}
                        `}
                        style={{ width: '44px', height: '44px', touchAction: 'none' }}
                    >
                        {item.icon}
                    </button>
                    {/* Không có nhãn Bot AI ở đây theo yêu cầu */}
                </div>
              );
          }
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center w-14 h-full transition-all active:scale-90 ${
                currentTab === item.id ? 'text-brand-600' : 'text-slate-400'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${currentTab === item.id ? 'bg-brand-50' : 'bg-transparent'}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-bold tracking-tight mt-0.5 ${currentTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {(isRecording || isInitializing) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-fade-in touch-none select-none pointer-events-none">
             <div className="bg-white p-8 rounded-[40px] flex flex-col items-center shadow-2xl scale-110">
                 <div className="flex items-end justify-center space-x-1.5 h-16 mb-6">
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_1s_infinite] h-8"></div>
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_1.2s_infinite] h-12"></div>
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_0.8s_infinite] h-16"></div>
                 </div>
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">Đang ghi âm...</h3>
                 <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">Thả tay để hoàn tất</p>
             </div>
        </div>
      )}
    </>
  );
};
