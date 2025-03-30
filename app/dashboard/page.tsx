'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        } catch (error) {
            console.error('Error initializing push notifications:', error);
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
          const sessionsResponse = await fetch('/api/sessions');
          if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            setSessions(sessionsData);
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
          <div className="w-full max-w-4xl">
            <h1 className="text-5xl font-Raleway font-[400] text-white font-bold mb-8 leading-tight">
              Welcome, {user.firstName}!
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl">
                <h2 className="text-2xl font-bold text-white mb-4">Your Stats</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-300">Blink Rate</p>
                    <p className="text-white text-2xl">{user.blinkRate} blinks/min</p>
                  </div>
                  <div>
                    <p className="text-gray-300">Look Away Rate</p>
                    <p className="text-white text-2xl">{user.lookAwayRate} times/hour</p>
                  </div>
                  <div>
                    <p className="text-gray-300">Move Back Rate</p>
                    <p className="text-white text-2xl">{user.moveBackRate} times/hour</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl">
                <h2 className="text-2xl font-bold text-white mb-4">Account Info</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-300">Email</p>
                    <p className="text-white">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-300">Member Since</p>
                    <p className="text-white">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300">Total Sessions</p>
                    <p className="text-white">{user.sessions.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-4">Recent Sessions</h2>
              {sessions.length > 0 ? (
                <div className="space-y-4">
                  {sessions.slice(0, 5).map((session, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">
                            Session {sessions.length - index}
                          </p>
                          <p className="text-gray-300 text-sm">
                            {new Date(session.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">
                            {new Date(session.timeStart).toLocaleTimeString()} - 
                            {new Date(session.timeEnd).toLocaleTimeString()}
                          </p>
                          <p className="text-gray-300 text-sm">
                            Blink Rate: {session.blinkRate} blinks/min
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-300">No sessions recorded yet. Start using the webcam feature to track your eye health!</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
