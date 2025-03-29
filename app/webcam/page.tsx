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
  const [sessionStart, setSessionStart] = useState<number | null>(null);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setSessionStart(Date.now());
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Unable to access webcam. Please make sure you have granted permission.");
    }
  };

  const saveSession = async () => {
    try {
      console.log("Saving session data...");
      
      // First, fetch the session data from Python backend
      const response = await fetch('/api/py/session-data');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch session data: ${response.status} ${response.statusText}`);
      }
      
      const sessionData = await response.json();
      console.log("Session data retrieved:", sessionData);
      
      // Get the user data to get the user ID
      let userId = null;
      try {
        const userResponse = await fetch('/api/auth/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userId = userData._id; // Assuming the ID is available at _id
          console.log("Got user ID:", userId);
        } else {
          console.log("User not authenticated, saving session without user ID");
        }
      } catch (userError) {
        console.error("Error fetching user data:", userError);
        // Continue without user ID
      }
      
      // Now save the session with or without the user ID
      const saveResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directionChanges: sessionData.direction_changes,
          blinkTimestamps: sessionData.blink_timestamps,
          stateChanges: sessionData.state_changes,
          distanceChanges: sessionData.distance_changes,
          startTime: new Date().toISOString(),
          userId: userId // Include the user ID if available
        }),
      });
      
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(`Failed to save session: ${errorData.message || saveResponse.statusText}`);
      }
      
      const result = await saveResponse.json();
      console.log("Session saved successfully:", result);
      
      alert("Session data saved successfully!");
      
    } catch (error: any) {
      console.error("Error saving session:", error);
      alert(`Failed to save session data: ${error.message}`);
    }
  };

  const stopWebcam = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);

      await saveSession();

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

      setSessionStart(null);
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current && isStreaming) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
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

  useEffect(() => {
    if (isStreaming) {
      console.log("Starting frame capture intervals");
      
      directionIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-eye-direction');
        }
      }, 1000);

      blinkIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-blink');
        }
      }, 10);

      ambientLightIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/detect-ambient-light');
        }
      }, 1000);

      distanceIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          sendFrameToAPI(frame, '/api/py/check-distance');
        }
      }, 500);
    }

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

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const calculateBlinkRate = (timestamps: number[]): number => {
    if (timestamps.length < 2) return 0;
    const duration = (timestamps[timestamps.length - 1] - timestamps[0]) / 60;
    return timestamps.length / duration;
  };

  const calculateLookAwayTime = (changes: Array<{looking_away: number, timestamp: number}>): number => {
    let totalTime = 0;
    for (let i = 0; i < changes.length - 1; i++) {
      if (changes[i].looking_away === 1) {
        totalTime += changes[i + 1].timestamp - changes[i].timestamp;
      }
    }
    return totalTime;
  };

  const calculateAverageDistance = (changes: Array<{distance: string, start_time: number, end_time: number}>): number => {
    if (changes.length === 0) return 0;
    
    let totalWeightedDistance = 0;
    let totalTime = 0;
    
    changes.forEach(change => {
      const duration = change.end_time - change.start_time;
      const distanceValue = change.distance === 'close' ? 40 : 
                           change.distance === 'med' ? 75 : 110;
      
      totalWeightedDistance += distanceValue * duration;
      totalTime += duration;
    });
    
    return totalWeightedDistance / totalTime;
  };

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