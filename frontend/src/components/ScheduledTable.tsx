import React, { useState } from 'react';
import { EmailJob } from '../types';
import { Clock, Search, XCircle, AlertCircle, RefreshCw, Calendar, Mail, AlertTriangle } from 'lucide-react';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  onCancel: (id: string) => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  cancellingId: string | null;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancel,
  onSearch,
  onRefresh,
  cancellingId,
}) => {
  const [searchVal, setSearchVal] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
    onSearch(e.target.value);
  };

  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();

    const formatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    if (diffMs > 0) {
      const mins = Math.ceil(diffMs / 60000);
      const relative = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
      return {
        display: `${dateFormatted} at ${formatted}`,
        relative: `in ${relative}`,
        isFuture: true,
      };
    } else {
      return {
        display: `${dateFormatted} at ${formatted}`,
        relative: 'Queued for dispatch',
        isFuture: false,
      };
    }
  };

  const getStatusBadge = (status: string, rateLimitDate?: string | null) => {
    switch (status) {
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Processing
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span
            title={rateLimitDate ? `Delayed by rate limiter until ${new Date(rateLimitDate).toLocaleTimeString()}` : 'Rescheduled due to hourly rate limit'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"
          >
            <AlertTriangle className="w-3 h-3" />
            Rate Limit Delayed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden border border-gray-800 shadow-xl">
      {/* Table Toolbar */}
      <div className="p-5 border-b border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchVal}
              onChange={handleSearchChange}
              placeholder="Search by recipient or subject..."
              className="w-full pl-9 pr-4 py-2 bg-gray-850 border border-gray-700/80 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-400">
            Showing <span className="text-white font-semibold">{emails.length}</span> scheduled jobs
          </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/40 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <th className="py-3.5 px-6">Recipient</th>
              <th className="py-3.5 px-6">Subject</th>
              <th className="py-3.5 px-6">Scheduled Dispatch</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-xs">
            {loading && emails.length === 0 ? (
              // Loading Skeleton
              [...Array(4)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-6">
                    <div className="h-4 bg-gray-800 rounded w-36 mb-1" />
                    <div className="h-3 bg-gray-850 rounded w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-gray-800 rounded w-48" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-gray-800 rounded w-32" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-6 bg-gray-800 rounded-full w-24" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="h-8 bg-gray-800 rounded-xl w-16 ml-auto" />
                  </td>
                </tr>
              ))
            ) : emails.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-800/80 flex items-center justify-center text-gray-400 mb-3 border border-gray-700">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">No scheduled emails in queue</h3>
                    <p className="text-xs text-gray-400 mb-4">
                      All your delayed BullMQ email jobs will appear here before they are dispatched.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Rows
              emails.map((job) => {
                const timeInfo = formatScheduledTime(job.scheduledAt);
                return (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-800/40 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-100 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                        <span>{job.recipient}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">From: {job.senderEmail}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-200 max-w-xs truncate" title={job.subject}>
                        {job.subject}
                      </div>
                      <div className="text-[11px] text-gray-500 max-w-xs truncate">{job.body}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-mono text-gray-200 text-[11px]">{timeInfo.display}</div>
                      <div className="text-[10px] text-brand-400 font-semibold mt-0.5">{timeInfo.relative}</div>
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(job.status, job.rateLimitDelayedUntil)}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onCancel(job.id)}
                        disabled={cancellingId === job.id || job.status === 'PROCESSING'}
                        title="Cancel this scheduled job"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/60 transition-all disabled:opacity-40"
                      >
                        {cancellingId === job.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Cancel</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
