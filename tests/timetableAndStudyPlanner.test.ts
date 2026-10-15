import { describe, it, expect } from 'vitest';
import { detectTimetableConflicts, intervalsOverlap } from '../src/lib/timetableConflict';
import { generateStudySchedule, calculateTaskUrgencyScore } from '../src/lib/studyPlanner';
import { generateSystemAlerts } from '../src/lib/notificationService';
import { TimetableSession, Task, Subject, StudyPreferences } from '../src/types';
import { format, subDays, addDays } from 'date-fns';

describe('Timetable Conflict & Study Planner Engine', () => {
  it('12. detects overlapping timetable sessions on the same day', () => {
    const sessions: TimetableSession[] = [
      {
        id: 's1',
        subjectId: 'sub-1',
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '10:30',
        type: 'lecture',
      },
      {
        id: 's2',
        subjectId: 'sub-2',
        dayOfWeek: 1, // Monday
        startTime: '10:00',
        endTime: '11:00',
        type: 'lecture',
      },
    ];

    const conflicts = detectTimetableConflicts(sessions, {
      'sub-1': 'Algorithms',
      'sub-2': 'Operating Systems',
    });

    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe('overlap');
    expect(conflicts[0].reason).toContain('overlaps with');
  });

  it('detects invalid time window where start time is at or after end time', () => {
    const invalidSession: TimetableSession[] = [
      {
        id: 's1',
        subjectId: 'sub-1',
        dayOfWeek: 2,
        startTime: '11:00',
        endTime: '10:00',
        type: 'lecture',
      },
    ];

    const conflicts = detectTimetableConflicts(invalidSession);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe('invalid_time');
  });

  it('13. prioritizes urgent and difficult tasks in study planner', () => {
    const today = new Date();
    const taskUrgent: Task = {
      id: 't1',
      subjectId: 'sub-1',
      title: 'Operating Systems Midterm Revision',
      description: '',
      dueDate: format(addDays(today, 1), 'yyyy-MM-dd'),
      dueTime: '10:00',
      priority: 'high',
      status: 'pending',
      estimatedMinutes: 60,
      completionPercentage: 0,
      subtasks: [],
      category: 'exam_prep',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const taskLater: Task = {
      id: 't2',
      subjectId: 'sub-2',
      title: 'Future Reading Assignment',
      description: '',
      dueDate: format(addDays(today, 14), 'yyyy-MM-dd'),
      dueTime: null,
      priority: 'low',
      status: 'pending',
      estimatedMinutes: 60,
      completionPercentage: 0,
      subtasks: [],
      category: 'reading',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const subjectHighDiff: Subject = {
      id: 'sub-1',
      name: 'Operating Systems',
      semester: 'Sem 5',
      academicYear: '2024-2025',
      credits: 4,
      color: '#0284c7',
      attendanceThreshold: 75,
      targetScore: 80,
      difficulty: 5,
      assessmentComponents: [],
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    };

    const scoreUrgent = calculateTaskUrgencyScore(taskUrgent, subjectHighDiff, today);
    const scoreLater = calculateTaskUrgencyScore(taskLater, undefined, today);

    expect(scoreUrgent.score).toBeGreaterThan(scoreLater.score);
  });

  it('14. respects daily study budget and detects workload overload', () => {
    const today = new Date();
    const tasks: Task[] = [
      {
        id: 't1',
        subjectId: 'sub-1',
        title: 'Huge Project',
        description: '',
        dueDate: format(addDays(today, 2), 'yyyy-MM-dd'),
        dueTime: null,
        priority: 'high',
        status: 'pending',
        estimatedMinutes: 1200, // 20 hours!
        completionPercentage: 0,
        subtasks: [],
        category: 'project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const prefs: StudyPreferences = {
      dailyBudgetMinutes: 60, // Only 1 hour per day
      preferredTimeSlots: [{ start: '18:00', end: '19:00' }],
      availableDays: [1, 2, 3, 4, 5, 6, 7],
      focusPriority: 'deadlines_first',
    };

    const result = generateStudySchedule(tasks, [], [], prefs, [], 7);
    expect(result.isOverloaded).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Workload exceeds declared capacity');
  });

  it('15. detects overdue tasks in system alerts generator', () => {
    const today = new Date();
    const overdueTask: Task = {
      id: 't-overdue',
      subjectId: null,
      title: 'Overdue Assignment Submission',
      description: '',
      dueDate: format(subDays(today, 3), 'yyyy-MM-dd'), // 3 days ago!
      dueTime: null,
      priority: 'high',
      status: 'pending',
      estimatedMinutes: 45,
      completionPercentage: 0,
      subtasks: [],
      category: 'assignment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const alerts = generateSystemAlerts([overdueTask], []);
    expect(alerts.some((a) => a.category === 'deadline' && a.title.includes('Task Overdue'))).toBe(true);
  });
});
