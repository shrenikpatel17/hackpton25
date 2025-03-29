'use client';

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F1EAD1] flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl text-[#0e273c] font-bold mb-8 tracking-wider">
          Keep your eyes healthy
        </h1>
      </div>

      <div className="flex gap-8">
        <Link href="/webcam">
          <button 
            className="px-12 py-6 bg-[#1e40af]/70 text-2xl font-bold rounded-lg transition-all duration-300 ease-in-out hover:bg-[#1e40af]/80">
            Start
          </button>
        </Link>

        <Link href="/dashboard">
          <button 
            className="px-12 py-6 border-[#1e40af] border-2 text-2xl text-[#1e40af] font-bold rounded-lg transition-all duration-300 ease-in-out hover:bg-[white]/80">
            Dashboard
          </button>
        </Link>
      </div>
    </main>
  );
}

