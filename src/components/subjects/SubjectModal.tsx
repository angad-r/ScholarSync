import React, { useState, useEffect } from 'react';
import { Subject, AssessmentComponent, AssessmentType } from '../../types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SUBJECT_COLORS } from '../../lib/utils';
import { validateAssessmentComponents, roundToDecimals } from '../../lib/marksCalculator';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subject: Partial<Subject>) => Promise<void>;
  initialSubject?: Subject | null;
  defaultSemester: string;
  defaultAcademicYear: string;
  defaultThreshold: number;
  defaultTargetScore: number;
}

const ASSESSMENT_TYPES: { label: string; value: AssessmentType }[] = [
  { label: 'Internal Exam / Midterm', value: 'internal' },
  { label: 'Assignment / Homework', value: 'assignment' },
  { label: 'Quiz / Test', value: 'quiz' },
  { label: 'Lab Assessment', value: 'lab' },
  { label: 'Project / Capstone', value: 'project' },
  { label: 'Final End-Sem Exam', value: 'final' },
  { label: 'Other', value: 'other' },
];

export function SubjectModal({
  isOpen,
  onClose,
  onSave,
  initialSubject,
  defaultSemester,
  defaultAcademicYear,
  defaultThreshold,
  defaultTargetScore,
}: SubjectModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [semester, setSemester] = useState(defaultSemester);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [credits, setCredits] = useState<number>(4);
  const [instructor, setInstructor] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(defaultThreshold);
  const [targetScore, setTargetScore] = useState<number>(defaultTargetScore);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState('');

  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSubject) {
      setName(initialSubject.name);
      setCode(initialSubject.code || '');
      setSemester(initialSubject.semester);
      setAcademicYear(initialSubject.academicYear);
      setCredits(initialSubject.credits);
      setInstructor(initialSubject.instructor || '');
      setColor(initialSubject.color);
      setAttendanceThreshold(initialSubject.attendanceThreshold);
      setTargetScore(initialSubject.targetScore);
      setDifficulty(initialSubject.difficulty);
      setNotes(initialSubject.notes || '');
      setComponents(initialSubject.assessmentComponents || []);
    } else {
      setName('');
      setCode('');
      setSemester(defaultSemester);
      setAcademicYear(defaultAcademicYear);
      setCredits(4);
      setInstructor('');
      setColor(SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)]);
      setAttendanceThreshold(defaultThreshold);
      setTargetScore(defaultTargetScore);
      setDifficulty(3);
      setNotes('');
      // Default common B.Tech CSE evaluation scheme template
      setComponents([
        {
          id: `comp-${Date.now()}-1`,
          name: 'Midterm Examination',
          type: 'internal',
          weight: 25,
          maxMarks: 50,
          marksObtained: null,
          dueDate: null,
          isCompleted: false,
          isFinalExam: false,
        },
        {
          id: `comp-${Date.now()}-2`,
          name: 'Assignments & Quizzes',
          type: 'assignment',
          weight: 15,
          maxMarks: 30,
          marksObtained: null,
          dueDate: null,
          isCompleted: false,
          isFinalExam: false,
        },
        {
          id: `comp-${Date.now()}-3`,
          name: 'Laboratory / Project Evaluation',
          type: 'lab',
          weight: 10,
          maxMarks: 20,
          marksObtained: null,
          dueDate: null,
          isCompleted: false,
          isFinalExam: false,
        },
        {
          id: `comp-${Date.now()}-4`,
          name: 'End-Semester Final Examination',
          type: 'final',
          weight: 50,
          maxMarks: 100,
          marksObtained: null,
          dueDate: null,
          isCompleted: false,
          isFinalExam: true,
        },
      ]);
    }
    setErrors({});
  }, [isOpen, initialSubject, defaultSemester, defaultAcademicYear, defaultThreshold, defaultTargetScore]);

  const totalConfiguredWeight = roundToDecimals(
    components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0),
    2
  );

  const addComponent = () => {
    const newComp: AssessmentComponent = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `Assessment ${components.length + 1}`,
      type: 'assignment',
      weight: 10,
      maxMarks: 50,
      marksObtained: null,
      dueDate: null,
      isCompleted: false,
      isFinalExam: false,
    };
    setComponents([...components, newComp]);
  };

  const updateComponent = (index: number, updates: Partial<AssessmentComponent>) => {
    const updated = [...components];
    updated[index] = { ...updated[index], ...updates };
    setComponents(updated);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Subject name is required';
    }

    if (credits < 0) {
      newErrors.credits = 'Credits cannot be negative';
    }

    const valResult = validateAssessmentComponents(components, 100);
    const fatalErrors = valResult.issues.filter((i) => i.severity === 'error');
    if (fatalErrors.length > 0) {
      newErrors.components = fatalErrors.map((e) => e.message).join(' ');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: initialSubject?.id,
        name: name.trim(),
        code: code.trim() || undefined,
        semester,
        academicYear,
        credits: Number(credits),
        instructor: instructor.trim() || undefined,
        color,
        attendanceThreshold: Number(attendanceThreshold),
        targetScore: Number(targetScore),
        difficulty,
        notes: notes.trim() || undefined,
        assessmentComponents: components,
        isArchived: initialSubject?.isArchived ?? false,
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
      title={initialSubject ? 'Edit Subject' : 'Add New Subject'}
      description="Define course details, attendance requirements, and custom evaluation scheme."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSaving} type="submit">
            {initialSubject ? 'Update Subject' : 'Create Subject'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Subject Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Subject Name *"
            placeholder="e.g. Design & Analysis of Algorithms"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="Subject Code"
            placeholder="e.g. CS501"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          />
          <Input
            label="Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
          <Input
            label="Credits"
            type="number"
            min="0"
            max="12"
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            error={errors.credits}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Instructor Name (Optional)"
            placeholder="e.g. Dr. Ramesh Sharma"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
          <Input
            label="Min. Attendance Threshold (%)"
            type="number"
            min="0"
            max="100"
            value={attendanceThreshold}
            onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
            helperText="Standard criteria: 75% or 80%"
          />
          <Input
            label="Target Final Score (%)"
            type="number"
            min="0"
            max="100"
            value={targetScore}
            onChange={(e) => setTargetScore(Number(e.target.value))}
            helperText="Goal for required marks calculation"
          />
        </div>

        {/* Color and Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Color Tag
            </label>
            <div className="flex items-center gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'scale-110 border-slate-900 dark:border-white ring-2 ring-indigo-500' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <Select
            label="Subject Difficulty (For Study Planner)"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
          >
            <option value={1}>1 - Very Easy (Low prep required)</option>
            <option value={2}>2 - Easy</option>
            <option value={3}>3 - Moderate (Standard effort)</option>
            <option value={4}>4 - Hard (Deep conceptual focus)</option>
            <option value={5}>5 - Very Hard (Intensive study needed)</option>
          </Select>
        </div>

        {/* Assessment Structure Configuration */}
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Evaluation & Assessment Scheme
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure components, weights, and max marks. Weights must add up to 100%.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={totalConfiguredWeight === 100 ? 'success' : 'warning'}
                size="md"
              >
                {totalConfiguredWeight === 100 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                )}
                Total Weight: {totalConfiguredWeight}%
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={addComponent}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Component
              </Button>
            </div>
          </div>

          {errors.components && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {errors.components}
            </p>
          )}

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {components.map((comp, idx) => (
              <div
                key={comp.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row gap-2.5 items-start md:items-center"
              >
                <div className="flex-1 w-full md:w-auto">
                  <input
                    type="text"
                    value={comp.name}
                    placeholder="Component Name"
                    onChange={(e) => updateComponent(idx, { name: e.target.value })}
                    className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="w-full md:w-36">
                  <select
                    value={comp.type}
                    onChange={(e) =>
                      updateComponent(idx, {
                        type: e.target.value as AssessmentType,
                        isFinalExam: e.target.value === 'final',
                      })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="w-20">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={comp.weight}
                      placeholder="Weight %"
                      onChange={(e) => updateComponent(idx, { weight: Number(e.target.value) })}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      title="Weight % towards final grade"
                    />
                  </div>
                  <span className="text-xs text-slate-400">% wt</span>

                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      value={comp.maxMarks}
                      placeholder="Max"
                      onChange={(e) => updateComponent(idx, { maxMarks: Number(e.target.value) })}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      title="Maximum raw marks for this assessment"
                    />
                  </div>
                  <span className="text-xs text-slate-400">max</span>

                  <button
                    type="button"
                    onClick={() => removeComponent(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors ml-auto"
                    aria-label="Remove component"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Study Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Subject Notes & Resources (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            placeholder="Important textbook chapters, reference drive links, or focus areas..."
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </form>
    </Modal>
  );
}
