'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function WebcamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const directionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ambientLightIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const distanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [eyeDirection, setEyeDirection] = useState<string>("unknown");
  const [isBlinking, setIsBlinking] = useState(false);
  const [ambientLight, setAmbientLight] = useState<string>("unknown");
  const [distance, setDistance] = useState<number | string>("unknown");

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
    // Clear all intervals
    if (directionIntervalRef.current) {
      clearInterval(directionIntervalRef.current);
      directionIntervalRef.current = null;
    }
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }
    if (ambientLightIntervalRef.current) {
      clearInterval(ambientLightIntervalRef.current);
      ambientLightIntervalRef.current = null;
    }
    if (distanceIntervalRef.current) {
      clearInterval(distanceIntervalRef.current);
      distanceIntervalRef.current = null;
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
      } else if (endpoint === '/api/py/detect-ambient-light') {
        setAmbientLight(data.amb_light || "unknown");
      } else if (endpoint === '/api/py/check-distance') {
        setDistance(data.distance_cm || "unknown");
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

      // Blink detection interval (10ms)
      blinkIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-blink');
        }
      }, 10);

      // Ambient light detection interval (1000ms)
      ambientLightIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-ambient-light');
        }
      }, 1000);

      // Distance detection interval (1000ms)
      distanceIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/check-distance');
        }
      }, 500);
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
      if (ambientLightIntervalRef.current) {
        clearInterval(ambientLightIntervalRef.current);
        ambientLightIntervalRef.current = null;
      }
      if (distanceIntervalRef.current) {
        clearInterval(distanceIntervalRef.current);
        distanceIntervalRef.current = null;
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
    <>
      <header className="fixed top-4 left-24 right-24 rounded-3xl bg-white/10 backdrop-blur-md z-50">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-white font-bold text-xl flex items-center">
                <img src="/eyeLogo.png" alt="Logo" className="w-9 h-9 mr-1" />
                optiq
              </Link>
            </div>
            <Link href="/dashboard">
              <button className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors">
                Dashboard
              </button>
            </Link>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-[#111E3B] flex flex-col items-center justify-center px-24 pt-32">
        <div className="text-center mb-12">
          <div className="grid grid-cols-4 gap-8 mb-2">
            <div className="text-gray-300">
              Looking: <span className="text-white font-medium">{eyeDirection}</span>
            </div>
            <div className="text-gray-300">
              Status: <span className="text-white font-medium">
                {isBlinking ? 'BLINKING' : 'Eyes Open'}
              </span>
            </div>
            <div className="text-gray-300">
              Ambient Light: <span className="text-white font-medium">
                {ambientLight.toUpperCase()}
              </span>
            </div>
            <div className="text-gray-300">
              Distance: <span className="text-white font-medium">
                {typeof distance === 'number' ? `${distance.toFixed(1)} cm` : distance}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mb-8 rounded-2xl overflow-hidden border-2 border-white/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-[640px] h-[480px] bg-black"
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
        </div>

        <button
          onClick={isStreaming ? stopWebcam : startWebcam}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            isStreaming 
            ? 'bg-red-500 text-white hover:bg-red-600' 
            : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          {isStreaming ? 'Stop Camera' : 'Start Camera'}
        </button>
      </div>
    </>
  );
} 