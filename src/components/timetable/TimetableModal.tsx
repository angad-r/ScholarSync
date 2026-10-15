import React, { useState, useEffect } from 'react';
import { TimetableSession, Subject, SessionType } from '../../types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';

interface TimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (session: Partial<TimetableSession>) => Promise<void>;
  initialSession?: TimetableSession | null;
  subjects: Subject[];
  initialDay?: number;
}

export function TimetableModal({
  isOpen,
  onClose,
  onSave,
  initialSession,
  subjects,
  initialDay = 1,
}: TimetableModalProps) {
  const [subjectId, setSubjectId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [dayOfWeek, setDayOfWeek] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(
    (initialDay as any) || 1
  );
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [type, setType] = useState<SessionType>('lecture');
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSession) {
      setSubjectId(initialSession.subjectId || '');
      setCustomTitle(initialSession.customTitle || '');
      setDayOfWeek(initialSession.dayOfWeek);
      setStartTime(initialSession.startTime);
      setEndTime(initialSession.endTime);
      setType(initialSession.type);
      setRoom(initialSession.room || '');
      setNotes(initialSession.notes || '');
    } else {
      setSubjectId(subjects.length > 0 ? subjects[0].id : '');
      setCustomTitle('');
      setDayOfWeek(((initialDay as any) || 1));
      setStartTime('09:00');
      setEndTime('10:00');
      setType('lecture');
      setRoom('');
      setNotes('');
    }
    setErrors({});
  }, [isOpen, initialSession, subjects, initialDay]);

  const handleTypeChange = (newType: SessionType) => {
    setType(newType);
    if (newType === 'break' && !customTitle) {
      setCustomTitle('Lunch Break');
    } else if (newType === 'free_period' && !customTitle) {
      setCustomTitle('Free Period');
    }
  };

  const isBreakOrFree = type === 'break' || type === 'free_period';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!isBreakOrFree && !subjectId) {
      newErrors.subjectId = 'Please select a subject.';
    }

    if (isBreakOrFree && !customTitle.trim()) {
      newErrors.customTitle = 'Please enter a name or label for this break/period.';
    }

    if (startTime >= endTime) {
      newErrors.endTime = 'End time must be later than start time.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: initialSession?.id,
        subjectId: subjectId || '',
        customTitle: customTitle.trim() || undefined,
        dayOfWeek,
        startTime,
        endTime,
        type,
        room: room.trim() || undefined,
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
      title={initialSession ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
      description="Add regular weekly class lectures, lab practicals, study periods, breaks, or free periods."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSaving} type="submit">
            {initialSession ? 'Update Slot' : 'Add Slot'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Session Type */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Slot Category"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as SessionType)}
          >
            <option value="lecture">Class Lecture</option>
            <option value="lab">Laboratory Practical</option>
            <option value="tutorial">Tutorial</option>
            <option value="study">Personal Study</option>
            <option value="break">Break / Lunch / Recess</option>
            <option value="free_period">Free Period / Leisure</option>
          </Select>

          <Select
            label="Day of Week"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value) as any)}
          >
            <option value={1}>Monday</option>
            <option value={2}>Tuesday</option>
            <option value={3}>Wednesday</option>
            <option value={4}>Thursday</option>
            <option value={5}>Friday</option>
            <option value={6}>Saturday</option>
            <option value={7}>Sunday</option>
          </Select>
        </div>

        {/* Custom Title for Breaks / Free periods, or Subject for Academic classes */}
        {isBreakOrFree ? (
          <Input
            label={type === 'break' ? 'Break Name / Label' : 'Free Period Title'}
            placeholder={type === 'break' ? 'e.g. Lunch Break, Tea Break, Interval' : 'e.g. Free Period, Library, Sports'}
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            error={errors.customTitle}
          />
        ) : (
          <Select
            label="Subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            error={errors.subjectId}
          >
            <option value="">Select a subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} - ${s.name}` : s.name}
              </option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-4">
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
            error={errors.endTime}
          />
        </div>

        <Input
          label={isBreakOrFree ? 'Location / Cafeteria (Optional)' : 'Classroom / Lab Venue (Optional)'}
          placeholder={isBreakOrFree ? 'e.g. Food Court, Campus Canteen' : 'e.g. LH-102, CSE Computing Lab 2'}
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />

        <Input
          label="Notes (Optional)"
          placeholder="e.g. Bring laptop, Lab manual submission, Peer review"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
