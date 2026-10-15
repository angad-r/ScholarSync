import React, { useState } from 'react';
import {
  Task,
  Subject,
  TimetableSession,
  StudySessionPlan,
  StudyPreferences,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { generateStudySchedule } from '../../lib/studyPlanner';
import {
  CalendarClock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Sliders,
  CheckSquare,
  Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface StudyPlannerViewProps {
  tasks: Task[];
  subjects: Subject[];
  timetableSessions: TimetableSession[];
  studyPlans: StudySessionPlan[];
  onSaveStudyPlans: (plans: StudySessionPlan[]) => Promise<void>;
  onTogglePlanCompletion: (planId: string) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
}

export function StudyPlannerView({
  tasks,
  subjects,
  timetableSessions,
  studyPlans,
  onSaveStudyPlans,
  onTogglePlanCompletion,
  onDeletePlan,
}: StudyPlannerViewProps) {
  const [dailyBudgetHours, setDailyBudgetHours] = useState<number>(3);
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastWarning, setLastWarning] = useState<string | null>(null);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const preferences: StudyPreferences = {
    dailyBudgetMinutes: dailyBudgetHours * 60,
    preferredTimeSlots: [{ start: '18:00', end: '22:00' }],
    availableDays,
    focusPriority: 'deadlines_first',
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = generateStudySchedule(
        tasks,
        subjects,
        timetableSessions,
        preferences,
        studyPlans,
        7 // 7-day planning horizon
      );

      await onSaveStudyPlans(result.plans);
      if (result.warnings.length > 0) {
        setLastWarning(result.warnings[0]);
      } else {
        setLastWarning(null);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleDay = (dayNum: number) => {
    if (availableDays.includes(dayNum)) {
      if (availableDays.length > 1) {
        setAvailableDays(availableDays.filter((d) => d !== dayNum));
      }
    } else {
      setAvailableDays([...availableDays, dayNum].sort());
    }
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const completedSessions = studyPlans.filter((p) => p.isCompleted).length;
  const totalSessions = studyPlans.length;

  return (
    <div className="space-y-6">
      {/* Configuration & Generator Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Deterministic Workload & Study Engine
              </CardTitle>
              <CardDescription>
                Generates a realistic 7-day revision schedule respecting deadlines, difficulty weights, and timetable commitments.
              </CardDescription>
            </div>

            <Button
              variant="primary"
              onClick={handleGenerate}
              isLoading={isGenerating}
              className="shrink-0"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Generate / Rebalance Plan
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily study budget */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="daily-study-budget-slider" className="font-semibold text-slate-800 dark:text-slate-200">
                  Daily Study Budget:
                </label>
                <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                  {dailyBudgetHours} Hours / Day
                </span>
              </div>
              <input
                id="daily-study-budget-slider"
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={dailyBudgetHours}
                onChange={(e) => setDailyBudgetHours(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-500">
                The planner will strictly cap scheduled work to {dailyBudgetHours * 60} minutes per day.
              </p>
            </div>

            {/* Available study days */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                Available Study Days:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {dayNames.map((name, idx) => {
                  const dayNum = idx + 1;
                  const isSelected = availableDays.includes(dayNum);
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => toggleDay(dayNum)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Unchecked days (e.g. weekends or busy club days) will be skipped.
              </p>
            </div>
          </div>

          {lastWarning && (
            <Alert variant="warning" title="Workload Warning">
              {lastWarning}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Study Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <span>Upcoming Scheduled Study Sessions</span>
              <Badge variant="neutral" size="sm">
                {completedSessions} / {totalSessions} Completed
              </Badge>
            </CardTitle>
            <CardDescription>
              Each session includes an objective rationale for why it was scheduled at that time.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {studyPlans.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-xl">
              <CalendarClock className="w-10 h-10 text-indigo-400 mx-auto mb-2 opacity-75" />
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                No Study Sessions Scheduled
              </p>
              <p className="mt-1">
                Click <strong>"Generate / Rebalance Plan"</strong> above to construct your personalized schedule.
              </p>
            </div>
          ) : (
            studyPlans.map((plan) => {
              const subject = subjectMap.get(plan.subjectId);

              return (
                <div
                  key={plan.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                    plan.isCompleted
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 opacity-80'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => onTogglePlanCompletion(plan.id)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                      aria-label="Toggle study session completion"
                    >
                      {plan.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-semibold text-xs sm:text-sm ${
                            plan.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {plan.title}
                        </span>
                        {subject && (
                          <Badge
                            variant="neutral"
                            size="sm"
                            style={{ borderLeftColor: subject.color, borderLeftWidth: '3px' }}
                          >
                            {subject.code || subject.name}
                          </Badge>
                        )}
                        <Badge
                          variant={plan.priority === 'high' ? 'danger' : 'neutral'}
                          size="sm"
                        >
                          {plan.priority.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          {plan.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {plan.startTime} ({plan.durationMinutes} mins)
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5 italic">
                        Why: {plan.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-center">
                    <button
                      onClick={() => onDeletePlan(plan.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Remove session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
