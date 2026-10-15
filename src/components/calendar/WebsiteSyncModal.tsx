import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { AcademicEvent, CalendarSource, CalendarDiffItem } from '../../types';
import {
  validateCollegeUrl,
  discoverCollegeCalendar,
  calculateCalendarDiff,
} from '../../lib/collegeWebsiteIntegration';
import { Globe, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface WebsiteSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySync: (
    newEvents: AcademicEvent[],
    sourceInfo: Partial<CalendarSource>
  ) => Promise<void>;
  existingEvents: AcademicEvent[];
  currentSource?: CalendarSource | null;
}

export function WebsiteSyncModal({
  isOpen,
  onClose,
  onApplySync,
  existingEvents,
  currentSource,
}: WebsiteSyncModalProps) {
  const [url, setUrl] = useState(
    currentSource?.sourceUrl || 'https://university.ac.in/academic-calendar'
  );
  const [institutionName, setInstitutionName] = useState(
    currentSource?.institutionName || 'University Examination Portal'
  );
  const [isValidating, setIsValidating] = useState(false);
  const [diffItems, setDiffItems] = useState<CalendarDiffItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedRawEvents, setDetectedRawEvents] = useState<AcademicEvent[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const handleTestAndDiscover = async () => {
    setErrorMsg(null);
    setDiffItems(null);

    // 1. SSRF and protocol validation
    const validation = validateCollegeUrl(url);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Invalid URL.');
      return;
    }

    setIsValidating(true);
    try {
      const res = await discoverCollegeCalendar(validation.sanitizedUrl!, institutionName);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to detect official calendar notices.');
        return;
      }

      setDetectedRawEvents(res.detectedEvents);
      const diffs = calculateCalendarDiff(res.detectedEvents, existingEvents);
      setDiffItems(diffs);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!diffItems) return;
    setIsApplying(true);
    try {
      // Filter out events that were omitted or conflicted with user overrides
      const acceptedEvents = detectedRawEvents.filter((detected) => {
        const diff = diffItems.find((d) => d.event.id === detected.id);
        if (diff && diff.type === 'conflict') return false; // User override wins!
        return true;
      });

      await onApplySync(acceptedEvents, {
        sourceType: 'college_website',
        sourceUrl: url,
        institutionName,
        lastSyncAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        syncStatus: 'success',
      });

      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="College Calendar Connection"
      description="Connect to your official institution website or academic calendar feed."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {diffItems && (
            <Button
              variant="primary"
              onClick={handleConfirmSync}
              isLoading={isApplying}
              disabled={diffItems.length === 0}
            >
              Apply Verified Sync Changes
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Source Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Institution Name"
            placeholder="e.g. State Technical University"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
          />

          <Input
            label="Official Website or Calendar URL *"
            placeholder="https://university.ac.in/academic-calendar"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict SSRF Protection Active (Localhost & internal networks blocked).</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleTestAndDiscover}
            isLoading={isValidating}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Check & Compare Calendar
          </Button>
        </div>

        {errorMsg && (
          <Alert variant="danger" title="Connection / Security Error">
            {errorMsg}
          </Alert>
        )}

        {/* Diff Comparison Table */}
        {diffItems && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                Detected Updates Comparison Screen
              </h4>
              <Badge variant="primary" size="sm">
                {diffItems.length} changes detected
              </Badge>
            </div>

            {diffItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                Your calendar is already up to date with the institution feed! No new changes detected.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {diffItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                      item.type === 'conflict'
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                        : item.type === 'new'
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.event.title}
                        </span>
                        <Badge
                          variant={
                            item.type === 'new'
                              ? 'success'
                              : item.type === 'conflict'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {item.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Date: <strong>{item.event.startDate}</strong>
                        {item.event.endDate !== item.event.startDate && ` to ${item.event.endDate}`}
                      </p>
                      {item.changeDescription && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                          {item.changeDescription}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
