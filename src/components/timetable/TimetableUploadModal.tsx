import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { Subject, SessionType, TimetableSession } from '../../types';
import {
  parseSpreadsheetTimetable,
  generateSampleTimetableCsv,
  ExtractedTimetableSlotPreview,
  DAY_NAMES,
} from '../../lib/timetableParser';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Clock,
  MapPin,
  Coffee,
  Sparkles,
  BookOpen,
  FlaskConical,
  Trash2,
  AlertTriangle,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface TimetableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onConfirmImport: (
    sessions: TimetableSession[],
    newSubjects: Subject[],
    replaceExisting: boolean
  ) => Promise<void>;
}

const SESSION_TYPE_OPTIONS: { label: string; value: SessionType }[] = [
  { label: 'Lecture', value: 'lecture' },
  { label: 'Laboratory Practical', value: 'lab' },
  { label: 'Tutorial', value: 'tutorial' },
  { label: 'Personal Study', value: 'study' },
  { label: 'Break / Lunch / Recess', value: 'break' },
  { label: 'Free Period / Empty Slot', value: 'free_period' },
];

const PRESET_COLORS = [
  '#4f46e5', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ef4444', // red
];

export function TimetableUploadModal({
  isOpen,
  onClose,
  subjects,
  onConfirmImport,
}: TimetableUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractedSlots, setExtractedSlots] = useState<ExtractedTimetableSlotPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [autoCreateSubjects, setAutoCreateSubjects] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'classes' | 'breaks'>('all');

  const resetState = () => {
    setSelectedFile(null);
    setIsParsing(false);
    setIsImporting(false);
    setExtractedSlots([]);
    setSelectedIds(new Set());
    setWarnings([]);
    setReplaceExisting(true);
    setAutoCreateSubjects(true);
    setActiveFilter('all');
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleTimetableCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_weekly_timetable.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setWarnings([]);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseSpreadsheetTimetable(buffer, file.name, subjects);

      setExtractedSlots(result.slots);
      setWarnings(result.warnings);

      // Select all slots by default
      setSelectedIds(new Set(result.slots.map((s) => s.tempId)));
    } catch (err: any) {
      setWarnings([`Failed to parse timetable: ${err.message}`]);
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
    setSelectedIds(new Set(extractedSlots.map((s) => s.tempId)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const updateSlot = (tempId: string, updates: Partial<ExtractedTimetableSlotPreview>) => {
    setExtractedSlots((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, ...updates } : s))
    );
  };

  const removeSlot = (tempId: string) => {
    setExtractedSlots((prev) => prev.filter((s) => s.tempId !== tempId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  };

  const handleApply = async () => {
    const chosen = extractedSlots.filter((s) => selectedIds.has(s.tempId));
    if (chosen.length === 0) return;

    setIsImporting(true);
    try {
      const newSubjectsToCreate: Subject[] = [];
      const newSubjectNameToId = new Map<string, string>();

      // Check for unmatched subjects to auto-create
      if (autoCreateSubjects) {
        for (const slot of chosen) {
          if (slot.type !== 'break' && slot.type !== 'free_period') {
            const subjectTitle = (slot.customTitle || slot.rawText).trim();
            if (!slot.subjectId && subjectTitle) {
              if (!newSubjectNameToId.has(subjectTitle.toLowerCase())) {
                const newId = `sub-auto-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                const color = PRESET_COLORS[newSubjectsToCreate.length % PRESET_COLORS.length];
                newSubjectNameToId.set(subjectTitle.toLowerCase(), newId);

                newSubjectsToCreate.push({
                  id: newId,
                  name: subjectTitle,
                  semester: 'Current',
                  academicYear: `${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
                  credits: 3,
                  color,
                  attendanceThreshold: 75,
                  targetScore: 85,
                  difficulty: 3,
                  assessmentComponents: [],
                  isArchived: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }
        }
      }

      // Build TimetableSession list
      const sessionsToImport: TimetableSession[] = chosen.map((c) => {
        let finalSubjectId = c.subjectId || '';
        const titleKey = (c.customTitle || c.rawText).trim().toLowerCase();

        if (!finalSubjectId && newSubjectNameToId.has(titleKey)) {
          finalSubjectId = newSubjectNameToId.get(titleKey)!;
        }

        return {
          id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          subjectId: finalSubjectId,
          customTitle: c.customTitle || (c.type === 'break' ? 'Break' : c.type === 'free_period' ? 'Free Period' : undefined),
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime,
          type: c.type,
          room: c.room,
          notes: c.notes,
        };
      });

      await onConfirmImport(sessionsToImport, newSubjectsToCreate, replaceExisting);
      resetState();
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const filteredSlots = extractedSlots.filter((s) => {
    if (activeFilter === 'classes') return s.type !== 'break' && s.type !== 'free_period';
    if (activeFilter === 'breaks') return s.type === 'break' || s.type === 'free_period';
    return true;
  });

  const breakCount = extractedSlots.filter((s) => s.type === 'break' || s.type === 'free_period').length;
  const classCount = extractedSlots.length - breakCount;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Upload Weekly Timetable Schedule"
      description="Import regular class schedules, lab practicals, tutorials, breaks, and free periods from Excel or CSV."
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

          {extractedSlots.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {selectedIds.size} of {extractedSlots.length} slot(s) selected
              </span>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={selectedIds.size === 0}
                isLoading={isImporting}
              >
                Confirm & Import Schedule
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Upload Zone & Template helper */}
        {!selectedFile ? (
          <div className="space-y-3">
            <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 transition-colors">
              <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Drop your Timetable Spreadsheet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Supports standard <strong>Day x Time matrix grids</strong> or <strong>tabular list columns</strong> (.xlsx, .xls, .csv).
                Includes automatic detection of lunch breaks, tea breaks, and free periods.
              </p>

              <div className="mt-4 flex items-center justify-center gap-3">
                <label className="inline-flex items-center justify-center font-medium transition-all rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs px-4 py-2 cursor-pointer shadow-sm">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Browse Timetable File
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Download Sample Template (.CSV)
                </Button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-1.5 text-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Automatic Schedule Intelligence:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                <li><strong>Breaks & Recess:</strong> Detects "Lunch Break", "Tea Break", "Interval" and marks them with dedicated break slots.</li>
                <li><strong>Free Periods:</strong> Detects "Free", "Library", "Leisure", or vacant periods without cluttering subjects.</li>
                <li><strong>Subject Matching:</strong> Automatically matches codes (e.g. <em>22CS501</em>) and acronyms (e.g. <em>DBMS</em>) to your subject catalog.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-indigo-500" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {classCount} classes & {breakCount} breaks/free slots detected
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

        {/* Warnings / Diagnostics */}
        {warnings.length > 0 && (
          <Alert variant="warning" title="Timetable Parser Diagnostics">
            <ul className="list-disc list-inside space-y-1 text-xs">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Preview & Import Options */}
        {extractedSlots.length > 0 && (
          <div className="space-y-3.5">
            {/* Import settings */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Replace current timetable (clears old weekly slots)
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoCreateSubjects}
                  onChange={(e) => setAutoCreateSubjects(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Auto-add unmatched courses to Subject catalog
              </label>
            </div>

            {/* Filter pills & Selection controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    activeFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  All Slots ({extractedSlots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('classes')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    activeFilter === 'classes'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Classes & Labs ({classCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('breaks')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    activeFilter === 'breaks'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Breaks & Free ({breakCount})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 hover:underline font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Slot review table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-80">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr className="font-semibold text-slate-600 dark:text-slate-400">
                    <th className="p-2.5 pl-3 w-8"></th>
                    <th className="p-2.5">Day</th>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Subject / Label</th>
                    <th className="p-2.5">Venue / Room</th>
                    <th className="p-2.5 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSlots.map((item) => {
                    const isSelected = selectedIds.has(item.tempId);
                    const isBreakOrFree = item.type === 'break' || item.type === 'free_period';

                    return (
                      <tr
                        key={item.tempId}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          !isSelected ? 'opacity-50 bg-slate-50/20' : ''
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

                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {item.dayName.slice(0, 3)}
                        </td>

                        <td className="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.startTime} - {item.endTime}
                        </td>

                        <td className="p-2.5 min-w-[130px]">
                          <select
                            value={item.type}
                            onChange={(e) => updateSlot(item.tempId, { type: e.target.value as SessionType })}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                          >
                            {SESSION_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5 min-w-[180px]">
                          {isBreakOrFree ? (
                            <div className="flex items-center gap-1.5">
                              {item.type === 'break' ? (
                                <Coffee className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              )}
                              <input
                                type="text"
                                value={item.customTitle || (item.type === 'break' ? 'Lunch Break' : 'Free Period')}
                                onChange={(e) => updateSlot(item.tempId, { customTitle: e.target.value })}
                                className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
                                placeholder="Break label..."
                              />
                            </div>
                          ) : (
                            <select
                              value={item.subjectId || ''}
                              onChange={(e) => {
                                const selectedSub = subjects.find((s) => s.id === e.target.value);
                                updateSlot(item.tempId, {
                                  subjectId: e.target.value,
                                  matchedSubjectName: selectedSub?.name,
                                  customTitle: selectedSub ? undefined : item.customTitle,
                                });
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                            >
                              <option value="">
                                {autoCreateSubjects
                                  ? `+ Create Subject: "${item.customTitle || item.rawText}"`
                                  : 'Select registered subject...'}
                              </option>
                              {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td className="p-2.5 min-w-[100px]">
                          <input
                            type="text"
                            value={item.room || ''}
                            onChange={(e) => updateSlot(item.tempId, { room: e.target.value || undefined })}
                            placeholder="e.g. LH-101"
                            className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent text-xs"
                          />
                        </td>

                        <td className="p-2.5 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeSlot(item.tempId)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Remove slot"
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
