
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
              const duration = Date.now() - pressStartTimeRef.current;
              stream.getTracks().forEach(t => t.stop());
              setIsInitializing(false);
              if (duration < 300) setCurrentTab('chat');
              return;
          }

          const supportedType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
          if (!supportedType) {
              alert("Lỗi Mic.");
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

      if (pressDuration < 300) {
          setIsRecording(false);
          setIsInitializing(false);
          stopStream();
          setCurrentTab('chat');
          return;
      }

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
    { id: 'chat', label: 'Bot', isBot: true, icon: (
      <svg className="w-8 h-8 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    )},
    { id: 'history', label: 'Sổ thu chi', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )},
    { id: 'settings', label: 'Thêm', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
    )},
  ];

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-between items-end z-40 shadow-2xl select-none"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)', paddingTop: '8px', paddingLeft: '16px', paddingRight: '16px' }}>
        {navItems.map((item) => {
          if (item.isBot) {
              return (
                <div key={item.id} className="relative -top-6">
                    <button
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={stopRecording}
                        onTouchCancel={stopRecording}
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onMouseLeave={stopRecording}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`flex flex-col items-center justify-center rounded-full shadow-xl transform transition-all duration-200 
                            bg-indigo-600 text-white
                            ${isRecording || isInitializing ? 'scale-125 ring-8 ring-indigo-100 bg-red-500' : 'hover:scale-105'}
                        `}
                        style={{ width: '60px', height: '60px', touchAction: 'none' }}
                    >
                        {item.icon}
                    </button>
                </div>
              );
          }
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center space-y-1 w-14 transition-colors ${
                currentTab === item.id ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <div className={`p-1 rounded-lg ${currentTab === item.id ? 'bg-indigo-50' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Recording Overlay */}
      {(isRecording || isInitializing) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-fade-in touch-none select-none pointer-events-none">
             <div className="bg-white p-8 rounded-[40px] flex flex-col items-center shadow-2xl scale-110">
                 <div className="flex items-end justify-center space-x-1.5 h-16 mb-6">
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_1s_infinite] h-8"></div>
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_1.2s_infinite] h-12"></div>
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_0.8s_infinite] h-16"></div>
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_1.1s_infinite] h-10"></div>
                     <div className="w-2.5 bg-red-500 rounded-full animate-[bounce_0.9s_infinite] h-14"></div>
                 </div>
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">Đang lắng nghe...</h3>
                 <p className="text-slate-500 text-sm mt-2 font-medium">Thả tay để lưu chi tiêu</p>
             </div>
        </div>
      )}
    </>
  );
};
