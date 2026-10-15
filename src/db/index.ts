import Dexie, { Table } from 'dexie';
import {
  Subject,
  AttendanceRecord,
  Task,
  TimetableSession,
  StudySessionPlan,
  UserSettings,
  InAppNotification,
  AcademicEvent,
  CalendarSource,
  CalendarImport,
  ScheduleChangeLog,
} from '../types';

export class ScholarSyncDB extends Dexie {
  subjects!: Table<Subject, string>;
  attendanceRecords!: Table<AttendanceRecord, string>;
  tasks!: Table<Task, string>;
  timetableSessions!: Table<TimetableSession, string>;
  studyPlans!: Table<StudySessionPlan, string>;
  userSettings!: Table<UserSettings & { id: string }, string>;
  notifications!: Table<InAppNotification, string>;
  // Version 2 stores
  academicEvents!: Table<AcademicEvent, string>;
  calendarSources!: Table<CalendarSource, string>;
  calendarImports!: Table<CalendarImport, string>;
  scheduleChangeLogs!: Table<ScheduleChangeLog, string>;

  constructor() {
    super('ScholarSyncDatabase');

    // Schema version 1
    this.version(1).stores({
      subjects: 'id, semester, academicYear, isArchived, name, createdAt',
      attendanceRecords: 'id, subjectId, date, status, createdAt',
      tasks: 'id, subjectId, dueDate, priority, status, createdAt',
      timetableSessions: 'id, subjectId, dayOfWeek',
      studyPlans: 'id, subjectId, date, isCompleted, createdAt',
      userSettings: 'id',
      notifications: 'id, isRead, createdAt',
    });

    // Schema version 2 - Academic Calendar, Holidays & Website Integration Migration
    this.version(2).stores({
      academicEvents: 'id, eventType, startDate, endDate, sourceType, isUserOverride, reviewStatus, createdAt',
      calendarSources: 'id, sourceType, sourceUrl, lastCheckedAt, createdAt',
      calendarImports: 'id, importTimestamp, status',
      scheduleChangeLogs: 'id, eventId, action, timestamp',
    });
  }
}

export const db = new ScholarSyncDB();

export const DEFAULT_USER_SETTINGS: UserSettings = {
  semester: 'Semester 5',
  academicYear: '2024 - 2025',
  defaultAttendanceThreshold: 75,
  defaultTargetScore: 80,
  studyBudgetHoursPerDay: 3,
  isOnboarded: false,
  theme: 'system',
  browserNotificationsEnabled: false,
  creatorName: 'Angad Ranjan',
  creatorGithubUrl: 'https://github.com/angad-r',
  creatorLinkedinUrl: 'https://in.linkedin.com/in/angad-ranjan-057616380',
};

export async function getUserSettings(): Promise<UserSettings> {
  const record = await db.userSettings.get('settings');
  return record || DEFAULT_USER_SETTINGS;
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = (await db.userSettings.get('settings')) || DEFAULT_USER_SETTINGS;
  const updated = { ...current, ...settings, id: 'settings' };
  await db.userSettings.put(updated);
  return updated;
}
