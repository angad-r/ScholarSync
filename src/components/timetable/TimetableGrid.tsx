import React, { useState } from 'react';
import { TimetableSession, Subject } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { detectTimetableConflicts } from '../../lib/timetableConflict';
import {
  Plus,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  MapPin,
  Coffee,
  Sparkles,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';

interface TimetableGridProps {
  sessions: TimetableSession[];
  subjects: Subject[];
  onAddSession: (day?: number) => void;
  onEditSession: (session: TimetableSession) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onOpenUploadModal?: () => void;
}

export function TimetableGrid({
  sessions,
  subjects,
  onAddSession,
  onEditSession,
  onDeleteSession,
  onOpenUploadModal,
}: TimetableGridProps) {
  const [includeWeekends, setIncludeWeekends] = useState(false);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const subjectNames: Record<string, string> = {};
  for (const s of subjects) subjectNames[s.id] = s.name;

  const conflicts = detectTimetableConflicts(sessions, subjectNames);
  const conflictingSessionIds = new Set<string>();
  for (const c of conflicts) {
    conflictingSessionIds.add(c.session1.id);
    conflictingSessionIds.add(c.session2.id);
  }

  const daysToShow = includeWeekends
    ? [
        { num: 1, name: 'Monday' },
        { num: 2, name: 'Tuesday' },
        { num: 3, name: 'Wednesday' },
        { num: 4, name: 'Thursday' },
        { num: 5, name: 'Friday' },
        { num: 6, name: 'Saturday' },
        { num: 7, name: 'Sunday' },
      ]
    : [
        { num: 1, name: 'Monday' },
        { num: 2, name: 'Tuesday' },
        { num: 3, name: 'Wednesday' },
        { num: 4, name: 'Thursday' },
        { num: 5, name: 'Friday' },
      ];

  return (
    <div className="space-y-5">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWeekends}
              onChange={(e) => setIncludeWeekends(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            Show Weekends (Sat & Sun)
          </label>
        </div>

        <div className="flex items-center gap-2">
          {onOpenUploadModal && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenUploadModal}
              className="flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              Upload Timetable
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => onAddSession(1)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Schedule Slot
          </Button>
        </div>
      </div>

      {/* Clashes / Overlap Warning Banner */}
      {conflicts.length > 0 && (
        <Alert variant="danger" title={`${conflicts.length} Timetable Clash(es) Detected`}>
          <ul className="list-disc list-inside space-y-1">
            {conflicts.map((c, i) => (
              <li key={i}>{c.reason}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Weekly Column Grid */}
      <div
        className={`grid grid-cols-1 ${
          includeWeekends ? 'md:grid-cols-7' : 'md:grid-cols-5'
        } gap-3 items-start`}
      >
        {daysToShow.map((day) => {
          const daySessions = sessions
            .filter((s) => s.dayOfWeek === day.num)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div
              key={day.num}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col min-h-[380px]"
            >
              {/* Day Header */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 rounded-t-2xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    {day.name}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  onClick={() => onAddSession(day.num)}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
                  title={`Add session on ${day.name}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Day Sessions List */}
              <div className="p-2 space-y-2 flex-1">
                {daySessions.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-[11px] text-slate-400 text-center">
                    No sessions scheduled
                  </div>
                ) : (
                  daySessions.map((s) => {
                    const subject = subjectMap.get(s.subjectId);
                    const isConflicting = conflictingSessionIds.has(s.id);
                    const isBreak = s.type === 'break';
                    const isFree = s.type === 'free_period';

                    const displayTitle =
                      s.customTitle ||
                      (isBreak ? 'Break' : isFree ? 'Free Period' : subject?.code || subject?.name || 'Class');

                    const displaySubtitle =
                      !isBreak && !isFree && subject?.name && subject?.code && subject.code !== subject.name
                        ? subject.name
                        : undefined;

                    const borderLeftColor = isBreak
                      ? '#f59e0b'
                      : isFree
                      ? '#0ea5e9'
                      : subject?.color || '#4f46e5';

                    const cardBgClass = isConflicting
                      ? 'border-rose-400 dark:border-rose-600 shadow-sm shadow-rose-500/20 ring-1 ring-rose-400 bg-white dark:bg-slate-900'
                      : isBreak
                      ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60 hover:border-amber-300'
                      : isFree
                      ? 'bg-sky-50/50 dark:bg-sky-950/20 border-dashed border-sky-300 dark:border-sky-800/70 hover:border-sky-400'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900';

                    return (
                      <div
                        key={s.id}
                        className={`p-2.5 rounded-xl border text-xs transition-all relative group ${cardBgClass}`}
                        style={{
                          borderLeftWidth: '3.5px',
                          borderLeftColor,
                        }}
                      >
                        {isConflicting && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            Time Clash!
                          </div>
                        )}

                        <div className="flex justify-between items-start gap-1">
                          <div className="min-w-0 pr-1">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">
                              {displayTitle}
                            </span>
                            {displaySubtitle && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                                {displaySubtitle}
                              </span>
                            )}
                          </div>

                          {isBreak ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 shrink-0 flex items-center gap-1">
                              <Coffee className="w-2.5 h-2.5" />
                              Break
                            </span>
                          ) : isFree ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 shrink-0 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              Free
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium capitalize px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                              {s.type}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            {s.startTime} - {s.endTime}
                          </span>
                        </div>

                        {s.room && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{s.room}</span>
                          </div>
                        )}

                        {/* Quick edit & delete buttons */}
                        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5 bg-white/90 dark:bg-slate-900/90 rounded-md shadow-sm p-0.5">
                          <button
                            onClick={() => onEditSession(s)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Edit slot"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteSession(s.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete slot"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
