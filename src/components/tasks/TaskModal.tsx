import React, { useState, useEffect } from 'react';
import { Task, SubTask, Subject, Priority, TaskStatus } from '../../types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { Plus, Trash2, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { format, isPast, parseISO, isToday } from 'date-fns';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => Promise<void>;
  initialTask?: Task | null;
  subjects: Subject[];
}

export function TaskModal({ isOpen, onClose, onSave, initialTask, subjects }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime] = useState('23:59');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(60);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [category, setCategory] = useState<Task['category']>('assignment');
  const [notes, setNotes] = useState('');
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setSubjectId(initialTask.subjectId || '');
      setDueDate(initialTask.dueDate);
      setDueTime(initialTask.dueTime || '23:59');
      setPriority(initialTask.priority);
      setStatus(initialTask.status);
      setEstimatedMinutes(initialTask.estimatedMinutes);
      setCompletionPercentage(initialTask.completionPercentage);
      setCategory(initialTask.category);
      setNotes(initialTask.notes || '');
      setSubtasks(initialTask.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setSubjectId(subjects.length > 0 ? subjects[0].id : '');
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      setDueTime('23:59');
      setPriority('medium');
      setStatus('pending');
      setEstimatedMinutes(60);
      setCompletionPercentage(0);
      setCategory('assignment');
      setNotes('');
      setSubtasks([]);
    }
    setErrors({});
  }, [isOpen, initialTask, subjects]);

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      {
        id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: newSubtaskTitle.trim(),
        isCompleted: false,
      },
    ]);
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (id: string) => {
    const updated = subtasks.map((st) =>
      st.id === id ? { ...st, isCompleted: !st.isCompleted } : st
    );
    setSubtasks(updated);
    // Auto-update percentage based on subtask ratio if subtasks exist
    if (updated.length > 0) {
      const completedCount = updated.filter((s) => s.isCompleted).length;
      const pct = Math.round((completedCount / updated.length) * 100);
      setCompletionPercentage(pct);
      if (pct === 100) setStatus('completed');
    }
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== id));
  };

  const isDueInPast = isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrors({ title: 'Task title is required.' });
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: initialTask?.id,
        title: title.trim(),
        description: description.trim(),
        subjectId: subjectId || null,
        dueDate,
        dueTime: dueTime || null,
        priority,
        status,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        completionPercentage: Number(completionPercentage),
        subtasks,
        category,
        notes: notes.trim() || undefined,
        completedAt: status === 'completed' ? initialTask?.completedAt || new Date().toISOString() : null,
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
      title={initialTask ? 'Edit Academic Task' : 'Create New Academic Task'}
      description="Record assignments, lab submissions, exam preparation, or projects."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSaving} type="submit">
            {initialTask ? 'Update Task' : 'Save Task'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task Title *"
          placeholder="e.g. Implement BCNF Normalization Algorithm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Associated Subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">General (No Subject)</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
              </option>
            ))}
          </Select>

          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Task['category'])}
          >
            <option value="assignment">Assignment / Homework</option>
            <option value="exam_prep">Exam / Quiz Preparation</option>
            <option value="project">Course Project / Viva</option>
            <option value="reading">Textbook Reading / Notes</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {isDueInPast && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Note: This deadline is in the past.
              </p>
            )}
          </div>

          <Input
            label="Due Time"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />

          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Estimated Time (Mins)"
            type="number"
            min="10"
            max="1200"
            step="15"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            helperText={`${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`}
          />

          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="completion-progress-slider" className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Progress
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {completionPercentage}%
              </span>
            </div>
            <input
              id="completion-progress-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              value={completionPercentage}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCompletionPercentage(val);
                if (val === 100) setStatus('completed');
                else if (val > 0 && status === 'pending') setStatus('in_progress');
              }}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>

        {/* Subtasks checklist */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Subtasks Checklist
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add actionable subtask step..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          {subtasks.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-200 dark:border-slate-700"
                >
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={st.isCompleted}
                      onChange={() => toggleSubtask(st.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={st.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}>
                      {st.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSubtask(st.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Description & Notes
          </label>
          <textarea
            rows={2}
            value={description}
            placeholder="Important submission criteria, git repository link, or lab instructions..."
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </form>
    </Modal>
  );
}
