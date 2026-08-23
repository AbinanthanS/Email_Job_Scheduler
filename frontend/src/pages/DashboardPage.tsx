import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { EmailJob, QueueStats } from '../types';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/Navbar';
import { StatCards } from '../components/StatCards';
import { ScheduledTable } from '../components/ScheduledTable';
import { SentTable } from '../components/SentTable';
import { ComposeModal } from '../components/ComposeModal';
import { QueueHealthDrawer } from '../components/QueueHealthDrawer';
import { Clock, Send, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { showToast } = useToast();

  // Active Tab: 'scheduled' | 'sent'
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isQueueHealthOpen, setIsQueueHealthOpen] = useState(false);

  // Data States
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);

  // Loading States
  const [loadingScheduled, setLoadingScheduled] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Search & Filter
  const [searchScheduled, setSearchScheduled] = useState('');
  const [searchSent, setSearchSent] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch Scheduled Emails
  const fetchScheduled = useCallback(async (searchQuery = '') => {
    try {
      setLoadingScheduled(true);
      const res = await api.getScheduledEmails({ search: searchQuery });
      if (res.success) {
        setScheduledEmails(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching scheduled:', err);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  // Fetch Sent Emails
  const fetchSent = useCallback(async (searchQuery = '') => {
    try {
      setLoadingSent(true);
      const res = await api.getSentEmails({ search: searchQuery });
      if (res.success) {
        setSentEmails(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching sent:', err);
    } finally {
      setLoadingSent(false);
    }
  }, []);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getStats();
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Refresh All Data
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchScheduled(searchScheduled),
      fetchSent(searchSent),
      fetchStats(),
    ]);
    setIsRefreshing(false);
  }, [fetchScheduled, fetchSent, fetchStats, searchScheduled, searchSent]);

  // Initial Load
  useEffect(() => {
    refreshAll();
  }, []);

  // Auto-refresh interval (every 4 seconds) to reflect realtime background queue activity
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchScheduled(searchScheduled);
      fetchSent(searchSent);
      fetchStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchScheduled, fetchSent, fetchStats, searchScheduled, searchSent]);

  // Handle Cancel Email
  const handleCancel = async (id: string) => {
    try {
      setCancellingId(id);
      const res = await api.cancelEmail(id);
      if (res.success) {
        showToast('success', 'Email job has been cancelled successfully', 'Cancelled');
        refreshAll();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to cancel email', 'Error');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenQueueHealth={() => setIsQueueHealthOpen(true)}
        onRefresh={refreshAll}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metric Cards Banner */}
        <StatCards stats={stats} loading={isRefreshing && !stats} />

        {/* Dashboard Tabs & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-gray-850/80 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-black/30 font-mono font-bold">
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'sent'
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-gray-850/80 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sent & Delivered</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-black/30 font-mono font-bold">
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-0"
              />
              <span>Live Auto-Sync (4s)</span>
            </label>
          </div>
        </div>

        {/* Tab View Content */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loadingScheduled}
            onCancel={handleCancel}
            onSearch={(q) => {
              setSearchScheduled(q);
              fetchScheduled(q);
            }}
            onRefresh={() => fetchScheduled(searchScheduled)}
            cancellingId={cancellingId}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            loading={loadingSent}
            onSearch={(q) => {
              setSearchSent(q);
              fetchSent(q);
            }}
            onRefresh={() => fetchSent(searchSent)}
          />
        )}
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          refreshAll();
        }}
      />

      {/* Queue Health Drawer */}
      <QueueHealthDrawer
        isOpen={isQueueHealthOpen}
        onClose={() => setIsQueueHealthOpen(false)}
        stats={stats}
        onRefresh={refreshAll}
        isRefreshing={isRefreshing}
      />
    </div>
  );
};
