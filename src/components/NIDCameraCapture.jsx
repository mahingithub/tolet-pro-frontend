import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const NIDCameraCapture = ({ onCapture, isBn, labelBn, labelEn, value }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isBlue, setIsBlue] = useState(false);
  
  // Track captured state via props (if already captured)
  const isCaptured = !!value;

  const [isCapturing, setIsCapturing] = useState(false);
  const blueTimeRef = useRef(0);
  const rafRef = useRef(null);

  const startCamera = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [stream]);

  useEffect(() => {
    if (!isCaptured) {
      startCamera();
    }
    return () => stopCamera();
  }, [isCaptured, stopCamera]);

  // Frame processing loop
  useEffect(() => {
    if (!stream || isCaptured) return;
    
    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video && canvas && video.videoWidth && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Target Aspect Ratio for NID
        const targetAspectRatio = 1.58;
        
        // Calculate crop area based on a 80% coverage in the center
        const rw = canvas.width * 0.8; 
        const rh = rw / targetAspectRatio;
        const rx = (canvas.width - rw) / 2;
        const ry = (canvas.height - rh) / 2;
        
        const frameData = ctx.getImageData(rx, ry, rw, rh);
        const data = frameData.data;
        
        // Simple variance heuristic (std deviation of brightness)
        let sum = 0;
        let sumSq = 0;
        const step = 4 * 10; // Check every 10th pixel for performance
        let checkedPixels = 0;
        
        for (let i = 0; i < data.length; i += step) {
          const brightness = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
          sum += brightness;
          sumSq += brightness * brightness;
          checkedPixels++;
        }
        
        const mean = sum / checkedPixels;
        const variance = (sumSq / checkedPixels) - (mean * mean);
        
        // Variance threshold (heuristic) - higher means more contrast/edges in the box
        const isGood = variance > 800; // Adjusted for better stability
        setIsBlue(isGood);
        
        if (isGood) {
          if (!blueTimeRef.current) {
            blueTimeRef.current = Date.now();
          } else if (Date.now() - blueTimeRef.current > 1500 && !isCapturing) {
            // Auto capture after 1.5s of stability
            setIsCapturing(true); // set flag eagerly to prevent double calls
            setTimeout(handleCapture, 0); 
          }
        } else {
          blueTimeRef.current = 0;
        }
      }
      
      if (!isCaptured && !isCapturing) {
        rafRef.current = requestAnimationFrame(processFrame);
      }
    };
    
    rafRef.current = requestAnimationFrame(processFrame);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [stream, isCaptured, isCapturing]);

  const handleCapture = useCallback(() => {
    setIsCapturing(true);
    const video = videoRef.current;
    
    if (video) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const vRatio = video.videoWidth / video.videoHeight;
      const targetAspectRatio = 1.58;
      
      let cropW, cropH;
      
      if (vRatio > targetAspectRatio) {
        // Video is wider than target
        cropH = video.videoHeight * 0.8;
        cropW = cropH * targetAspectRatio;
      } else {
        // Video is taller than target
        cropW = video.videoWidth * 0.8;
        cropH = cropW / targetAspectRatio;
      }
      
      const startX = (video.videoWidth - cropW) / 2;
      const startY = (video.videoHeight - cropH) / 2;
      
      canvas.width = cropW;
      canvas.height = cropH;
      
      ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
      
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
        
        {/* Label */}
        <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white/80 font-bold backdrop-blur-sm">
          {isBn ? labelBn : labelEn}
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
    <div className="relative w-full aspect-[1.58] bg-[#0a0a14] rounded-2xl overflow-hidden group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Dark overlay to focus on the frame region */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{
        boxShadow: 'inset 0 0 0 1000px rgba(0,0,0,0.5)',
        clipPath: 'polygon(0% 0%, 0% 100%, 10% 100%, 10% 10%, 90% 10%, 90% 90%, 10% 90%, 10% 100%, 100% 100%, 100% 0%)'
      }} />
      
      {/* The scanning frame */}
      <div 
        className={`absolute inset-[10%] z-20 border-2 rounded-xl transition-colors duration-300 pointer-events-none ${
          isBlue ? 'border-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.5)]'
        }`}
      >
        {/* Corner markers */}
        <div className={`absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg transition-colors ${isBlue ? 'border-[#3b82f6]' : 'border-[#ef4444]'}`} />
        <div className={`absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg transition-colors ${isBlue ? 'border-[#3b82f6]' : 'border-[#ef4444]'}`} />
        <div className={`absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg transition-colors ${isBlue ? 'border-[#3b82f6]' : 'border-[#ef4444]'}`} />
        <div className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 rounded-br-lg transition-colors ${isBlue ? 'border-[#3b82f6]' : 'border-[#ef4444]'}`} />
        
        {/* Label */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded text-[10px] text-white/80 font-bold backdrop-blur-sm">
          {isBn ? labelBn : labelEn}
        </div>
      </div>
      
      {/* Capture Button */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
        <button
          type="button"
          onClick={handleCapture}
          className={`w-12 h-12 rounded-full border-[3px] flex items-center justify-center transition-all ${
            isBlue 
              ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/40' 
              : 'bg-white/10 border-white text-white hover:bg-white/20'
          }`}
        >
          {isCapturing ? <RefreshCw className="animate-spin" size={20} /> : <Camera size={20} />}
        </button>
      </div>
      
      {/* Auto-capture indicator */}
      {isBlue && !isCapturing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6]/40 backdrop-blur-md animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
          <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-wider">
            {isBn ? 'স্থির রাখুন...' : 'Hold still...'}
          </span>
        </div>
      )}
    </div>
  );
};

export default NIDCameraCapture;
