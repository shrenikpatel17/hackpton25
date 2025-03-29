'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function WebcamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const directionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [eyeDirection, setEyeDirection] = useState<string>("unknown");
  const [isBlinking, setIsBlinking] = useState(false);

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
    // Clear both intervals
    if (directionIntervalRef.current) {
      clearInterval(directionIntervalRef.current);
      directionIntervalRef.current = null;
    }
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current && isStreaming) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current frame on the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert the frame to base64
        const frame = canvas.toDataURL('image/jpeg', 0.8);
        return frame;
      }
    }
    return null;
  };

  const sendFrameToAPI = async (frame: string, endpoint: string) => {
    try {
      console.log(`Sending frame to ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frame }),
      });
      
      const data = await response.json();
      console.log("API response:", data);
      
      if (endpoint === '/api/py/detect-eye-direction') {
        if (data.direction) {
          setEyeDirection(data.direction);
        }
        setIsBlinking(data.is_blinking || false);
      } else if (endpoint === '/api/py/detect-blink') {
        setIsBlinking(data.is_blinking || false);
      }
    } catch (error) {
      console.error('Error sending frame to API:', error);
    }
  };

  // Start frame capture when streaming begins
  useEffect(() => {
    if (isStreaming) {
      console.log("Starting frame capture intervals");
      
      // Eye direction detection interval (1000ms)
      directionIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-eye-direction');
        }
      }, 1000);

      // Blink detection interval (100ms)
      blinkIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-blink');
        }
      }, 10);
    }

    // Cleanup function
    return () => {
      if (directionIntervalRef.current) {
        clearInterval(directionIntervalRef.current);
        directionIntervalRef.current = null;
      }
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
    };
  }, [isStreaming]);

  // Cleanup on component unmount
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
        <div className="text-white text-xl mb-4">
          Looking: <span className="font-bold text-[#00ff88]">{eyeDirection}</span>
        </div>
        <div className="text-white text-xl mb-4">
          Status: <span 
            className={`font-bold ${isBlinking ? 'text-yellow-300' : 'text-[#00ff88]'}`}
            style={{
              textShadow: isBlinking ? '0 0 10px #ffd700' : '0 0 10px #00ff88'
            }}>
            {isBlinking ? 'BLINKING' : 'Eyes Open'}
          </span>
        </div>
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
        <canvas
          ref={canvasRef}
          className="hidden"  // Hide the canvas element as it's only used for frame capture
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