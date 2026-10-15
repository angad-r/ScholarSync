import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { AcademicEvent, AcademicEventType, Subject, ScheduleChangeLog } from '../../types';
import { format } from 'date-fns';
import { Undo2, History, AlertTriangle } from 'lucide-react';

interface ManageHolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEvent: (event: Partial<AcademicEvent>) => Promise<void>;
  initialEvent?: AcademicEvent | null;
  subjects: Subject[];
  changeLogs?: ScheduleChangeLog[];
  onUndoChange?: (logId: string) => Promise<void>;
}

const EVENT_TYPE_OPTIONS: { label: string; value: AcademicEventType }[] = [
  { label: 'User-Added Custom Holiday', value: 'user_holiday' },
  { label: 'Official College Holiday', value: 'official_holiday' },
  { label: 'Unexpected College Closure (Rain/Strike)', value: 'college_closure' },
  { label: 'Cancelled Lecture', value: 'cancelled_lecture' },
  { label: 'Cancelled Laboratory Session', value: 'cancelled_lab' },
  { label: 'Additional Working Day (Compensatory)', value: 'additional_working_day' },
  { label: 'Extra Lecture or Laboratory', value: 'extra_lecture' },
  { label: 'Rescheduled Examination', value: 'rescheduled_exam' },
  { label: 'Postponed Examination', value: 'postponed_exam' },
  { label: 'Assignment Deadline Extension', value: 'assignment_deadline' },
  { label: 'Special College Event / Fest', value: 'college_event' },
  { label: 'Vacation or Study Break', value: 'vacation_break' },
];

export function ManageHolidaysModal({
  isOpen,
  onClose,
  onSaveEvent,
  initialEvent,
  subjects,
  changeLogs = [],
  onUndoChange,
}: ManageHolidaysModalProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<AcademicEventType>('user_holiday');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly'>('none');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setEventType(initialEvent.eventType);
      setStartDate(initialEvent.startDate);
      setEndDate(initialEvent.endDate);
      setStartTime(initialEvent.startTime || '');
      setEndTime(initialEvent.endTime || '');
      setAllDay(initialEvent.allDay);
      setSelectedSubjects(initialEvent.affectedSubjectIds || []);
      setDescription(initialEvent.description || '');
      setRecurrence(initialEvent.recurrence || 'none');
      setNotes(initialEvent.notes || '');
    } else {
      setTitle('');
      setEventType('user_holiday');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
      setStartTime('');
      setEndTime('');
      setAllDay(true);
      setSelectedSubjects([]);
      setDescription('');
      setRecurrence('none');
      setNotes('');
    }
    setErrors({});
  }, [isOpen, initialEvent]);

  const toggleSubject = (subId: string) => {
    if (selectedSubjects.includes(subId)) {
      setSelectedSubjects(selectedSubjects.filter((id) => id !== subId));
    } else {
      setSelectedSubjects([...selectedSubjects, subId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrors({ title: 'Event title is required.' });
      return;
    }
    if (startDate > endDate) {
      setErrors({ endDate: 'End date cannot be earlier than start date.' });
      return;
    }

    setIsSaving(true);
    try {
      await onSaveEvent({
        id: initialEvent?.id,
        title: title.trim(),
        eventType,
        startDate,
        endDate,
        startTime: allDay ? null : startTime || null,
        endTime: allDay ? null : endTime || null,
        allDay,
        affectedSubjectIds: selectedSubjects,
        description: description.trim() || undefined,
        sourceType: 'manual_entry',
        sourceName: 'User Manual Override',
        isUserOverride: true, // Manual changes explicitly hold highest precedence
        confidence: 100,
        reviewStatus: 'accepted',
        recurrence,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialEvent ? 'Edit Holiday or Schedule Change' : 'Manage Holidays & Schedule Changes'}
      description="Add unexpected college closures, personal holidays, or rescheduled classes."
      size="lg"
      footer={
        activeTab === 'form' ? (
          <>
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={isSaving} type="submit">
              {initialEvent ? 'Update Event' : 'Save Event'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setActiveTab('form')}>
            Back to Form
          </Button>
        )
      }
    >
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 -mt-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'form'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Event Form
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Change History & Undo ({changeLogs.length})
        </button>
      </div>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <Input
            label="Title / Reason *"
            placeholder="e.g. Heavy Rain College Closure, Extra OS Lab"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Event Type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as AcademicEventType)}
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>

            <Select
              label="Recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as 'none' | 'weekly')}
            >
              <option value="none">One-time Event</option>
              <option value="weekly">Repeats Weekly</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={errors.endDate}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              All-Day Event (No specific class time)
            </label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Input
                label="Start Time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="End Time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}

          {/* Affected Subjects Selection */}
          {subjects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Affected Subjects (Optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((sub) => {
                  const isChecked = selectedSubjects.includes(sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSubject(sub.id)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {sub.code || sub.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Input
            label="Description / Circular Notes (Optional)"
            placeholder="e.g. Per Principal announcement circular dated 12 Oct"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              <strong>Precedence Protection:</strong> User-added events are saved as explicit overrides. They will not be overwritten by subsequent calendar uploads or website syncs.
            </p>
          </div>
        </form>
      ) : (
        /* Change History & Undo Tab */
        <div className="space-y-3 text-xs max-h-96 overflow-y-auto">
          {changeLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No recent changes recorded.
            </div>
          ) : (
            changeLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {log.eventTitle}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{log.description}</p>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleString()} • {log.source}
                  </span>
                </div>

                {onUndoChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUndoChange(log.id)}
                    className="shrink-0 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    Undo
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
