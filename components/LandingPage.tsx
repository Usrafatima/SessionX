"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Target,
  Bell,
  Smartphone,
  ArrowRight,
  Download,
  Menu,
  X,
  Send,
  Linkedin,
  Github
} from "lucide-react";

// --- PWA BeforeInstallPrompt Event Type ---
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// --- Dotted World Map SVG Component (Hydration Safe - No SMIL animate tags) ---
function DottedWorldMap() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-35 pointer-events-none"
      viewBox="0 0 1000 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      
    >
      <defs>
        <pattern id="dot-pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#8A8A8A" fillOpacity="0.4" />
        </pattern>
        <radialGradient id="orange-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FF8A00" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* World map background grid fill */}
      <rect width="1000" height="500" fill="url(#dot-pattern)" />

      {/* Major Financial Hub Glows & Nodes */}
      {/* New York */}
      <g transform="translate(250, 160)">
        <circle r="24" fill="url(#orange-glow)" />
        <circle r="4" fill="#FF8A00" />
        <circle r="10" fill="none" stroke="#FF8A00" strokeWidth="1" className="opacity-60" />
        <text x="10" y="4" className="fill-[#F5F5F5] font-mono text-[10px] font-semibold">NEW YORK</text>
      </g>

      {/* London */}
      <g transform="translate(480, 120)">
        <circle r="24" fill="url(#orange-glow)" />
        <circle r="4" fill="#FF8A00" />
        <circle r="10" fill="none" stroke="#FF8A00" strokeWidth="1" className="opacity-60" />
        <text x="10" y="4" className="fill-[#F5F5F5] font-mono text-[10px] font-semibold">LONDON</text>
      </g>

      {/* Tokyo */}
      <g transform="translate(820, 170)">
        <circle r="24" fill="url(#orange-glow)" />
        <circle r="4" fill="#FF8A00" />
        <circle r="10" fill="none" stroke="#FF8A00" strokeWidth="1" className="opacity-60" />
        <text x="10" y="4" className="fill-[#F5F5F5] font-mono text-[10px] font-semibold">TOKYO</text>
      </g>

      {/* Sydney */}
      <g transform="translate(860, 370)">
        <circle r="20" fill="url(#orange-glow)" />
        <circle r="4" fill="#FF8A00" />
        <circle r="10" fill="none" stroke="#FF8A00" strokeWidth="1" className="opacity-60" />
        <text x="10" y="4" className="fill-[#F5F5F5] font-mono text-[10px] font-semibold">SYDNEY</text>
      </g>

      {/* Connecting Flow Lines */}
      <path
        d="M 250 160 Q 365 110 480 120 T 820 170"
        fill="none"
        stroke="#FF8A00"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        className="opacity-30"
      />
    </svg>
  );
}

// --- Dotted Globe SVG Component for Second Section ---
function DottedGlobe() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#050505" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="250" cy="250" r="200" fill="url(#globe-glow)" />

      {/* Concentric latitude & longitude rings */}
      <circle cx="250" cy="250" r="180" stroke="#FF8A00" strokeWidth="1" strokeDasharray="3 6" className="opacity-40" />
      <circle cx="250" cy="250" r="130" stroke="#FF8A00" strokeWidth="1" strokeDasharray="2 5" className="opacity-30" />
      <circle cx="250" cy="250" r="70" stroke="#FF8A00" strokeWidth="1" strokeDasharray="2 4" className="opacity-25" />

      <ellipse cx="250" cy="250" rx="180" ry="60" stroke="#FF8A00" strokeWidth="1" strokeDasharray="4 6" className="opacity-35" />
      <ellipse cx="250" cy="250" rx="180" ry="120" stroke="#FF8A00" strokeWidth="1" strokeDasharray="4 6" className="opacity-25" />
      <ellipse cx="250" cy="250" rx="60" ry="180" stroke="#FF8A00" strokeWidth="1" strokeDasharray="4 6" className="opacity-35" />
      <ellipse cx="250" cy="250" rx="120" ry="180" stroke="#FF8A00" strokeWidth="1" strokeDasharray="4 6" className="opacity-25" />
    </svg>
  );
}

// --- Smartphone Mockup Container Component ---
function PhoneMockup({
  src,
  alt,
  rotate = 0,
  scale = 1,
  className = "",
  type = "main"
}: {
  src: string;
  alt: string;
  rotate?: number;
  scale?: number;
  className?: string;
  type?: "main" | "secondary" | "alerts";
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative transition-transform duration-500 ease-out ${className}`}
      style={{
        transform: `rotate(${rotate}deg) scale(${scale})`
      }}
    >
      {/* Ambient Orange Glow behind phone */}
      <div className="absolute -inset-4 rounded-[50px] bg-gradient-to-b from-[#FF8A00]/25 via-[#FF8A00]/10 to-transparent blur-2xl opacity-80 pointer-events-none" />

      {/* Smartphone Outer Body Frame */}
      <div className="relative w-[280px] sm:w-[310px] h-[570px] sm:h-[620px] bg-[#0d0d0d] rounded-[44px] p-3 border-[6px] border-[#242424] shadow-[0_25px_70px_rgba(0,0,0,0.95)] ring-1 ring-white/10 overflow-hidden flex flex-col justify-between">
        {/* Top Speaker / Dynamic Island Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-24 h-4 bg-[#050505] rounded-full flex items-center justify-center gap-2 border border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#111] border border-white/10" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#111]" />
        </div>

        {/* Screen Container */}
        <div className="relative w-full h-full bg-[#050505] rounded-[34px] overflow-hidden flex flex-col pt-8">
          {!imgError ? (
            <img
              src={src}
              alt={alt}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            /* Fallback Clean UI Representation if exact custom image file is not found */
            <div className="w-full h-full bg-[#050505] text-[#F5F5F5] p-4 flex flex-col justify-between font-sans text-xs">
              {/* Header inside phone */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#FF8A00] animate-pulse" />
                  <span className="font-bold tracking-wide text-xs">
                    SESSION<span className="text-[#FF8A00]">X</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#FF8A00]/20 text-[#FF8A00] text-[10px] font-mono">
                  LIVE
                </span>
              </div>

              {/* View Content depending on mock type */}
              {type === "alerts" ? (
                <div className="flex-1 my-3 space-y-2.5 overflow-hidden">
                  <div className="text-[11px] font-mono text-[#FF8A00] tracking-wider uppercase">
                    Upcoming Alerts
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#111] border border-[#FF8A00]/30 space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-white">
                      <span>🔔 NY Kill Zone Open</span>
                      <span className="text-[#FF8A00] font-mono">In 12m</span>
                    </div>
                    <p className="text-[10px] text-[#8A8A8A]">
                      High liquidity expected at New York Open.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#111] border border-white/10 space-y-1 opacity-90">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-white">
                      <span>🇬🇧 London Close</span>
                      <span className="text-[#8A8A8A] font-mono">In 1h 45m</span>
                    </div>
                    <p className="text-[10px] text-[#8A8A8A]">
                      London session closing window.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#111] border border-white/10 space-y-1 opacity-75">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-white">
                      <span>⚡ Daily High Volatility</span>
                      <span className="text-[#8A8A8A] font-mono">In 3h</span>
                    </div>
                    <p className="text-[10px] text-[#8A8A8A]">
                      FOMC Announcement Window.
                    </p>
                  </div>
                </div>
              ) : type === "secondary" ? (
                <div className="flex-1 my-3 space-y-2.5 overflow-hidden">
                  <div className="text-[11px] font-mono text-[#FF8A00] tracking-wider uppercase">
                    Kill Zones
                  </div>
                  <div className="p-3 rounded-xl bg-[#111] border border-[#FF8A00]/40">
                    <div className="flex justify-between items-center font-bold text-white text-xs">
                      <span>London Open KZ</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#FF8A00]/20 text-[#FF8A00] text-[9px]">
                        ACTIVE
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-[#8A8A8A]">
                      07:00 - 10:00 UTC
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#111] border border-white/10">
                    <div className="flex justify-between items-center font-bold text-white text-xs">
                      <span>NY AM KZ</span>
                      <span className="text-[#8A8A8A] text-[9px]">UPCOMING</span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-[#8A8A8A]">
                      12:00 - 15:00 UTC
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 my-3 space-y-2.5 overflow-hidden">
                  <div className="text-[11px] font-mono text-[#FF8A00] tracking-wider uppercase">
                    Active Sessions
                  </div>
                  <div className="p-3 rounded-xl bg-[#111] border border-[#FF8A00]/40 space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#FF8A00]" />
                        New York Session
                      </span>
                      <span className="text-[#FF8A00] font-mono">OPEN</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#FF8A00] h-full w-[65%]" />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8A8A8A] font-mono pt-1">
                      <span>08:00 EST</span>
                      <span>17:00 EST</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#111] border border-white/10 space-y-1.5 opacity-80">
                    <div className="flex justify-between items-center text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        London Session
                      </span>
                      <span className="text-emerald-400 font-mono">OPEN</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full w-[85%]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Nav Bar inside phone */}
              <div className="pt-2 border-t border-white/10 flex justify-around text-[#8A8A8A]">
                <div className="flex flex-col items-center gap-0.5 text-[#FF8A00]">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Sessions</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Kill Zones</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Bell className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Alerts</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Home Bar Handle at bottom of phone */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
}

// --- Main LandingPage Component ---
export function LandingPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [emailInput, setEmailInput] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);


  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      window.location.href = "/dashboard";
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setSubscribed(true);
      setEmailInput("");
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#030405] text-white font-sans antialiased selection:bg-[#FF8A00] selection:text-black">
      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-1">
            <span className="text-2xl font-bold tracking-tight text-white">
              SESSION<span className="text-[#FF8A00]">X</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#8A8A8A]">
            <a href="#features" className="hover:text-[#F5F5F5] transition-colors">
              Features
            </a>
            <a href="#markets" className="hover:text-[#F5F5F5] transition-colors">
              Markets
            </a>
            <a href="#kill-zones" className="hover:text-[#F5F5F5] transition-colors">
              Kill Zones
            </a>
            <a href="#alerts" className="hover:text-[#F5F5F5] transition-colors">
              Alerts
            </a>
            <a href="#about" className="hover:text-[#F5F5F5] transition-colors">
              About
            </a>
          </nav>

          {/* Right Action: Launch App Button */}
          <div className="hidden md:flex items-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-[#FF8A00] bg-transparent px-5 py-2 text-sm font-semibold text-[#FF8A00] transition-all hover:bg-[#FF8A00] hover:text-black shadow-[0_0_15px_rgba(255,138,0,0.2)] focus:outline-none focus:ring-2 focus:ring-[#FF8A00]"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="md:hidden p-2 text-[#8A8A8A] hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-b border-white/10 bg-[#050505] px-5 py-6 space-y-4 overflow-hidden"
            >
              <div className="flex flex-col space-y-3 font-medium text-[#8A8A8A]">
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white"
                >
                  Features
                </a>
                <a
                  href="#markets"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white"
                >
                  Markets
                </a>
                <a
                  href="#kill-zones"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white"
                >
                  Kill Zones
                </a>
                <a
                  href="#alerts"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white"
                >
                  Alerts
                </a>
                <a
                  href="#about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white"
                >
                  About
                </a>
              </div>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex justify-center items-center gap-2 rounded-full border border-[#FF8A00] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#FF8A00] hover:bg-[#FF8A00] hover:text-black"
                >
                  Launch App
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* HERO SECTION */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center py-16 lg:py-24 overflow-hidden border-b border-white/5">
        {/* Background Dotted World Map */}
        <DottedWorldMap />

        <div className="relative z-10 max-w-7xl mx-auto px-5 lg:px-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* LEFT COLUMN */}
            <motion.div
              initial={isMounted ? { opacity: 0, x: -20 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6 max-w-2xl"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#FF8A00]/40 bg-[#FF8A00]/10 text-[#FF8A00] text-xs font-mono font-medium tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8A00] animate-pulse" />
                GLOBAL MARKETS. SMARTER ALERTS.
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#F5F5F5] leading-[1.08]">
                Never Miss a{" "}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#FF8A00] to-[#FF9F1C]">
                  Market Moment
                </span>
              </h1>

              {/* Description */}
              <p className="text-[#8A8A8A] text-base sm:text-lg leading-relaxed font-normal">
                SessionX keeps you in sync with global market sessions, ICT Kill Zones,
                and important market events — so you always know what's happening and what's next.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FF8A00] px-6 py-3.5 text-base font-semibold text-black transition-all hover:bg-[#FF9F1C] shadow-[0_0_30px_rgba(255,138,0,0.3)] hover:scale-[1.02] focus:outline-none"
                >
                  Open SessionX
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <button
                  onClick={handleInstallClick}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-semibold text-[#F5F5F5] transition-all hover:border-[#FF8A00]/60 hover:bg-[#FF8A00]/10 hover:text-white"
                >
                  Install App
                  <Download className="h-5 w-5 text-[#FF8A00]" />
                </button>
              </div>

              {/* Social Proof */}
              <div className="pt-4 flex items-center gap-3 text-sm text-[#8A8A8A]">
                <div className="flex text-[#FF9F1C] tracking-tight">
                  ★★★★★
                </div>
                <span className="w-1 h-1 rounded-full bg-[#8A8A8A]" />
                <span className="font-medium">Trusted by traders worldwide</span>
              </div>
            </motion.div>

            {/* RIGHT COLUMN: Overlapping Real Smartphone Mockups */}
            <motion.div
              initial={isMounted ? { opacity: 0, scale: 0.95 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative flex justify-center items-center pt-8 lg:pt-0"
            >
              {/* Ambient Orange Glow behind phones */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-b from-[#FF8A00]/25 via-[#FF8A00]/10 to-transparent blur-3xl opacity-80 pointer-events-none" />

              <div className="relative w-full max-w-[540px] flex items-center justify-center py-4">
  {/* mockupone - slightly behind, left */}
  <motion.div
    animate={isMounted ? { y: [0, -8, 0] } : undefined}
    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    className="relative z-10 -mr-10 sm:-mr-16 transform -rotate-3 scale-[1.08] origin-bottom-right"
  >
    <img
      src="/images/mockupone.png"
      alt="SessionX Smartphone Mockup 1"
      className="w-[260px] sm:w-[350px] md:w-[380px] h-auto object-contain"
    />
  </motion.div>


                {/* mockuptwo.jpg (Slightly in front, right) */}
                {/* <motion.div
                  animate={isMounted ? { y: [0, -12, 0] } : undefined}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="relative z-20 transform rotate-3 scale-100 origin-bottom-left"
                >
                  <div className="relative rounded-[32px] overflow-hidden border-[4px] border-[#242424] shadow-[0_25px_60px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
                    <img
                      src="/images/mockupone.png"
                      alt="SessionX Smartphone Mockup 2"
                      className="w-[200px] sm:w-[260px] md:w-[280px] h-auto object-contain rounded-[28px]"
                    />
                  </div>
                </motion.div> */}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP (FOUR ITEMS) */}
      <section id="features" className="py-16 bg-[#050505] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#FF8A00]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/10 border border-[#FF8A00]/30 flex items-center justify-center text-[#FF8A00] mb-5 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F5F5] mb-2">
                Global Market Sessions
              </h3>
              <p className="text-sm text-[#8A8A8A] leading-relaxed">
                Real-time status of major market sessions with DST-aware timing.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#FF8A00]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/10 border border-[#FF8A00]/30 flex items-center justify-center text-[#FF8A00] mb-5 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F5F5] mb-2">
                ICT Kill Zones
              </h3>
              <p className="text-sm text-[#8A8A8A] leading-relaxed">
                Track important trading windows based on ICT concepts.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#FF8A00]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/10 border border-[#FF8A00]/30 flex items-center justify-center text-[#FF8A00] mb-5 group-hover:scale-110 transition-transform">
                <Bell className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F5F5] mb-2">
                Smart Alerts
              </h3>
              <p className="text-sm text-[#8A8A8A] leading-relaxed">
                Get notified about opens, closes, Kill Zones, and important market events.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#FF8A00]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/10 border border-[#FF8A00]/30 flex items-center justify-center text-[#FF8A00] mb-5 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F5F5] mb-2">
                Works Everywhere
              </h3>
              <p className="text-sm text-[#8A8A8A] leading-relaxed">
                Install SessionX as a PWA and stay updated on any device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MARKETS & KILL ZONES HIGHLIGHT SECTION */}
      <section id="markets" className="py-20 bg-[#050505] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#FF8A00] text-xs font-mono font-bold tracking-widest uppercase">
              GLOBAL COVERAGE
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#F5F5F5] mt-3">
              Track Every Major Trading Hub
            </h2>
            <p className="text-[#8A8A8A] mt-3 text-base">
              Synchronized DST-adjusted session tracking across Sydney, Tokyo, London, and New York.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                city: "Sydney",
                flag: "🇦🇺",
                code: "SYD",
                desc: "Pacific liquidity window opening the trading week."
              },
              {
                city: "Tokyo",
                flag: "🇯🇵",
                code: "TYO",
                desc: "Asian session volume anchor & JPY pairs dominance."
              },
              {
                city: "London",
                flag: "🇬🇧",
                code: "LDN",
                desc: "Peak forex volume & institutional liquidity hub."
              },
              {
                city: "New York",
                flag: "🇺🇸",
                code: "NYC",
                desc: "Highest volatility overlap & US equities opening."
              }
            ].map((market) => (
              <div
                key={market.city}
                className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#FF8A00]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{market.flag}</span>
                    <span className="px-2.5 py-1 rounded bg-[#FF8A00]/10 text-[#FF8A00] font-mono text-xs font-semibold">
                      {market.code}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#F5F5F5] mb-2">{market.city}</h3>
                  <p className="text-sm text-[#8A8A8A] leading-relaxed">{market.desc}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-[#8A8A8A] font-mono">
                  <span>DST Aware</span>
                  <span className="text-[#FF8A00]">Active Timing</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KILL ZONES SECTION */}
      <section id="kill-zones" className="py-20 bg-[#050505] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <div className="p-8 sm:p-12 rounded-3xl bg-[#111111] border border-white/10 relative overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-5">
                <span className="text-[#FF8A00] text-xs font-mono font-bold tracking-widest uppercase">
                  ICT TIMING ENGINE
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
                  Precision ICT Kill Zones
                </h2>
                <p className="text-[#8A8A8A] leading-relaxed text-base">
                  Never miss crucial liquidity sweeps and algorithm expansion windows.
                  SessionX highlights London Open, Asian Range, New York AM, and New York PM Kill Zones in real time.
                </p>
                <ul className="space-y-3 pt-2">
                  {[
                    "Asian Kill Zone (20:00 - 00:00 EST)",
                    "London Open Kill Zone (02:00 - 05:00 EST)",
                    "New York AM Kill Zone (07:00 - 10:00 EST)",
                    "London Close Kill Zone (10:00 - 12:00 EST)"
                  ].map((kz) => (
                    <li key={kz} className="flex items-center gap-3 text-sm text-[#F5F5F5]">
                      <div className="w-5 h-5 rounded-full bg-[#FF8A00]/20 text-[#FF8A00] flex items-center justify-center text-xs font-bold shrink-0">
                        ✓
                      </div>
                      <span className="font-mono">{kz}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-[#050505] border border-[#FF8A00]/30 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-mono text-[#FF8A00] uppercase tracking-wider">
                    Live ICT Window Status
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    MONITORED
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#111111] border border-[#FF8A00]/40 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold text-white">NY AM Kill Zone</div>
                      <div className="text-xs text-[#8A8A8A] font-mono">07:00 - 10:00 EST</div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-[#FF8A00]/20 text-[#FF8A00] font-mono text-xs font-semibold">
                      IN RANGE
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#111111] border border-white/5 flex justify-between items-center opacity-75">
                    <div>
                      <div className="text-sm font-bold text-white">London Close KZ</div>
                      <div className="text-xs text-[#8A8A8A] font-mono">10:00 - 12:00 EST</div>
                    </div>
                    <span className="text-xs text-[#8A8A8A] font-mono">UPCOMING</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/dashboard"
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-[#FF8A00]/10 text-xs font-mono text-[#FF8A00] border border-[#FF8A00]/30 flex justify-center items-center gap-2 transition"
                  >
                    View All Kill Zone Timers in Dashboard →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECOND SECTION ("Why SessionX") */}
      <section id="about" className="py-20 lg:py-28 bg-[#050505] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* LEFT COLUMN: Smartphone Mockup with Globe */}
            <div className="relative flex justify-center items-center">
              <DottedGlobe />
              <div className="relative z-10">
              <div className="relative max-w-[300px] sm:max-w-[340px] md:max-w-[380px]">
  <img
    src="/images/mockuptwo.png"
    alt="SessionX Phone Mockup Showing Upcoming Alerts"
    className="w-[240px] sm:w-[320px] md:w-[350px] h-auto object-contain"
  />

                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Content */}
            <div className="space-y-6">
              {/* Badge */}
              <span className="text-[#FF8A00] text-xs font-mono font-bold tracking-widest uppercase">
                WHY SESSIONX
              </span>

              {/* Heading */}
              <h2 className="text-3xl sm:text-5xl font-bold text-[#F5F5F5] tracking-tight">
                Built for{" "}
                <span className="text-[#FF8A00]">Focused Traders</span>
              </h2>

              {/* Description */}
              <p className="text-[#8A8A8A] text-lg leading-relaxed font-normal">
                We remove the noise and give you only what matters. Simple. Fast. Reliable.
              </p>

              {/* Three Benefits List */}
              <div className="space-y-6 pt-4">
                {/* Benefit 1 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FF8A00]/20 text-[#FF8A00] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F5F5F5]">
                      Clear market overview at a glance
                    </h3>
                    <p className="text-sm text-[#8A8A8A] mt-1 leading-relaxed">
                      Know what's open and what's next.
                    </p>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FF8A00]/20 text-[#FF8A00] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F5F5F5]">
                      Stay ahead with smart timing
                    </h3>
                    <p className="text-sm text-[#8A8A8A] mt-1 leading-relaxed">
                      Never miss an important market moment.
                    </p>
                  </div>
                </div>

                {/* Benefit 3 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FF8A00]/20 text-[#FF8A00] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F5F5F5]">
                      Designed for speed
                    </h3>
                    <p className="text-sm text-[#8A8A8A] mt-1 leading-relaxed">
                      Clean, minimal, and distraction-free.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NOTIFICATION CTA SECTION */}
      <section id="alerts" className="py-20 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <div className="relative rounded-3xl bg-[#111111] border border-[#FF8A00]/40 p-8 sm:p-14 overflow-hidden shadow-[0_0_60px_rgba(255,138,0,0.12)]">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF8A00]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-4 text-center">
              <h2 className="text-3xl sm:text-5xl font-bold text-[#F5F5F5] tracking-tight">
                Stay ahead of the markets.
              </h2>
              <p className="text-[#8A8A8A] text-base sm:text-lg leading-relaxed">
                Enable notifications and never miss an important market moment.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FF8A00] px-7 py-4 text-base font-semibold text-black transition-all hover:bg-[#FF9F1C] hover:scale-[1.02] shadow-[0_0_25px_rgba(255,138,0,0.3)]"
                >
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#050505] border-t border-white/10 pt-16 pb-12 text-sm text-[#8A8A8A]">
        <div className="max-w-7xl mx-auto px-5 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
            {/* Brand Column */}
            <div className="lg:col-span-2 space-y-4">
              <Link href="/" className="inline-block">
                <span className="text-2xl font-bold tracking-tight text-white">
                  SESSION<span className="text-[#FF8A00]">X</span>
                </span>
              </Link>
              <p className="text-[#8A8A8A] max-w-sm leading-relaxed text-sm">
                SessionX is a market session tracker for traders. Stay informed. Stay ahead.
              </p>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-bold text-[#F5F5F5] uppercase tracking-wider text-xs mb-4">
                Product
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#markets" className="hover:text-white transition-colors">
                    Markets
                  </a>
                </li>
                <li>
                  <a href="#kill-zones" className="hover:text-white transition-colors">
                    Kill Zones
                  </a>
                </li>
                <li>
                  <a href="#alerts" className="hover:text-white transition-colors">
                    Alerts
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-bold text-[#F5F5F5] uppercase tracking-wider text-xs mb-4">
                Company
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#about" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <span className="hover:text-white cursor-pointer transition-colors">
                    Privacy Policy
                  </span>
                </li>
                <li>
                  <span className="hover:text-white cursor-pointer transition-colors">
                    Terms of Service
                  </span>
                </li>
                <li>
                  <span className="hover:text-white cursor-pointer transition-colors">
                    Contact
                  </span>
                </li>
              </ul>
            </div>

            {/* Stay Connected Column */}
            <div>
              <h4 className="font-bold text-[#F5F5F5] uppercase tracking-wider text-xs mb-4">
                Stay Connected
              </h4>
              <p className="text-xs text-[#8A8A8A] mb-3 leading-relaxed">
                Receive weekly market timing updates and ICT session insights.
              </p>
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#8A8A8A] focus:outline-none focus:border-[#FF8A00] transition"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe to updates"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#FF8A00] text-black hover:bg-[#FF9F1C] transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                {subscribed && (
                  <p className="text-xs text-emerald-400">
                    Subscribed successfully!
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[#8A8A8A]">
            <p>© 2026 SessionX. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.linkedin.com/in/yusra-fatima-245967366/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SessionX on LinkedIn"
                className="inline-flex items-center gap-2 rounded-lg border border-[#222222] bg-[#0A0A0A] px-3 py-2 text-[#8A8A8A] transition hover:border-[#FF8A00]/40 hover:text-[#FF9F1C]"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
              <a
                href="https://github.com/Usrafatima"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SessionX on GitHub"
                className="inline-flex items-center gap-2 rounded-lg border border-[#222222] bg-[#0A0A0A] px-3 py-2 text-[#8A8A8A] transition hover:border-[#FF8A00]/40 hover:text-[#FF9F1C]"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </div>
            <p className="font-mono">Global Market Utility</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
