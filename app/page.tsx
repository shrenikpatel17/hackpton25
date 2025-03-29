'use client';

import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="fixed top-2 left-8 right-8 rounded-xl bg-white/5 backdrop-blur-md z-50">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-white font-bold text-xl">
                optiq
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/features" className="text-gray-300 hover:text-white transition-colors">
                  Features
                </Link>
                <Link href="/resources" className="text-gray-300 hover:text-white transition-colors">
                  Resources
                </Link>
                <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
                  Pricing
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/signup" className="text-gray-300 hover:text-white transition-colors">
                Signup
              </Link>
              <Link href="/login">
                <button className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  Login
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-[#1C1C1C] flex flex-col justify-center p-24">
        <div className="max-w-3xl">
          <h1 className="text-7xl text-white font-bold mb-8 leading-tight">
            The intelligent terminal.
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl">
            Become a command line power user on day one. Warp combines AI and your dev team's knowledge in one fast, intuitive terminal.
          </p>

          <div className="flex gap-4">
            <Link href="/download">
              <button 
                className="px-6 py-3 bg-white text-black rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors">
                Download for Mac
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </Link>
          </div>

          <div className="mt-8 font-mono text-gray-400">
            <code>$ brew install --cask warp</code>
          </div>
        </div>
      </main>
    </>
  );
}

