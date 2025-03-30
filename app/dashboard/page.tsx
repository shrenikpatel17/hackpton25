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
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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

            <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl mb-8">
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
              <Bar data={chartData} options={chartOptions} />
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