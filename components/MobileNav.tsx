import React, { useRef, useState, useEffect } from 'react';

interface MobileNavProps {
  currentTab: string;
  setCurrentTab: (tab: any) => void;
  onAudioCapture: (blob: Blob, mimeType: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, setCurrentTab, onAudioCapture }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Refs for recording logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const pressStartTimeRef = useRef<number>(0);
  const isStopRequestedRef = useRef<boolean>(false);

  // Cleanup on unmount
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

          // Race Condition Check: If user released before stream was ready
          if (isStopRequestedRef.current) {
              const duration = Date.now() - pressStartTimeRef.current;
              stream.getTracks().forEach(t => t.stop());
              setIsInitializing(false);
              
              if (duration < 300) {
                 setCurrentTab('chat'); // Treat as tap
              }
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

      // Tap Case (< 300ms)
      if (pressDuration < 300) {
          setIsRecording(false);
          setIsInitializing(false);
          stopStream();
          setCurrentTab('chat');
          return;
      }

      // Hold Case
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.onstop = () => {
              stopStream();
              const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
              if (blob.size > 0) {
                  onAudioCapture(blob, mimeTypeRef.current);
              }
              setIsRecording(false);
          };
          mediaRecorderRef.current.stop();
      } else {
          // Fallback
          setIsRecording(false);
          setIsInitializing(false);
          stopStream();
      }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { id: 'statistics', label: 'Thống kê', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    )},
    { id: 'chat', label: 'Bot', isBot: true, icon: (
      <svg className="w-8 h-8 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
    )},
    { id: 'history', label: 'Lịch sử', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )},
    { id: 'settings', label: 'Cài đặt', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    )},
  ];

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-end z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] select-none">
        {navItems.map((item) => {
          if (item.isBot) {
              return (
                <div key={item.id} className="relative -top-5">
                    <button
                        // Touch Events
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={stopRecording}
                        onTouchCancel={stopRecording}
                        // Mouse Events
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onMouseLeave={stopRecording}
                        onContextMenu={(e) => e.preventDefault()}
                        
                        className={`flex flex-col items-center justify-center rounded-full shadow-lg transform transition-all duration-200 
                            ${currentTab === 'chat' ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white'}
                            ${isRecording || isInitializing ? 'scale-125 ring-4 ring-red-200 bg-red-500' : ''}
                        `}
                        style={{ 
                            width: '56px', height: '56px',
                            touchAction: 'none', WebkitUserSelect: 'none'
                        }}
                    >
                        {item.icon}
                    </button>
                    <span className="text-[10px] font-medium text-gray-500 absolute -bottom-4 left-1/2 transform -translate-x-1/2">Bot</span>
                </div>
              );
          }
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center space-y-1 w-16 ${
                currentTab === item.id ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Global Recording Overlay */}
      {(isRecording || isInitializing) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-fade-in touch-none select-none pointer-events-none">
             <div className="bg-white p-6 rounded-3xl flex flex-col items-center shadow-2xl">
                 <div className="flex items-end justify-center space-x-1 h-16 mb-4">
                     <div className="w-2 bg-red-500 rounded-full animate-[bounce_1s_infinite] h-8"></div>
                     <div className="w-2 bg-red-500 rounded-full animate-[bounce_1.2s_infinite] h-12"></div>
                     <div className="w-2 bg-red-500 rounded-full animate-[bounce_0.8s_infinite] h-16"></div>
                     <div className="w-2 bg-red-500 rounded-full animate-[bounce_1.1s_infinite] h-10"></div>
                     <div className="w-2 bg-red-500 rounded-full animate-[bounce_0.9s_infinite] h-14"></div>
                 </div>
                 <h3 className="text-xl font-bold text-slate-800">Đang lắng nghe...</h3>
                 <p className="text-slate-500 text-sm mt-2">Thả tay để phân tích</p>
             </div>
        </div>
      )}
    </>
  );
};