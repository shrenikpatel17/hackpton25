'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  sessions: any[];
  blinkRate: number;
  lookAwayRate: number;
  moveBackRate: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
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
              {user.sessions.length > 0 ? (
                <div className="space-y-4">
                  {user.sessions.slice(0, 5).map((session, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg">
                      <p className="text-white">Session {user.sessions.length - index}</p>
                      {/* Add more session details here once you have the data structure */}
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