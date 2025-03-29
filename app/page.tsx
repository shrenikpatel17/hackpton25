'use client';

import Link from "next/link";

export default function Home() {
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
              <nav className="ml-12 hidden md:flex items-center gap-16">
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
              <Link href="/signup" className="text-gray-300 mr-2 hover:text-white transition-colors">
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

      <div className="min-h-screen bg-[#111E3B] flex flex-col justify-center px-24 pt-26">
        <div className="max-w-3xl">
          <h1 className="text-7xl font-Raleway font-[400] text-white font-bold mb-8 leading-tight">
            Healthier vision starts here.
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl">
          Start your journey to better eye health with tools that help you track, manage, and improve your eyesight.
          </p>

          <div className="flex gap-4">
            <Link href="/signup">
              <button 
                className="px-6 py-3 bg-white text-black rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors">
                Start today
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m0 0l-5-5m5 5l-5 5"/>
                </svg>
              </button>
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}

