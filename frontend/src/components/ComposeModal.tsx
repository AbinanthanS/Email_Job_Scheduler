import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  X,
  UploadCloud,
  FileText,
  Clock,
  Gauge,
  Timer,
  Send,
  Users,
  CheckCircle2,
  Trash2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');
  
  // Scheduling controls
  const [scheduleType, setScheduleType] = useState<'immediate' | 'custom'>('immediate');
  const [customStartTime, setCustomStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000); // 5 mins in future default
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delayBetweenEmails, setDelayBetweenEmails] = useState<number>(2); // seconds
  const [hourlyLimit, setHourlyLimit] = useState<number>(200); // per hour
  const [senderName, setSenderName] = useState('ReachInbox Team');

  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  // CSV / TXT parsing helper
  const parseEmailsFromContent = (text: string) => {
    // Regex for matching emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    const unique = Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));
    return unique;
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          const rawText = JSON.stringify(results.data);
          const extracted = parseEmailsFromContent(rawText);
          if (extracted.length === 0) {
            showToast('warning', 'No valid email addresses found in the CSV file.', 'No Leads Detected');
          } else {
            setRecipients(extracted);
            showToast('success', `Detected ${extracted.length} valid email address(es)`, 'CSV Parsed');
          }
        },
        error: (err) => {
          showToast('error', `Failed to parse CSV: ${err.message}`, 'File Error');
        },
      });
    } else {
      // Plain text or other format
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const extracted = parseEmailsFromContent(content);
        if (extracted.length === 0) {
          showToast('warning', 'No valid email addresses found in file.', 'No Leads Detected');
        } else {
          setRecipients(extracted);
          showToast('success', `Detected ${extracted.length} valid email address(es)`, 'File Parsed');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleManualAdd = () => {
    if (!manualInput.trim()) return;
    const extracted = parseEmailsFromContent(manualInput);
    if (extracted.length > 0) {
      const merged = Array.from(new Set([...recipients, ...extracted]));
      setRecipients(merged);
      setManualInput('');
      showToast('success', `Added ${extracted.length} email(s). Total: ${merged.length}`);
    } else {
      showToast('warning', 'Please enter valid email addresses separated by commas or line breaks.');
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAllRecipients = () => {
    setRecipients([]);
    setFileName(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      showToast('warning', 'Please provide a subject line.', 'Missing Subject');
      return;
    }

    if (!body.trim()) {
      showToast('warning', 'Please provide an email message body.', 'Missing Body');
      return;
    }

    if (recipients.length === 0) {
      showToast('warning', 'Please upload a CSV or add at least one recipient lead.', 'No Recipients');
      return;
    }

    setIsSubmitting(true);

    try {
      const startTimeVal = scheduleType === 'immediate' ? new Date().toISOString() : new Date(customStartTime).toISOString();

      const payload = {
        recipients,
        subject,
        body,
        startTime: startTimeVal,
        delayBetweenEmails, // in seconds
        hourlyLimit,
        senderName,
      };

      const res = await api.scheduleEmails(payload);

      if (res.success) {
        showToast(
          'success',
          `Successfully scheduled ${recipients.length} emails with ${delayBetweenEmails}s delay and ${hourlyLimit}/hr limit.`,
          'Emails Enqueued'
        );
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to schedule email batch', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/80 bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Compose & Schedule Campaign</h2>
              <p className="text-xs text-gray-400">Configure delayed BullMQ queue dispatch with persistent rate limiting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Sender & Subject Line */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Sender Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Alex at ReachInbox"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/80 text-white text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-gray-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Subject Line <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Scaling outreach with ReachInbox scheduler"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/80 text-white text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Email Message Body <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-gray-400">Supports Plain Text or HTML</span>
            </div>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,&#10;&#10;We're excited to introduce ReachInbox's high-throughput job scheduler!&#10;&#10;Best regards,&#10;ReachInbox Team"
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/80 text-white text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-gray-500 font-sans"
            />
          </div>

          {/* Recipient Leads Section (CSV / Manual) */}
          <div className="p-4 rounded-2xl bg-gray-850/60 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Target Leads ({recipients.length} detected)
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-800 p-1 rounded-xl border border-gray-700/60">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    inputMode === 'upload' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Upload CSV / TXT
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    inputMode === 'manual' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Paste Emails
                </button>
              </div>
            </div>

            {inputMode === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-gray-700/80 hover:border-gray-600 bg-gray-800/40 hover:bg-gray-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                />
                <UploadCloud className="w-8 h-8 mx-auto text-brand-400 mb-2" />
                <p className="text-xs font-semibold text-gray-200">
                  {fileName ? (
                    <span className="text-brand-400 font-bold">{fileName}</span>
                  ) : (
                    'Click to upload CSV / Leads file or drag and drop'
                  )}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">Accepts CSV with email columns or plain text with one email per line</p>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste email addresses separated by commas or new lines (e.g. john@example.com, sara@acme.org)..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-800/80 border border-gray-700/80 text-white text-xs focus:outline-none focus:border-brand-500 placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={handleManualAdd}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded-lg border border-gray-700 font-medium transition-colors"
                >
                  Parse & Add Leads
                </button>
              </div>
            )}

            {/* Recipient Lead Tags Preview */}
            {recipients.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                  <span>Previewing parsed recipients:</span>
                  <button
                    type="button"
                    onClick={clearAllRecipients}
                    className="text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" /> Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-gray-900/90 rounded-xl border border-gray-800">
                  {recipients.slice(0, 30).map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-[11px] text-gray-200 border border-gray-700/60"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => removeRecipient(idx)}
                        className="text-gray-400 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {recipients.length > 30 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-brand-500/20 text-[11px] text-brand-300 font-semibold">
                      +{recipients.length - 30} more leads
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-gray-850/60 border border-gray-800">
            {/* Start Time */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Start Dispatch
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType('immediate')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                      scheduleType === 'immediate'
                        ? 'bg-brand-600/30 border-brand-500 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-400'
                    }`}
                  >
                    Start Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('custom')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                      scheduleType === 'custom'
                        ? 'bg-brand-600/30 border-brand-500 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-400'
                    }`}
                  >
                    Future Time
                  </button>
                </div>
                {scheduleType === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-brand-500"
                  />
                )}
              </div>
            </div>

            {/* Delay Between Emails (Provider throttling) */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                <Timer className="w-3.5 h-3.5 text-emerald-400" /> Delay Between (s)
              </label>
              <div className="space-y-1.5">
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-800/80 border border-gray-700 text-white text-sm focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-gray-400 block">Throttles spacing per recipient</span>
              </div>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" /> Hourly Limit
              </label>
              <div className="space-y-1.5">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 200))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-800/80 border border-gray-700 text-white text-sm focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-gray-400 block">Auto-reschedules overflow to next hr</span>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white text-sm font-medium border border-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || recipients.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enqueuing Jobs...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Schedule {recipients.length > 0 ? `(${recipients.length})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
