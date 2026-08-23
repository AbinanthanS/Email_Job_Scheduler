import React from 'react';
import { QueueStats } from '../types';
import { X, Activity, Server, Clock, Flame, ShieldCheck, Database, RefreshCw } from 'lucide-react';

interface QueueHealthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stats: QueueStats | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const QueueHealthDrawer: React.FC<QueueHealthDrawerProps> = ({
  isOpen,
  onClose,
  stats,
  onRefresh,
  isRefreshing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Queue Engine & Rate Limiter Health</h2>
              <p className="text-xs text-gray-400">Real-time BullMQ Redis status & distributed throttling monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              title="Refresh engine state"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Engine Status Summary */}
          <div className="p-4 rounded-2xl bg-gray-850/60 border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <span className="text-sm font-bold text-white">BullMQ Worker Pool Active</span>
                <p className="text-xs text-gray-400">Persistent Redis Sorted-Set Delayed Queue</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              Operational
            </span>
          </div>

          {/* BullMQ Queue Counters */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-brand-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">BullMQ Redis Queue Metrics</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-xs text-gray-400">Waiting</div>
                <div className="text-lg font-bold text-white mt-1">{stats?.queue.waiting ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-xs text-amber-400 font-medium">Active</div>
                <div className="text-lg font-bold text-amber-400 mt-1">{stats?.queue.active ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-xs text-blue-400 font-medium">Delayed</div>
                <div className="text-lg font-bold text-blue-400 mt-1">{stats?.queue.delayed ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-xs text-emerald-400 font-medium">Completed</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">{stats?.queue.completed ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-xs text-rose-400 font-medium">Failed</div>
                <div className="text-lg font-bold text-rose-400 mt-1">{stats?.queue.failed ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Distributed Rate Limiter State */}
          <div className="p-4 rounded-2xl bg-gray-850/60 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Hourly Rate Limiter Status
                </h3>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                Key: ratelimit:sender:{stats?.rateLimit.sender || 'default'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-[11px] text-gray-400">Used This Hour</div>
                <div className="text-lg font-bold text-white mt-1">{stats?.rateLimit.usedThisHour ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-[11px] text-gray-400">Hourly Capacity</div>
                <div className="text-lg font-bold text-white mt-1">{stats?.rateLimit.maxPerHour ?? 200}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700/60">
                <div className="text-[11px] text-gray-400">Remaining Quota</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {stats?.rateLimit.remainingThisHour ?? 200}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              💡 <strong>Behavior Under Load:</strong> When the hourly quota is reached, BullMQ workers automatically calculate the millisecond offset to the next hour window and reschedule overflow jobs without failing or dropping requests.
            </p>
          </div>

          {/* Database Totals */}
          <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-4">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-brand-400" />
              <span>PostgreSQL Persistent Records:</span>
            </span>
            <span className="text-gray-200 font-mono font-semibold">
              {stats?.db.total ?? 0} total email jobs tracked
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/80 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-750 text-white text-xs font-semibold border border-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
