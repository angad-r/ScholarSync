import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { AcademicEvent, AcademicEventType, EventReviewStatus } from '../../types';
import {
  parseSpreadsheetCalendar,
  parsePdfCalendar,
  parsePlainTextCalendar,
  ExtractedEventPreview,
} from '../../lib/calendarParser';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  FileSpreadsheet,
  File,
  Sparkles,
} from 'lucide-react';

interface CalendarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (eventsToImport: AcademicEvent[], filename: string) => Promise<void>;
  existingEvents: AcademicEvent[];
}

const EVENT_TYPE_OPTIONS: { label: string; value: AcademicEventType }[] = [
  { label: 'Official Holiday', value: 'official_holiday' },
  { label: 'User Holiday', value: 'user_holiday' },
  { label: 'College Closure', value: 'college_closure' },
  { label: 'Rescheduled / Midterm Exam', value: 'rescheduled_exam' },
  { label: 'Cancelled Lab', value: 'cancelled_lab' },
  { label: 'Cancelled Lecture', value: 'cancelled_lecture' },
  { label: 'Assignment Deadline', value: 'assignment_deadline' },
  { label: 'College Event / Fest', value: 'college_event' },
  { label: 'Vacation / Study Break', value: 'vacation_break' },
  { label: 'Registration Deadline', value: 'registration_deadline' },
  { label: 'Other', value: 'other' },
];

export function CalendarUploadModal({
  isOpen,
  onClose,
  onConfirmImport,
  existingEvents,
}: CalendarUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [extractedPreviews, setExtractedPreviews] = useState<ExtractedEventPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = () => {
    setSelectedFile(null);
    setExtractedPreviews([]);
    setSelectedIds(new Set());
    setWarnings([]);
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setWarnings([]);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let result;

      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        result = await parseSpreadsheetCalendar(buffer, file.name, existingEvents);
      } else if (ext === 'pdf') {
        const buffer = await file.arrayBuffer();
        result = await parsePdfCalendar(buffer, file.name, existingEvents);
      } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
        // Scanned image fallback with review instructions
        result = {
          events: [],
          warnings: [
            `Image uploaded (${file.name}). For scanned images, please use the review table below to add entries or convert to spreadsheet for automated parsing.`,
          ],
          totalRawRowsScanned: 0,
        };
      } else {
        const text = await file.text();
        result = parsePlainTextCalendar(text, file.name, existingEvents);
      }

      setExtractedPreviews(result.events);
      setWarnings(result.warnings);

      // Select all non-duplicate events by default
      const initialSelected = new Set<string>();
      for (const ev of result.events) {
        if (ev.reviewStatus !== 'duplicate') {
          initialSelected.add(ev.tempId);
        }
      }
      setSelectedIds(initialSelected);
    } catch (err: any) {
      setWarnings([`Failed to parse file: ${err.message}`]);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleSelect = (tempId: string) => {
    const next = new Set(selectedIds);
    if (next.has(tempId)) next.delete(tempId);
    else next.add(tempId);
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(extractedPreviews.map((p) => p.tempId)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const updatePreviewItem = (tempId: string, updates: Partial<ExtractedEventPreview>) => {
    setExtractedPreviews((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...updates } : item))
    );
  };

  const removePreviewItem = (tempId: string) => {
    setExtractedPreviews((prev) => prev.filter((p) => p.tempId !== tempId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  };

  const handleApply = async () => {
    const chosen = extractedPreviews.filter((p) => selectedIds.has(p.tempId));
    if (chosen.length === 0) return;

    setIsImporting(true);
    try {
      const now = new Date().toISOString();
      const events: AcademicEvent[] = chosen.map((c) => ({
        id: `ev-cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: c.title,
        eventType: c.eventType,
        startDate: c.startDate,
        endDate: c.endDate,
        allDay: c.allDay,
        sourceType: 'uploaded_calendar',
        sourceName: selectedFile?.name || 'Uploaded Calendar',
        isUserOverride: false,
        confidence: c.confidence,
        reviewStatus: 'accepted',
        createdAt: now,
        updatedAt: now,
      }));

      await onConfirmImport(events, selectedFile?.name || 'Academic Calendar');
      resetState();
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Upload & Import Academic Calendar"
      description="Extract exams, holidays, deadlines, and vacations from official PDF, Excel, or CSV calendars."
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            onClick={() => {
              resetState();
              onClose();
            }}
          >
            Cancel
          </Button>

          {extractedPreviews.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {selectedIds.size} of {extractedPreviews.length} event(s) selected
              </span>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={selectedIds.size === 0}
                isLoading={isImporting}
              >
                Confirm & Import Selected
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Upload Zone */}
        {!selectedFile ? (
          <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 transition-colors">
            <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              Select or Drop Academic Calendar
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Supported formats: <strong>.pdf</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>,{' '}
              <strong>.csv</strong>, <strong>.png</strong>, <strong>.jpg</strong>
            </p>

            <label className="mt-4 inline-flex items-center justify-center font-medium transition-all rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs px-4 py-2 cursor-pointer shadow-sm">
              <File className="w-3.5 h-3.5 mr-1.5" />
              Browse Files
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {extractedPreviews.length} events detected
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={resetState}
              className="text-xs"
            >
              Change File
            </Button>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Alert variant="warning" title="Calendar Parser Diagnostics">
            <ul className="list-disc list-inside space-y-1 text-xs">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Import Review Screen */}
        {extractedPreviews.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Extracted Events Preview Table
                </h4>
                <Badge variant="primary" size="sm">
                  {extractedPreviews.length} detected
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-80">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr className="font-semibold text-slate-600 dark:text-slate-400">
                    <th className="p-2.5 pl-3 w-8"></th>
                    <th className="p-2.5">Event Name</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Start Date</th>
                    <th className="p-2.5">End Date</th>
                    <th className="p-2.5">Confidence</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {extractedPreviews.map((item) => {
                    const isSelected = selectedIds.has(item.tempId);
                    return (
                      <tr
                        key={item.tempId}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          !isSelected ? 'opacity-50 bg-slate-50/30' : ''
                        }`}
                      >
                        <td className="p-2.5 pl-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.tempId)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100 min-w-[160px]">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updatePreviewItem(item.tempId, { title: e.target.value })}
                            className="w-full px-2 py-1 rounded bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs"
                          />
                        </td>
                        <td className="p-2.5 min-w-[140px]">
                          <select
                            value={item.eventType}
                            onChange={(e) =>
                              updatePreviewItem(item.tempId, {
                                eventType: e.target.value as AcademicEventType,
                              })
                            }
                            className="w-full px-2 py-1 rounded bg-transparent border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            {EVENT_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5 min-w-[110px]">
                          <input
                            type="date"
                            value={item.startDate}
                            onChange={(e) => updatePreviewItem(item.tempId, { startDate: e.target.value })}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                          />
                        </td>
                        <td className="p-2.5 min-w-[110px]">
                          <input
                            type="date"
                            value={item.endDate}
                            onChange={(e) => updatePreviewItem(item.tempId, { endDate: e.target.value })}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                          />
                        </td>
                        <td className="p-2.5 font-medium">
                          <span
                            className={
                              item.confidence >= 85
                                ? 'text-emerald-600 font-semibold'
                                : 'text-amber-600'
                            }
                          >
                            {item.confidence}%
                          </span>
                        </td>
                        <td className="p-2.5">
                          <Badge
                            variant={
                              item.reviewStatus === 'duplicate'
                                ? 'neutral'
                                : item.reviewStatus === 'conflicting'
                                ? 'danger'
                                : item.reviewStatus === 'needs_review'
                                ? 'warning'
                                : 'success'
                            }
                            size="sm"
                          >
                            {item.reviewStatus}
                          </Badge>
                        </td>
                        <td className="p-2.5 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => removePreviewItem(item.tempId)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Remove from import"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
