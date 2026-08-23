import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Mail, Zap, ShieldCheck, Clock, Server, ArrowRight, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithDemo } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      await loginWithGoogle(credentialResponse.credential);
    }
  };

  const handleDemoSignIn = async () => {
    setIsDemoLoading(true);
    await loginWithDemo({
      name: 'Alex Johnson',
      email: 'alex.johnson@reachinbox.ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });
    setIsDemoLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-600/20 via-indigo-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-2xl shadow-brand-500/30 mb-4 ring-8 ring-brand-500/10 animate-fade-in">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ReachInbox <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">Scheduler</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            High-Throughput Persistent Email Job Dispatcher with Distributed Rate Limiting
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-gray-800 shadow-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-base font-bold text-white">Sign In to Dashboard</h2>
            <p className="text-xs text-gray-400 mt-1">Authenticate with your Google account to manage campaigns</p>
          </div>

          {/* Google OAuth Login Button */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="w-full flex justify-center scale-105">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  console.error('Google Sign In failed');
                }}
                theme="filled_black"
                shape="pill"
                size="large"
                width="320"
                text="continue_with"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-gray-800 w-full" />
            <span className="bg-gray-900 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-widest absolute">
              or
            </span>
          </div>

          {/* 1-Click Demo Login */}
          <button
            onClick={handleDemoSignIn}
            disabled={isDemoLoading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-gray-800 hover:bg-gray-750 text-gray-200 hover:text-white text-xs sm:text-sm font-semibold border border-gray-700 transition-all shadow-md active:scale-98"
          >
            {isDemoLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>1-Click Demo Sign In</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-400" />
              </>
            )}
          </button>

          {/* Feature Badges */}
          <div className="pt-4 border-t border-gray-800/80 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-brand-400" />
              <span>BullMQ + Redis</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>No Cron Jobs</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Atomic Hourly Limit</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Crash-Resilient</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-gray-500 mt-6">
          Powered by ReachInbox Engineering Architecture
        </div>
      </div>
    </div>
  );
};
