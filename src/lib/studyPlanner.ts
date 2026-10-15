import {
  Task,
  Subject,
  TimetableSession,
  StudySessionPlan,
  StudyPreferences,
  Priority,
  AcademicEvent,
} from '../types';
import { timeToMinutes, intervalsOverlap } from './timetableConflict';
import { addDays, format, parseISO, differenceInDays, isBefore, startOfToday } from 'date-fns';

export interface PlannedStudyBlock {
  date: string; // YYYY-MM-DD
  startTime: string; // "18:00"
  durationMinutes: number;
  taskId: string | null;
  subjectId: string;
  title: string;
  priority: Priority;
  reason: string;
}

export interface StudyPlanGenerationResult {
  plans: StudySessionPlan[];
  warnings: string[];
  totalWorkloadMinutes: number;
  availableCapacityMinutes: number;
  isOverloaded: boolean;
  prioritizedTasksCount: number;
  deferredTasksCount: number;
  rescheduledCount?: number;
}

/**
 * Calculates priority weight score for deterministic scheduling.
 * Factor in task deadlines, priorities, subject difficulty, and upcoming examination events.
 */
export function calculateTaskUrgencyScore(
  task: Task,
  subject?: Subject,
  referenceDate: Date = new Date(),
  upcomingExams: AcademicEvent[] = []
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const taskDueDate = parseISO(task.dueDate);
  const daysUntilDue = differenceInDays(taskDueDate, referenceDate);

  if (daysUntilDue < 0) {
    score += 100;
    reasons.push('Overdue task requiring immediate completion');
  } else if (daysUntilDue <= 1) {
    score += 80;
    reasons.push('Due within 24-48 hours');
  } else if (daysUntilDue <= 3) {
    score += 50;
    reasons.push('Due in 3 days');
  } else if (daysUntilDue <= 7) {
    score += 25;
    reasons.push('Due this week');
  } else {
    score += Math.max(5, 20 - daysUntilDue);
  }

  // Priority bonus
  if (task.priority === 'high') {
    score += 40;
    reasons.push('High priority');
  } else if (task.priority === 'medium') {
    score += 20;
    reasons.push('Medium priority');
  } else {
    score += 5;
    reasons.push('Low priority');
  }

  // Subject difficulty bonus
  if (subject) {
    const diffBonus = subject.difficulty * 6;
    score += diffBonus;
    if (subject.difficulty >= 4) {
      reasons.push(`High subject difficulty (${subject.difficulty}/5)`);
    }

    // Check if there is an upcoming exam for this subject in academic calendar
    const hasUpcomingSubjectExam = upcomingExams.some((ex) => {
      if (ex.affectedSubjectIds && ex.affectedSubjectIds.includes(subject.id)) return true;
      if (ex.title.toLowerCase().includes(subject.name.toLowerCase())) return true;
      if (subject.code && ex.title.toLowerCase().includes(subject.code.toLowerCase())) return true;
      return false;
    });

    if (hasUpcomingSubjectExam) {
      score += 45;
      reasons.push('Scheduled university examination approaching');
    }
  }

  // Category bonus
  if (task.category === 'exam_prep') {
    score += 30;
    reasons.push('Examination preparation');
  }

  return {
    score,
    reason: reasons.join(' • '),
  };
}

/**
 * Generates study sessions deterministically over the next N days.
 * Strictly respects holidays and closures from the academic calendar.
 */
export function generateStudySchedule(
  tasks: Task[],
  subjects: Subject[],
  existingSessions: TimetableSession[],
  preferences: StudyPreferences,
  existingPlans: StudySessionPlan[] = [],
  planningHorizonDays: number = 7,
  academicEvents: AcademicEvent[] = []
): StudyPlanGenerationResult {
  const warnings: string[] = [];
  const subjectMap = new Map<string, Subject>(subjects.map((s) => [s.id, s]));

  // Retain completed sessions from existing plans
  const preservedPlans = existingPlans.filter((p) => p.isCompleted);

  // Filter tasks that need planning
  const activeTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );

  // Extract upcoming exam events from calendar
  const upcomingExams = academicEvents.filter(
    (e) => e.eventType === 'rescheduled_exam' || e.eventType === 'postponed_exam'
  );

  // Rank tasks by urgency score
  const today = startOfToday();
  const rankedTasks = activeTasks
    .map((task) => {
      const subject = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
      const { score, reason } = calculateTaskUrgencyScore(task, subject, today, upcomingExams);
      const remainingMinutes = Math.max(
        15,
        Math.round(task.estimatedMinutes * (1 - (task.completionPercentage || 0) / 100))
      );
      return { task, subject, score, reason, remainingMinutes };
    })
    .sort((a, b) => b.score - a.score);

  const totalWorkloadMinutes = rankedTasks.reduce((sum, item) => sum + item.remainingMinutes, 0);

  // Helper to check if a specific date is a blocked holiday/closure
  const isDateBlocked = (dateStr: string): boolean => {
    return academicEvents.some((ev) => {
      if (
        ev.eventType === 'official_holiday' ||
        ev.eventType === 'user_holiday' ||
        ev.eventType === 'college_closure' ||
        ev.eventType === 'vacation_break'
      ) {
        return dateStr >= ev.startDate && dateStr <= ev.endDate;
      }
      return false;
    });
  };

  // Calculate total available capacity over horizon excluding holidays
  let availableDaysCount = 0;
  let blockedHolidayDaysCount = 0;

  for (let d = 0; d < planningHorizonDays; d++) {
    const targetDate = addDays(today, d);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const dayOfWeek = ((targetDate.getDay() + 6) % 7) + 1; // 1 = Monday, 7 = Sunday

    if (isDateBlocked(dateStr)) {
      blockedHolidayDaysCount++;
    } else if (preferences.availableDays.includes(dayOfWeek)) {
      availableDaysCount++;
    }
  }

  if (blockedHolidayDaysCount > 0) {
    warnings.push(
      `Detected ${blockedHolidayDaysCount} official/user holiday(s) in the planning horizon. Study sessions avoided on those dates.`
    );
  }

  const availableCapacityMinutes = availableDaysCount * preferences.dailyBudgetMinutes;
  const isOverloaded = totalWorkloadMinutes > availableCapacityMinutes;

  if (isOverloaded) {
    const deficitHours = Math.round((totalWorkloadMinutes - availableCapacityMinutes) / 60);
    warnings.push(
      `Workload exceeds declared capacity by ${deficitHours} hour(s) over the next ${planningHorizonDays} days. High-priority tasks prioritized; non-critical items deferred.`
    );
  }

  const newPlans: StudySessionPlan[] = [];
  let prioritizedTasksCount = 0;
  let deferredTasksCount = 0;

  // Track scheduled minutes per day
  const dailyScheduledMinutes = new Map<string, number>();

  const defaultStartMinutes = 18 * 60; // 6:00 PM default start

  for (const item of rankedTasks) {
    let taskMinutesRemaining = item.remainingMinutes;
    let scheduledForThisTask = false;

    const taskDueDate = parseISO(item.task.dueDate);

    for (let dayOffset = 0; dayOffset < planningHorizonDays && taskMinutesRemaining > 0; dayOffset++) {
      const targetDate = addDays(today, dayOffset);
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const dayOfWeek = ((targetDate.getDay() + 6) % 7) + 1;

      // 1. Check if day is an available study day
      if (!preferences.availableDays.includes(dayOfWeek)) continue;

      // 2. Check if day is explicitly blocked by holiday or college closure
      if (isDateBlocked(dateStr)) continue;

      // 3. Check if past deadline
      if (isBefore(taskDueDate, targetDate) && differenceInDays(targetDate, taskDueDate) > 0) {
        continue;
      }

      const currentDayUsage = dailyScheduledMinutes.get(dateStr) || 0;
      const dayCapacityRemaining = preferences.dailyBudgetMinutes - currentDayUsage;

      if (dayCapacityRemaining <= 15) continue; // Day is full

      // Allocate session block (between 30 to 90 min)
      const sessionDuration = Math.min(taskMinutesRemaining, Math.min(dayCapacityRemaining, 90));

      if (sessionDuration < 15) continue;

      const proposedStartMinutes = defaultStartMinutes + currentDayUsage;
      const proposedEndMinutes = proposedStartMinutes + sessionDuration;

      // Check timetable conflict
      const dayTimetable = existingSessions.filter((s) => s.dayOfWeek === dayOfWeek);
      const hasConflict = dayTimetable.some((session) => {
        if (session.type === 'free_period') return false;
        const sStart = timeToMinutes(session.startTime);
        const sEnd = timeToMinutes(session.endTime);
        return intervalsOverlap(proposedStartMinutes, proposedEndMinutes, sStart, sEnd);
      });

      const startTimeStr = `${Math.floor(proposedStartMinutes / 60)
        .toString()
        .padStart(2, '0')}:${(proposedStartMinutes % 60).toString().padStart(2, '0')}`;

      newPlans.push({
        id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        taskId: item.task.id,
        subjectId: item.subject?.id || item.task.subjectId || 'general',
        date: dateStr,
        startTime: startTimeStr,
        durationMinutes: sessionDuration,
        title: `${item.task.title} (${sessionDuration}m session)`,
        reason: item.reason + (hasConflict ? ' [Note: Clashes with timetable slot]' : ''),
        priority: item.task.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      });

      dailyScheduledMinutes.set(dateStr, currentDayUsage + sessionDuration);
      taskMinutesRemaining -= sessionDuration;
      scheduledForThisTask = true;
    }

    if (scheduledForThisTask) {
      prioritizedTasksCount++;
    } else {
      deferredTasksCount++;
    }
  }

  const combinedPlans = [...preservedPlans, ...newPlans];

  return {
    plans: combinedPlans,
    warnings,
    totalWorkloadMinutes,
    availableCapacityMinutes,
    isOverloaded,
    prioritizedTasksCount,
    deferredTasksCount,
  };
}
