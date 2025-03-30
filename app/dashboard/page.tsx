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
  let earliestTimestamp = Infinity;
  let latestTimestamp = 0;
  
  // Gather blink data from all filtered sessions
  filteredSessions.forEach(session => {
    if (session.blinkTimestamps && session.blinkTimestamps.length > 0) {
      // Add the number of blinks
      totalBlinks += session.blinkTimestamps.length;
      
      // Find the earliest and latest timestamps
      const sessionEarliestTimestamp = Math.min(...session.blinkTimestamps);
      const sessionLatestTimestamp = Math.max(...session.blinkTimestamps);
      
      if (sessionEarliestTimestamp < earliestTimestamp) {
        earliestTimestamp = sessionEarliestTimestamp;
      }
      
      if (sessionLatestTimestamp > latestTimestamp) {
        latestTimestamp = sessionLatestTimestamp;
      }
    }
  });
  
  // Calculate blink rate (blinks per minute)
  let blinkRate = 0;
  if (totalBlinks > 0 && earliestTimestamp !== Infinity && latestTimestamp > earliestTimestamp) {
    const timeSpanMinutes = (latestTimestamp - earliestTimestamp) / 60; // Convert seconds to minutes
    blinkRate = totalBlinks / timeSpanMinutes;
  }
  
  // Calculate ambient light ratio (time spent in 'bright' / total time)
  let totalTimeInDarkLight = 0;
  let totalTimeSpan = 0;
  
  // Using the already filtered sessions
  filteredSessions.forEach(session => {
    // Convert session start/end times to unix timestamps if necessary
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Calculate intersection of session time with requested time range
    const effectiveStartTime = Math.max(sessionStartTime, startTime);
    const effectiveEndTime = Math.min(sessionEndTime, endTime);
    
    // Only proceed if there's a valid intersection
    if (effectiveEndTime > effectiveStartTime) {
      // Add this session's duration to total time span
      totalTimeSpan += (effectiveEndTime - effectiveStartTime);
      
      if (session.lightStateChanges && session.lightStateChanges.length > 0) {
        // Sort the light state changes by timestamp
        const sortedLightChanges = [...session.lightStateChanges].sort((a, b) => a.timestamp - b.timestamp);
        
        // First, handle case where we need to consider time before first light change
        if (sortedLightChanges[0].timestamp > effectiveStartTime) {
          // We need to assume a state for the time before first recorded change
          // For this implementation, we'll assume "bright" (meaning no "dark" time contribution)
          // If you want to change this assumption, modify this section
        }
        
        // Process each light state segment
        for (let i = 0; i < sortedLightChanges.length; i++) {
          const currentChange = sortedLightChanges[i];
          
          // Determine the end of this light state
          const nextTimestamp = (i < sortedLightChanges.length - 1) 
            ? sortedLightChanges[i + 1].timestamp 
            : effectiveEndTime;
          
          // Make sure this light state segment is within our time range
          const segmentStart = Math.max(currentChange.timestamp, effectiveStartTime);
          const segmentEnd = Math.min(nextTimestamp, effectiveEndTime);
          
          // If the segment is valid and the light state is "dark", add its duration to the dark time
          if (segmentEnd > segmentStart && currentChange.ambient_light === "dark") {
            totalTimeInDarkLight += (segmentEnd - segmentStart);
          }
        }
      }
    }
  });
  
  // Calculate ratio of bright light time to total time
  // (1 - dark time ratio) = bright time ratio
  let ambientLightRatio = totalTimeSpan > 0 ? 1 - (totalTimeInDarkLight / totalTimeSpan) : 0;
  
  // Calculate look away ratio (time spent looking away / total time)
  let totalLookAwayTime = 0;
  let lookAwayTimeSpan = 0;
  
  // Using the already filtered sessions
  filteredSessions.forEach(session => {
    // Convert session start/end times to unix timestamps if necessary
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Calculate intersection of session time with requested time range
    const effectiveStartTime = Math.max(sessionStartTime, startTime);
    const effectiveEndTime = Math.min(sessionEndTime, endTime);
    
    // Only proceed if there's a valid intersection
    if (effectiveEndTime > effectiveStartTime) {
      // Add this session's duration to total look away time span
      lookAwayTimeSpan += (effectiveEndTime - effectiveStartTime);
      
      if (session.directionChanges && session.directionChanges.length > 0) {
        // Sort the direction changes by timestamp
        const sortedDirectionChanges = [...session.directionChanges].sort((a, b) => a.timestamp - b.timestamp);
        
        // First, handle case where we need to consider time before first direction change
        if (sortedDirectionChanges[0].timestamp > effectiveStartTime) {
          // We need to assume a direction for the time before first recorded change
          // For this implementation, we'll assume "looking center" (meaning no "looking away" time contribution)
          // If you want to change this assumption, modify this section
        }
        
        // Process each direction state segment
        for (let i = 0; i < sortedDirectionChanges.length; i++) {
          const currentChange = sortedDirectionChanges[i];
          
          // Determine the end of this direction state
          const nextTimestamp = (i < sortedDirectionChanges.length - 1) 
            ? sortedDirectionChanges[i + 1].timestamp 
            : effectiveEndTime;
          
          // Make sure this direction state segment is within our time range
          const segmentStart = Math.max(currentChange.timestamp, effectiveStartTime);
          const segmentEnd = Math.min(nextTimestamp, effectiveEndTime);
          
          // If the segment is valid and the looking_away is 1, add its duration to the look away time
          if (segmentEnd > segmentStart && currentChange.looking_away === 1) {
            totalLookAwayTime += (segmentEnd - segmentStart);
          }
        }
      }
    }
  });
  
  // Calculate ratio of look away time to total time
  let lookAwayRatio = lookAwayTimeSpan > 0 ? totalLookAwayTime / lookAwayTimeSpan : 0;
  
  // Store the total requested time range for the denominator of the formula
  const totalRequestedTimeRange = endTime - startTime;
  
  // Calculate percentage of time not close to the screen based on the formula
  let totalNotCloseTime = 0;
  
  filteredSessions.forEach(session => {
    // Convert session start/end times to unix timestamps if necessary
    const sessionStartTime = typeof session.startTime === 'number' ? 
      session.startTime : new Date(session.startTime).getTime() / 1000;
    const sessionEndTime = typeof session.endTime === 'number' ? 
      session.endTime : new Date(session.endTime).getTime() / 1000;
    
    // Calculate intersection of session time with requested time range
    const effectiveStartTime = Math.max(sessionStartTime, startTime);
    const effectiveEndTime = Math.min(sessionEndTime, endTime);
    
    // Only proceed if there's a valid intersection
    if (effectiveEndTime > effectiveStartTime) {
      if (session.distanceChanges && session.distanceChanges.length > 0) {
        // Sort the distance changes by start_time to ensure chronological order
        const sortedDistanceChanges = [...session.distanceChanges].sort(
          (a, b) => a.start_time - b.start_time
        );
        
        console.log(`  Distance changes (${sortedDistanceChanges.length}):`);
        sortedDistanceChanges.forEach((change, idx) => {
          console.log(`    ${idx + 1}. ${change.distance}: ${new Date(change.start_time * 1000).toLocaleTimeString()} to ${new Date(change.end_time * 1000).toLocaleTimeString()}`);
        });

        // Find the last "close" segment start time before each "not close" segment
        let lastCloseStartTime = null;

        // Process all original distance changes to catch all transitions
        for (let i = 0; i < sortedDistanceChanges.length; i++) {
          const current = sortedDistanceChanges[i];
          
          // Skip if this change is outside our time range
          if (current.end_time < effectiveStartTime || current.start_time > effectiveEndTime) {
            continue;
          }
          
          // Update the last close start time whenever we encounter a "close" segment
          if (current.distance === "close") {
            lastCloseStartTime = current.start_time;
            continue;
          }
          
          // For every "not close" segment (med or far), calculate the time difference
          if (current.distance === "med" || current.distance === "far") {
            const notCloseStartTime = current.start_time;
            
            // If we have a previous close segment, calculate the time difference
            if (lastCloseStartTime !== null) {
              const timeDifference = notCloseStartTime - lastCloseStartTime;
              
              
              
              if (timeDifference > 0) {
                totalNotCloseTime += timeDifference;
                console.log(`    Added to total: now ${totalNotCloseTime} seconds`);
              } else {
                console.log(`    No time added (difference <= 0)`);
              }
            } else {
              // For the first "not close" segment with no previous "close", use session start time
              const referenceTime = effectiveStartTime;
              const timeDifference = notCloseStartTime - referenceTime;
              
              console.log(`  Initial not close segment (no previous close):`);
              console.log(`    Not close start: ${new Date(notCloseStartTime * 1000).toLocaleTimeString()}`);
              console.log(`    Session start: ${new Date(referenceTime * 1000).toLocaleTimeString()}`);
              console.log(`    Time difference: ${timeDifference} seconds (${timeDifference/60} minutes)`);
              
              if (timeDifference > 0) {
                totalNotCloseTime += timeDifference;
                console.log(`    Added to total: now ${totalNotCloseTime} seconds`);
              } else {
                console.log(`    No time added (difference <= 0)`);
              }
            }
          }
        }
      }
    }
  });
  
  // Calculate ratio 
  let screenDistance = totalRequestedTimeRange > 0 ? totalNotCloseTime / totalRequestedTimeRange : 0;
  
  // Ensure the ratio is between 0 and 1
  screenDistance = Math.min(1, Math.max(0, screenDistance));
  
  // Return the calculated metrics
  return {  
    blinkRate: Number(blinkRate.toFixed(2)),
    ambientLightRatio: Number(ambientLightRatio.toFixed(2)),
    lookAwayRatio: Number(lookAwayRatio.toFixed(2)),
    screenDistance: Number(screenDistance.toFixed(2))
  };
}


function calculateEyeHealthScore(B: number, D: number, C: number, T: number): number {
  return (
    0.3 * (1 - Math.min(B / 14, 1)) +
    0.2 * (1 - Math.min(D / 80, 1)) +
    0.25 * (1 - Math.min(C / 30, 1)) +
    0.25 * (1 - Math.min(T / 98, 1))
  );
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
    const msPerDay = 24 * 60 * 60 * 1000;
    
    if (viewMode === 'week') {
      // Calculate the start of the week with offset
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (weekOffset * 7));
      
      // Generate 7 daily intervals
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const start = date.getTime();
        const end = start + msPerDay;
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
      const msPerHour = 60 * 60 * 1000;
      
      for (let i = 0; i < 24; i++) {
        const start = startOfDay.getTime() + (i * msPerHour);
        const end = start + msPerHour;
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
      const { D, C, T } = placeholderFunction(interval.start, interval.end);
      totalD += Math.min(D / 80, 1);
      totalC += Math.min(C / 30, 1);
      totalT += Math.min(T / 98, 1);
      count++;
    });

    return {
      D: (totalD / count) * 100,
      C: (totalC / count) * 100,
      T: (totalT / count) * 100
    };
  };

  const metrics = calculateAverageMetrics();

  const createDoughnutData = (value: number, label: string) => ({
    labels: [label, 'Remaining'],
    datasets: [
      {
        data: [value, 100 - value],
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
    const { B, D, C, T } = placeholderFunction(interval.start, interval.end);
    return calculateEyeHealthScore(B, D, C, T);
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
        const response = await fetch('/api/auth/user');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch user data');
        }
        const data = await response.json();
        setUser(data);

        // Fetch sessions data if user has sessions
        if (data.sessions && data.sessions.length > 0) {
          const sessionsResponse = await fetch(`/api/sessions?userId=${data._id}`);
          if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            console.log('Sessions data:', sessionsData);
            setSessions(sessionsData);
            setAllUserSessions(sessionsData);
          }
        }

        // Initialize push notifications after user data is loaded
        await initializePushNotifications();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router]);

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
                          <div className="text-3xl font-bold text-white">{Math.round(metrics.D)}%</div>
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
                          <div className="text-3xl font-bold text-white">{Math.round(metrics.C)}%</div>
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
                          <div className="text-3xl font-bold text-white">{Math.round(metrics.T)}%</div>
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
              <h2 className="text-2xl font-bold text-white mb-6">Suggestions</h2>
              <div className="space-y-4">
                <p className="text-gray-300 text-md">
                  Based on your recent activity, here are some suggestions to improve your eye health:
                </p>
                <ul className="list-disc list-inside text-gray-300 text-md space-y-2">
                  <li>Consider taking more frequent breaks to reduce eye strain</li>
                  <li>Maintain an optimal viewing distance of 50-100 cm from your screen</li>
                  <li>Ensure proper lighting in your workspace to minimize glare</li>
                  <li>Practice the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds</li>
                </ul>
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </>
  );
}
