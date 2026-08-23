import React from 'react';
import { QueueStats } from '../types';
import { Clock, CheckCircle2, ShieldAlert, Cpu, Flame } from 'lucide-react';

interface StatCardsProps {
  stats: QueueStats | null;
  loading: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, loading }) => {
  const scheduledCount = stats?.db.scheduled ?? 0;
  const sentCount = stats?.db.sent ?? 0;
  const failedCount = stats?.db.failed ?? 0;
  const rateLimitUsed = stats?.rateLimit.usedThisHour ?? 0;
  const rateLimitMax = stats?.rateLimit.maxPerHour ?? 200;
  const rateLimitRemaining = Math.max(0, rateLimitMax - rateLimitUsed);
  const rateLimitPercentage = Math.min(100, Math.round((rateLimitUsed / (rateLimitMax || 1)) * 100));

  const activeWorkerJobs = stats?.queue.active ?? 0;
  const delayedBullJobs = stats?.queue.delayed ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Scheduled Emails Card */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-brand-500/40 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Queue</span>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {loading && !stats ? (
            <div className="h-8 w-20 bg-gray-800 animate-pulse rounded-lg" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{scheduledCount}</div>
          )}
          <span className="text-xs text-blue-400 font-medium">jobs pending</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-800/80 pt-2.5">
          <span>Delayed in BullMQ:</span>
          <span className="font-mono text-gray-300 font-semibold">{delayedBullJobs}</span>
        </div>
      </div>

      {/* 2. Sent Emails Card */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sent & Delivered</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {loading && !stats ? (
            <div className="h-8 w-20 bg-gray-800 animate-pulse rounded-lg" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{sentCount}</div>
          )}
          <span className="text-xs text-emerald-400 font-medium">dispatched</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-800/80 pt-2.5">
          <span>Failed / Errors:</span>
          <span className={`font-mono font-semibold ${failedCount > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
            {failedCount}
          </span>
        </div>
      </div>

      {/* 3. Rate Limit Quota Card */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hourly Rate Limit</span>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {loading && !stats ? (
            <div className="h-8 w-20 bg-gray-800 animate-pulse rounded-lg" />
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {rateLimitUsed}
              <span className="text-sm font-normal text-gray-400">/{rateLimitMax}</span>
            </div>
          )}
          <span className="text-xs text-amber-400 font-medium">{rateLimitRemaining} left</span>
        </div>
        {/* Rate limit progress bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                rateLimitPercentage > 85 ? 'bg-rose-500' : rateLimitPercentage > 60 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${rateLimitPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Concurrency & Worker Engine Card */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">BullMQ Worker</span>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Active</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-800/80 pt-2.5">
          <span>Active In-Flight:</span>
          <span className="font-mono text-emerald-400 font-semibold">{activeWorkerJobs}</span>
        </div>
      </div>
    </div>
  );
};
