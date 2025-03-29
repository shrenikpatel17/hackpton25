'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      // Successful signup
      router.push('/login');
    } catch (err: any) {
      setError(err.message);
    }
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
            <Link href="/">
              <button className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors">
                Back to Home
              </button>
            </Link>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-[#111E3B] flex flex-col items-center justify-center px-24">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Create an Account</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-100 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-6 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Sign Up
            </button>

            <p className="mt-4 text-center text-gray-300">
              Already have an account?{' '}
              <Link href="/login" className="text-white hover:underline">
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
} 