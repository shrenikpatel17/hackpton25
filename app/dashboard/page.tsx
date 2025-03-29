'use client';

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-8" 
            style={{
              color: '#ff61e6',
              textShadow: '0 0 10px #ff61e6, 0 0 20px #ff61e6',
              fontFamily: "'Press Start 2P', cursive"
            }}>
          Eye Health Dashboard
        </h1>
        
        <div className="bg-opacity-20 bg-black p-8 rounded-xl mb-8"
             style={{
               border: '3px solid #00ff88',
               boxShadow: '0 0 15px #00ff88',
             }}>
          <p className="text-white text-xl mb-4">
            Coming soon: Your eye health statistics and recommendations will appear here!
          </p>
        </div>

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