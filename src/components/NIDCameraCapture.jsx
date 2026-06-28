import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

const NIDCameraCapture = ({ onCapture, isBn, labelBn, labelEn, value }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const isCaptured = !!value;

  const startCamera = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      setError(isBn ? 'ক্যামেরা চালু করা যাচ্ছে না।' : 'Unable to access camera.');
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (!isCaptured) {
      startCamera();
    }
    return () => stopCamera();
  }, [isCaptured]);

  const handleVideoPlay = () => {
    setIsLoading(false);
  };

  const handleCapture = useCallback(() => {
    setIsCapturing(true);
    const video = videoRef.current;
    
    if (video && video.readyState >= 2) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'nid-capture.jpg', { type: 'image/jpeg' });
          onCapture({ dataUrl, file, name: file.name, size: file.size, type: file.type });
          setIsCapturing(false);
          stopCamera();
        })
        .catch(() => setIsCapturing(false));
    } else {
      setIsCapturing(false);
    }
  }, [onCapture, stopCamera]);

  const handleRetake = () => {
    onCapture(null);
  };

  if (error) {
    return (
      <div className="aspect-[1.58] w-full rounded-2xl border-2 border-dashed border-red-500/40 bg-red-500/[0.04] flex flex-col items-center justify-center gap-2">
        <AlertCircle size={20} className="text-red-400" />
        <p className="text-[11px] font-bold text-red-400/80">{error}</p>
        <button type="button" onClick={startCamera} className="text-[10px] text-white underline mt-2">
          {isBn ? 'আবার চেষ্টা করুন' : 'Try Again'}
        </button>
      </div>
    );
  }

  if (isCaptured) {
    return (
      <div className="relative aspect-[1.58] w-full rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] group">
        <img src={value.dataUrl} alt="Captured NID" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          <div className="px-2 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle2 size={10} className="text-emerald-400" />
            <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">
              {isBn ? 'সম্পন্ন' : 'Done'}
            </span>
          </div>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex justify-center">
          <button
            type="button"
            onClick={handleRetake}
            className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-black text-white hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={12} /> {isBn ? 'আবার তুলুন' : 'Retake'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[1.58] bg-slate-900 rounded-2xl overflow-hidden group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onPlaying={handleVideoPlay}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900">
          <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
          <p className="text-white text-xs">{isBn ? 'ক্যামেরা চালু হচ্ছে...' : 'Starting camera...'}</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Box Shadow Trick for cut-out overlay */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none overflow-hidden">
             {/* The cut-out frame */}
             <div 
               className="w-[85%] aspect-[1.58] rounded-xl relative" 
               style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }}
             >
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
             </div>
          </div>

          <div className="absolute top-4 left-0 w-full text-center z-20 pointer-events-none">
             <p className="inline-block bg-black/60 px-3 py-1 rounded-full text-[11px] text-white font-bold backdrop-blur-sm">
               {isBn ? labelBn : labelEn}
             </p>
          </div>

          {/* Capture Button */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <button
              type="button"
              onClick={handleCapture}
              disabled={isCapturing}
              className="w-14 h-14 rounded-full bg-white/20 border-[3px] border-white backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors active:scale-95"
            >
              {isCapturing ? <RefreshCw className="animate-spin text-white" size={20} /> : <div className="w-10 h-10 rounded-full bg-white" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default NIDCameraCapture;
