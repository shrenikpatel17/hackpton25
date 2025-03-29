'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function WebcamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Unable to access webcam. Please make sure you have granted permission.");
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4" 
            style={{
              color: '#ff61e6',
              textShadow: '0 0 10px #ff61e6, 0 0 20px #ff61e6',
              fontFamily: "'Press Start 2P', cursive"
            }}>
          Eye Health Monitor
        </h1>
      </div>

      <div className="relative mb-8"
           style={{
             border: '4px solid #00ff88',
             boxShadow: '0 0 20px #00ff88',
             borderRadius: '10px',
             overflow: 'hidden'
           }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-[640px] h-[480px] bg-black"
        />
      </div>

      <div className="flex gap-6">
        <button
          onClick={isStreaming ? stopWebcam : startWebcam}
          className="px-8 py-4 text-xl font-bold rounded-lg transition-all duration-300 ease-in-out"
          style={{
            background: isStreaming ? 'linear-gradient(45deg, #ff4444, #ff6666)' : 'linear-gradient(45deg, #00ff88, #00ffcc)',
            boxShadow: isStreaming ? '0 0 15px #ff4444' : '0 0 15px #00ff88',
            color: '#1a1a1a',
            border: isStreaming ? '3px solid #ff4444' : '3px solid #00ff88',
          }}
        >
          {isStreaming ? 'Stop Camera' : 'Start Camera'}
        </button>

        <Link href="/">
          <button
            className="px-8 py-4 text-xl font-bold rounded-lg transition-all duration-300 ease-in-out"
            style={{
              background: 'linear-gradient(45deg, #ff61e6, #ff8ae2)',
              boxShadow: '0 0 15px #ff61e6',
              color: '#1a1a1a',
              border: '3px solid #ff61e6',
            }}
          >
            Back to Home
          </button>
        </Link>
      </div>
    </main>
  );
} 