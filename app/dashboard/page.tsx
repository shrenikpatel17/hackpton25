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