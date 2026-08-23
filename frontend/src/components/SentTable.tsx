import React, { useState } from 'react';
import { EmailJob } from '../types';
import { CheckCircle2, XCircle, Search, ExternalLink, Mail, AlertCircle, Eye } from 'lucide-react';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
  onSearch: (query: string) => void;
  onRefresh: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ emails, loading, onSearch, onRefresh }) => {
  const [searchVal, setSearchVal] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
    onSearch(e.target.value);
  };

  const formatSentTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString(
      [],
      { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    )}`;
  };

  const getStatusBadge = (status: string, errorReason?: string | null) => {
    if (status === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sent
        </span>
      );
    } else {
      return (
        <span
          title={errorReason || 'SMTP Send Failed'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
        >
          <XCircle className="w-3.5 h-3.5" />
          Failed
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
              placeholder="Search sent emails by recipient or subject..."
              className="w-full pl-9 pr-4 py-2 bg-gray-850 border border-gray-700/80 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-400">
            Showing <span className="text-white font-semibold">{emails.length}</span> sent records
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
              <th className="py-3.5 px-6">Sent Time</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6 text-right">Ethereal Preview</th>
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
                    <div className="h-6 bg-gray-800 rounded-full w-20" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="h-8 bg-gray-800 rounded-xl w-24 ml-auto" />
                  </td>
                </tr>
              ))
            ) : emails.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-800/80 flex items-center justify-center text-gray-400 mb-3 border border-gray-700">
                      <Mail className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">No sent emails yet</h3>
                    <p className="text-xs text-gray-400 mb-4">
                      When scheduled jobs reach their delivery time, completed emails with Ethereal previews will be listed here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Rows
              emails.map((job) => (
                <tr key={job.id} className="hover:bg-gray-800/40 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-medium text-gray-100 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                    <div className="font-mono text-gray-300 text-[11px]">
                      {formatSentTime(job.executedAt || job.updatedAt)}
                    </div>
                  </td>
                  <td className="py-4 px-6">{getStatusBadge(job.status, job.errorReason)}</td>
                  <td className="py-4 px-6 text-right">
                    {job.etherealUrl ? (
                      <a
                        href={job.etherealUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 hover:text-brand-300 border border-brand-500/30 transition-all shadow-sm group-hover:border-brand-500/50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View in Ethereal</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-gray-500 italic">No preview URL</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
