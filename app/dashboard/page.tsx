'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  sessions: string[];
  blinkRate: number;
  lookAwayRate: number;
  moveBackRate: number;
  createdAt: string;
}

interface SessionData {
  date: string;
  timeStart: string;
  timeEnd: string;
  blinkRate: number;
  ambientLight: string;
  eyePosition: string;
  eyeDistance: number;
}


interface SessionMetrics {
  blinkRate: number;
  ambientLightRatio: number;
  lookAwayRatio: number;
  screenDistance: number;
}

/**
 * Calculate metrics from session data within a specified time range
 * @param sessions Array of session objects
 * @param startTime Unix timestamp for the start of the range
 * @param endTime Unix timestamp for the end of the range
 * @returns Object with calculated metrics
 */
function calculateMetrics(
  sessions: any[], 
  startTime: number, 
  endTime: number
): SessionMetrics {
  // Filter sessions that fall within the specified time range
  const filteredSessions = sessions.filter(session => {
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Check if session overlaps with the specified time range
    return (sessionStartTime >= startTime && sessionStartTime <= endTime) || 
           (sessionEndTime >= startTime && sessionEndTime <= endTime) ||
           (sessionStartTime <= startTime && sessionEndTime >= endTime);
  });
  
  // Calculate blink rate
  let totalBlinks = 0;
  let totalDuration = 0;
  
  // Gather blink data from all filtered sessions
  filteredSessions.forEach(session => {
    if (session.blinkTimestamps && session.blinkTimestamps.length > 0) {
      // Add the number of blinks
      totalBlinks += session.blinkTimestamps.length;
      totalDuration += (new Date(session.endTime).getTime() / 1000) - (new Date(session.startTime).getTime() / 1000);
    }
  });

  
  // Calculate blink rate (blinks per minute)
  let blinkRate = 0;
  if (totalBlinks > 0 && totalDuration > 0) {
    const durationInMinutes = totalDuration / 60; // Convert seconds to minutes
    blinkRate = totalBlinks / durationInMinutes;
  }
  
  // Calculate ambient light ratio (time spent in 'bright' / total time)
  let arrayAmbientLightRatios : any[] = [];
  
  // Using the already filtered sessions
  filteredSessions.forEach(session => {
    let totalTimeInDarkLight = 0;
    
    if (session.lightStateChanges && session.lightStateChanges.length > 0) {
      // Sort the light state changes by timestamp
      let sessionDuration = (new Date(session.endTime).getTime() / 1000) - (new Date(session.startTime).getTime() / 1000);
      const sortedLightChanges = [...session.lightStateChanges].sort((a, b) => a.timestamp - b.timestamp);
      
      // Process each light state segment
      for (let i = 0; i < sortedLightChanges.length; i++) {
        const currentChange = sortedLightChanges[i];
        
        // If this is a "dark" state, calculate duration until next change
        if (currentChange.ambient_light === "dark") {
          const nextTimestamp = (i < sortedLightChanges.length - 1) 
            ? sortedLightChanges[i + 1].timestamp 
            : new Date(session.endTime).getTime() / 1000; // Convert session end to timestamp
          
          totalTimeInDarkLight += (nextTimestamp - currentChange.timestamp);
          
        }
      }

      let ambientLightRatio = (1 - (totalTimeInDarkLight / sessionDuration));
      arrayAmbientLightRatios.push(ambientLightRatio);
    }
  });
  
  let ambientLightRatio = arrayAmbientLightRatios.length > 0 
    ? arrayAmbientLightRatios.reduce((acc, ratio) => acc + ratio, 0) / arrayAmbientLightRatios.length 
    : 0;


  // Calculate look away ratio (time spent looking away / total time)
  let arrayLookAwayRatios : any[] = [];
  filteredSessions.forEach(session => {
    let totalLookAwayTime = 0;
    if (session.directionChanges && session.directionChanges.length > 0) {
      // Sort the light state changes by timestamp
      let sessionDuration = (new Date(session.endTime).getTime() / 1000) - (new Date(session.startTime).getTime() / 1000);
      const sortedDirectionChanges = [...session.directionChanges].sort((a, b) => a.timestamp - b.timestamp);
      
      // Process each 1 direction segment
      for (let i = 0; i < sortedDirectionChanges.length; i++) {
        const currentDirChange = sortedDirectionChanges[i];
        
        // If this is a "dark" state, calculate duration until next change
        if (currentDirChange.looking_away === 1) {
          const nextTimestamp = (i < sortedDirectionChanges.length - 1) 
            ? sortedDirectionChanges[i + 1].timestamp 
            : new Date(session.endTime).getTime() / 1000; // Convert session end to timestamp
          
          totalLookAwayTime += (nextTimestamp - currentDirChange.timestamp);
        }
      }

      let lookAwayRatio = (totalLookAwayTime / sessionDuration);
      arrayLookAwayRatios.push(lookAwayRatio);
    }
  });
  
  console.log("arrayLookAwayRatios", arrayLookAwayRatios);
  let lookAwayRatio = arrayLookAwayRatios.length > 0 
    ? arrayLookAwayRatios.reduce((acc, ratio) => acc + ratio, 0) / arrayLookAwayRatios.length 
    : 0;
  
  
  // Calculate percentage of time not close to the screen based on the formula
  let arrayScreenDistances : any[] = [];
  filteredSessions.forEach(session => {
    let totalNotCloseTime = 0;
    // Only proceed if there's a valid intersection
    let sessionDuration = (new Date(session.endTime).getTime() / 1000) - (new Date(session.startTime).getTime() / 1000);
    console.log("sessionDuration", sessionDuration);

    if (session.distanceChanges && session.distanceChanges.length > 0) {
      // Sort the distance changes by start_time to ensure chronological order
      const sortedDistanceChanges = [...session.distanceChanges].sort(
        (a, b) => a.start_time - b.start_time
      );

      // Process all distance changes
      for (let i = 0; i < sortedDistanceChanges.length; i++) {
        const current = sortedDistanceChanges[i];
        
        // For "not close" segments (med or far), calculate the duration
        if (current.distance !== "close") {
          const duration = current.end_time - current.start_time;
          console.log("duration", duration);
          if (duration > 0) {
            totalNotCloseTime += duration;
          }
        }
      }

      let screenDistance = (totalNotCloseTime / sessionDuration);
      console.log("totalNotCloseTime", totalNotCloseTime);
      arrayScreenDistances.push(screenDistance);
    }
  });
  
  console.log("arrayScreenDistances", arrayScreenDistances);
  let screenDistance = arrayScreenDistances.length > 0 
    ? arrayScreenDistances.reduce((acc, ratio) => acc + ratio, 0) / arrayScreenDistances.length 
    : 0;

  console.log("blinkRate", blinkRate);
  console.log("ambientLightRatio", ambientLightRatio);
  console.log("lookAwayRatio", lookAwayRatio);
  console.log("screenDistance", screenDistance);
  
  // Return the calculated metrics
  return {  
    blinkRate: Number(blinkRate.toFixed(2)),
    ambientLightRatio: Number(ambientLightRatio.toFixed(2)),
    lookAwayRatio: Number(lookAwayRatio.toFixed(2)),
    screenDistance: Number(screenDistance.toFixed(2))
  };
}


function calculateEyeHealthScore(B: number, D: number, C: number, T: number): number {
  if (B === 0 && D === 0 && C === 0 && T === 0) {
    return 0;
  }

  let part1 = 0.4 * (Math.min(B/14, 1))
  let part2 = 0.3 * (Math.min(D/.80, 1))
  let part3 = 0.1 * (Math.min(C/.35, 1))
  let part4 = 0.2 * (Math.min(T/.98, 1))

  console.log(part1, part2, part3, part4);

  var score = part1 + part2 + part3 + part4
  console.log(score);

  return score;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allUserSessions, setAllUserSessions] = useState<SessionData[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [sliderValues, setSliderValues] = useState({
    blinkRate: 70,
    lookAwayInterval: 85,
    moveBackInterval: 55
  });
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  // Placeholder function that would normally calculate B, D, C, T values for a time range
  const placeholderFunction = (start: number, end: number) => {
    // This is where you would implement the actual logic to calculate these values
    // For now, returning sample values
    return {
      B: Math.random() * 20, // Sample blink rate
      D: Math.random() * 100, // Sample distance
      C: Math.random() * 40, // Sample look away rate
      T: Math.random() * 120, // Sample ambient light value
    };
  };

  const sliderConfig = {
    blinkRate: {
      ticks: [10, 15, 20, 25, 30], // blinks per minute
      labels: ['10', '15', '20', '25', '30']
    },
    lookAwayInterval: {
      ticks: [15, 20, 25, 30, 35, 40], // minutes
      labels: ['15', '20', '25', '30', '35', '40']
    },
    moveBackInterval: {
      ticks: [50, 60, 70, 80, 90, 100], // cm
      labels: ['50', '60', '70', '80', '90', '100']
    }
  };

  const generateTimeIntervals = () => {
    const intervals: { start: number; end: number; label: string; fullDate?: Date }[] = [];
    const secondsPerDay = 24 * 60 * 60;
    
    if (viewMode === 'week') {
      // Get current date and find the most recent Sunday
      const today = new Date();
      const currentSunday = new Date(today);
      currentSunday.setDate(today.getDate() - today.getDay());
      
      // Apply week offset to get the target Sunday
      const targetSunday = new Date(currentSunday);
      targetSunday.setDate(currentSunday.getDate() + (weekOffset * 7));
      targetSunday.setHours(0, 0, 0, 0); // Reset time to start of day
      
      // Generate 7 daily intervals starting from the target Sunday
      for (let i = 0; i < 7; i++) {
        const date = new Date(targetSunday);
        date.setDate(targetSunday.getDate() + i);
        const start = Math.floor(date.getTime() / 1000); // Convert to Unix timestamp
        const end = start + secondsPerDay;
        intervals.push({
          start,
          end,
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          fullDate: new Date(date)
        });
      }
    } else {
      // Generate 24 hourly intervals for the selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const secondsPerHour = 60 * 60;
      
      for (let i = 0; i < 24; i++) {
        const start = Math.floor(startOfDay.getTime() / 1000) + (i * secondsPerHour); // Convert to Unix timestamp
        const end = start + secondsPerHour;
        intervals.push({
          start,
          end,
          label: `${i}:00`
        });
      }
    }
    
    return intervals;
  };

  const handleBarClick = (elements: any[]) => {
    if (elements.length > 0 && viewMode === 'week') {
      const index = elements[0].index;
      const clickedInterval = intervals[index];
      if (clickedInterval.fullDate) {
        setSelectedDate(clickedInterval.fullDate);
        setViewMode('day');
      }
    }
  };

  const calculateAverageMetrics = () => {
    const intervals = generateTimeIntervals();
    let totalD = 0;
    let totalC = 0;
    let totalT = 0;
    let count = 0;

    intervals.forEach(interval => {
      const { ambientLightRatio, lookAwayRatio, screenDistance } = calculateMetrics(allUserSessions, interval.start, interval.end);
      totalD += Math.min(ambientLightRatio / .80, 1);
      totalC += Math.min(lookAwayRatio / .35, 1);
      totalT += Math.min(screenDistance / .98, 1);
      if (!(ambientLightRatio === 0 && lookAwayRatio === 0 && screenDistance === 0)) {
        count++;
      }
    });

    console.log("totalD", totalD);
    console.log("totalC", totalC);
    console.log("totalT", totalT);
    console.log("count", count);

    return {
      D: (totalD / count),
      C: (totalC / count),
      T: (totalT / count)
    };
  };

  const metrics = calculateAverageMetrics();

  const createDoughnutData = (value: number, label: string) => ({
    labels: [label, 'Remaining'],
    datasets: [
      {
        data: [value*100, 100 - (value*100)],
        backgroundColor: [
          'rgba(134, 239, 172, 0.8)',
          'rgba(255, 255, 255, 0.1)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgba(255, 255, 255, 0.2)'
        ],
        borderWidth: 1,
      },
    ],
  });

  const doughnutOptions = {
    responsive: true,
    cutout: '75%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.formattedValue}%`;
          }
        }
      }
    },
  };

  const intervals = generateTimeIntervals();
  const healthScores = intervals.map(interval => {
    const { blinkRate, ambientLightRatio, lookAwayRatio, screenDistance } = calculateMetrics(allUserSessions, interval.start, interval.end);
    console.log(blinkRate, ambientLightRatio, lookAwayRatio, screenDistance);
    return calculateEyeHealthScore(blinkRate, ambientLightRatio, lookAwayRatio, screenDistance);
  });

  const chartData = {
    labels: intervals.map(interval => interval.label),
    datasets: [
      {
        label: 'Health Score',
        data: healthScores,
        backgroundColor: healthScores.map(score => 
          score >= 0.85 ? 'rgba(134, 239, 172, 0.8)' : 'rgba(252, 165, 165, 0.8)'
        ),
        borderColor: healthScores.map(score => 
          score >= 0.85 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
        ),
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    onClick: (_: any, elements: any[]) => handleBarClick(elements),
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: viewMode === 'week' 
          ? `Eye Health Score - Week of ${intervals[0]?.fullDate?.toLocaleDateString()}`
          : `Eye Health Score - ${selectedDate.toLocaleDateString()}`,
        color: 'white',
        font: {
          size: 16,
        },
      },
    },
  };

  const handleSliderChange = (event: React.MouseEvent<HTMLDivElement>, type: 'blinkRate' | 'lookAwayInterval' | 'moveBackInterval') => {
    const slider = event.currentTarget;
    const rect = slider.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const rawPercentage = (x / width) * 100;
    
    // Find the closest tick value
    const config = sliderConfig[type];
    const tickPercentages = config.ticks.map((tick) => {
      const min = config.ticks[0];
      const max = config.ticks[config.ticks.length - 1];
      return ((tick - min) / (max - min)) * 100;
    });
    
    // Find the closest tick percentage
    let closestTickIndex = 0;
    let minDistance = Math.abs(tickPercentages[0] - rawPercentage);
    
    tickPercentages.forEach((tickPercentage, index) => {
      const distance = Math.abs(tickPercentage - rawPercentage);
      if (distance < minDistance) {
        minDistance = distance;
        closestTickIndex = index;
      }
    });
    
    setSliderValues(prev => ({
      ...prev,
      [type]: tickPercentages[closestTickIndex]
    }));
  };

  const getValueText = (type: 'blinkRate' | 'lookAwayInterval' | 'moveBackInterval') => {
    const config = sliderConfig[type];
    const percentage = sliderValues[type];
    const min = config.ticks[0];
    const max = config.ticks[config.ticks.length - 1];
    const value = Math.round(min + (percentage / 100) * (max - min));
    
    switch(type) {
      case 'blinkRate':
        return `${value} blinks/min`;
      case 'lookAwayInterval':
        return `Every ${value} min`;
      case 'moveBackInterval':
        return `${value} cm`;
    }
  };

  const fetchRecommendations = async (metrics: any) => {
    setIsLoading(true);
    setRecommendationsError(null);
    try {
      const response = await fetch("/api/eye-care", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metrics }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      
      const data = await response.json();
      if (data.analysis && Array.isArray(data.analysis)) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis([]);
      }
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setRecommendations(data.suggestions);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendationsError("Failed to load recommendations");
      setAnalysis([]);
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initialize Firebase
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // Modify the onMessage handler
    const setupMessageListener = (messaging: any) => {
      console.log('Setting up message listener');
      return onMessage(messaging, (payload) => {
        console.log('Received foreground message:', payload);
        // Create and show notification manually for foreground messages
        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || 'Default Title', {
            body: payload.notification?.body || 'Default Body',
            icon: '/eyeLogo.png'
          });
        }
      });
    };

    // Update the initializePushNotifications function
    async function initializePushNotifications() {
        console.log("Initializing push notifications");
        try {
            if (!('Notification' in window)) {
                console.log('This browser does not support notifications');
                return;
            }

            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Getting FCM token...');
                const token = await getToken(messaging, {
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                });

                if (!token) {
                    console.error('No registration token available');
                    return;
                }

                console.log('FCM Token:', token);
                
                // Register token with backend
                const response = await fetch('/api/py/register-fcm-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: user?.email || 'default',
                        token: token
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to register FCM token with backend');
                }
                
                console.log('Successfully registered FCM token with backend');

                // Set up message listener
                setupMessageListener(messaging);
            } else {
                console.log('Notification permission denied.');
            }
        } catch (error:any) {
            console.error('Error initializing push notifications:', error);
            if (error.code) {
                console.error('Error code:', error.code);
            }
            if (error.message) {
                console.error('Error message:', error.message);
            }
        }
    }

    // Fetch user data and sessions
    async function fetchUserData() {
      try {
        console.log('Fetching user data...');
        const response = await fetch('/api/auth/user');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log('User not authenticated, redirecting to login...');
            router.push('/login');
            return;
          }
          const errorData = await response.json();
          console.error('Error response:', errorData);
          throw new Error(errorData.message || 'Failed to fetch user data');
        }
        
        const data = await response.json();
        console.log('User data received:', data);
        setUser(data);

        // Fetch sessions data if user has sessions
        if (data.sessions && data.sessions.length > 0) {
          console.log('Fetching sessions data...');
          const sessionsResponse = await fetch(`/api/sessions?userId=${data._id}`);
          console.log('Sessions response status:', sessionsResponse.status);
          
          if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            console.log('Sessions data received:', sessionsData);
            setSessions(sessionsData);
            setAllUserSessions(sessionsData);
          } else {
            console.error('Failed to fetch sessions:', await sessionsResponse.text());
          }
        }

        // Initialize push notifications after user data is loaded
        await initializePushNotifications();
      } catch (err: any) {
        console.error('Error in fetchUserData:', err);
        setError(err.message || 'Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

  // Add a separate useEffect for recommendations
  useEffect(() => {
    // Only fetch recommendations when viewMode changes or when user explicitly requests new data
    if (viewMode === 'week' || viewMode === 'day') {
      const currentMetrics = calculateAverageMetrics();
      fetchRecommendations(currentMetrics);
    }
  }, [viewMode, weekOffset, selectedDate]); // Only depend on view changes

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
            <Link href="/webcam">
              <button className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors">
                New Session
              </button>
            </Link>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-[#111E3B] flex flex-col pt-32 px-24">
        {loading ? (
          <div className="text-white">Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : user ? (
          <div className="w-full">
            <h1 className="text-5xl font-Raleway font-[400] text-white font-bold mb-8 leading-tight">
              Welcome, {user.firstName}!
            </h1>

            <div className="bg-white/10 h-[84vh] backdrop-blur-md p-8 rounded-xl mb-8">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Health Score Timeline</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => viewMode === 'week' ? setWeekOffset(prev => prev - 1) : setSelectedDate(prev => {
                        const newDate = new Date(prev);
                        newDate.setDate(prev.getDate() - 1);
                        return newDate;
                      })}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                      </svg>
                    </button>
                    {viewMode === 'day' && (
                      <input
                        type="date"
                        value={selectedDate.toISOString().split('T')[0]}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        className="bg-white/20 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40"
                      />
                    )}
                    <button
                      onClick={() => {
                        const today = new Date();
                        if (viewMode === 'week') {
                          if (weekOffset < 0) {
                            setWeekOffset(prev => prev + 1);
                          }
                        } else {
                          const nextDay = new Date(selectedDate);
                          nextDay.setDate(selectedDate.getDate() + 1);
                          if (nextDay <= today) {
                            setSelectedDate(nextDay);
                          }
                        }
                      }}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                      disabled={viewMode === 'week' ? weekOffset === 0 : selectedDate >= new Date()}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="inline-flex rounded-lg overflow-hidden">
                  <button
                    className={`px-4 py-2 text-sm font-medium ${
                      viewMode === 'week'
                        ? 'bg-white text-black'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    } transition-colors`}
                    onClick={() => setViewMode('week')}
                  >
                    Week
                  </button>
                  <button
                    className={`px-4 py-2 text-sm font-medium ${
                      viewMode === 'day'
                        ? 'bg-white text-black'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    } transition-colors`}
                    onClick={() => setViewMode('day')}
                  >
                    Day
                  </button>
                </div>
              </div>
              <Bar className="h-[300px]" data={chartData} options={chartOptions} />
            </div>

            <div className="flex gap-8">
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl mb-8">
                <h2 className="text-2xl font-bold text-white mb-14">Health Metrics Overview</h2>
                <div className="grid grid-cols-3 gap-8">
                  <div className="flex flex-col items-center">
                    <div className="relative w-48 h-48">
                      <Doughnut data={createDoughnutData(metrics.D, 'Distance')} options={doughnutOptions} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">{Math.round(metrics.D*100)}%</div>
                          <div className="text-sm text-gray-300">% Light Env</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="relative w-48 h-48">
                      <Doughnut data={createDoughnutData(metrics.C, 'Look Away')} options={doughnutOptions} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">{Math.round(metrics.C*100)}%</div>
                          <div className="text-sm text-gray-300">% Look Away</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="relative w-48 h-48">
                      <Doughnut data={createDoughnutData(metrics.T, 'Ambient Light')} options={doughnutOptions} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white">{Math.round(metrics.T*100)}%</div>
                          <div className="text-sm text-gray-300">% Healthy Distance</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl mb-8 flex-1">
                <h2 className="text-2xl font-bold text-white mb-6">Target Settings</h2>
                <div className="space-y-12">
                  {Object.entries(sliderConfig).map(([type, config]) => (
                    <div key={type}>
                      <div className="flex justify-between mb-2">
                        <span className="text-md text-gray-300">
                          {type === 'blinkRate' ? 'Blink Rate' :
                           type === 'lookAwayInterval' ? 'Look Away Interval' :
                           'Move Back Distance'}
                        </span>
                        <span className="text-md text-white">
                          {getValueText(type as keyof typeof sliderValues)}
                        </span>
                      </div>
                      <div 
                        className="relative h-8 text-md flex items-center cursor-pointer group"
                        onClick={(e) => handleSliderChange(e, type as keyof typeof sliderValues)}
                      >
                        <div className="h-2 bg-white/10 rounded-full w-full">
                          <div 
                            className="absolute h-2 bg-emerald-400/80 rounded-full" 
                            style={{ width: `${sliderValues[type as keyof typeof sliderValues]}%` }}
                          />
                          {/* Tick marks */}
                          {config.ticks.map((tick, index) => {
                            const percentage = ((tick - config.ticks[0]) / (config.ticks[config.ticks.length - 1] - config.ticks[0])) * 100;
                            return (
                              <div key={tick} className="absolute flex flex-col items-center" style={{ left: `${percentage}%` }}>
                                <div className="w-0.5 h-2 bg-white/40 -mt-3" />
                                <span className="text-xs text-white/60 mt-2">{config.labels[index]}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div 
                          className="absolute w-4 h-4 bg-white rounded-full shadow-lg transition-transform group-hover:scale-110 z-10"
                          style={{ 
                            left: `${sliderValues[type as keyof typeof sliderValues]}%`,
                            transform: 'translateX(-50%)'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Personalized Insights</h2>
              
              {/* Analysis Section */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-white mb-4">Analysis</h3>
                <div className="space-y-4">
                  {isLoading ? (
                    <p className="text-gray-300 text-md">Loading analysis...</p>
                  ) : analysis.length > 0 ? (
                    <ul className="text-gray-300 text-md space-y-2"> 
                      {analysis.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-300 text-md">No analysis available at the moment.</p>
                  )}
                </div>
              </div>

              {/* Recommendations Section */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Recommendations</h3>
                <div className="space-y-4">
                  {recommendationsError ? (
                    <p className="text-red-400 text-md">{recommendationsError}</p>
                  ) : (
                    <ul className="text-gray-300 text-md space-y-2">
                      {isLoading ? (
                        <li>Loading recommendations...</li>
                      ) : recommendations.length > 0 ? (
                        recommendations.map((recommendation, index) => (
                          <li key={index}>{recommendation}</li>
                        ))
                      ) : (
                        <li>No recommendations available at the moment.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </>
  );
}
