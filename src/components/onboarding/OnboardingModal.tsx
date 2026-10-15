import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Sparkles, GraduationCap, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (settings: {
    semester: string;
    academicYear: string;
    defaultAttendanceThreshold: number;
    defaultTargetScore: number;
    studyBudgetHoursPerDay: number;
  }) => Promise<void>;
  onLoadDemoData: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export function OnboardingModal({
  isOpen,
  onComplete,
  onLoadDemoData,
  onSkip,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [semester, setSemester] = useState('Semester 5');
  const [academicYear, setAcademicYear] = useState('2024 - 2025');
  const [threshold, setThreshold] = useState<number>(75);
  const [targetScore, setTargetScore] = useState<number>(85);
  const [studyHours, setStudyHours] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      await onComplete({
        semester,
        academicYear,
        defaultAttendanceThreshold: Number(threshold),
        defaultTargetScore: Number(targetScore),
        studyBudgetHoursPerDay: Number(studyHours),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoClick = async () => {
    setIsSubmitting(true);
    try {
      await onLoadDemoData();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onSkip()}
      title="Welcome to ScholarSync"
      description="Smart Academic Planner & Performance Analyzer for college students."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip Setup
          </Button>

          <div className="flex items-center gap-2">
            {step === 1 ? (
              <Button variant="primary" size="sm" onClick={() => setStep(2)}>
                Next Step <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
                isLoading={isSubmitting}
              >
                Get Started <Check className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 pb-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 1
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}
          >
            1
          </div>
          <div className="w-10 h-0.5 bg-slate-200 dark:bg-slate-700" />
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 2
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}
          >
            2
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-950 dark:text-indigo-200">
                  Quick Term Configuration
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Let's set up your current semester. You can edit this anytime in Settings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Current Semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Semester 5"
              />
              <Input
                label="Academic Year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2024 - 2025"
              />
            </div>

            {/* Quick Demo Button Box */}
            <div className="p-3.5 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Here for a Viva / Demo?
                </p>
                <p className="text-[11px] text-slate-500">
                  Pre-populate complete B.Tech CSE subjects, marks & timetable.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDemoClick}
                isLoading={isSubmitting}
                className="text-indigo-600 border-indigo-300 dark:text-indigo-400"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Load Demo Data
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Configure your academic thresholds and daily study budget:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Attendance Requirement"
                type="number"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                helperText="Standard: 75%"
              />
              <Input
                label="Target Final Score (%)"
                type="number"
                min="0"
                max="100"
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
                helperText="Target percentage"
              />
              <Input
                label="Daily Study Time (Hours)"
                type="number"
                min="1"
                max="8"
                value={studyHours}
                onChange={(e) => setStudyHours(Number(e.target.value))}
                helperText="Daily workload limit"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
