'use client';

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F1EAD1] flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl text-[#bf3131] font-bold mb-8 tracking-wider">
          Keep your eyes healthy
        </h1>
      </div>

      <div className="flex gap-8">
        <Link href="/webcam">
          <button 
            className="px-12 py-6 text-2xl font-bold rounded-lg transition-all duration-300 ease-in-out"
            style={{
              background: 'linear-gradient(45deg, #00ff88, #00ffcc)',
              boxShadow: '0 0 15px #00ff88',
              color: '#1a1a1a',
              border: '3px solid #00ff88',
              transform: 'perspective(1000px) translateZ(0)',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'perspective(1000px) translateZ(20px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'perspective(1000px) translateZ(0)'}
          >
            Start
          </button>
        </Link>

        <Link href="/dashboard">
          <button 
            className="px-12 py-6 text-2xl font-bold rounded-lg transition-all duration-300 ease-in-out"
            style={{
              background: 'linear-gradient(45deg, #ff61e6, #ff8ae2)',
              boxShadow: '0 0 15px #ff61e6',
              color: '#1a1a1a',
              border: '3px solid #ff61e6',
              transform: 'perspective(1000px) translateZ(0)',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'perspective(1000px) translateZ(20px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'perspective(1000px) translateZ(0)'}
          >
            Dashboard
          </button>
        </Link>
      </div>
    </main>
  );
}
