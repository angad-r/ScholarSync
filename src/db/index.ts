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
};

export async function getUserSettings(): Promise<UserSettings> {
  const record = await db.userSettings.get('settings');
  if (!record) return DEFAULT_USER_SETTINGS;
  const { id: _id, creatorName: _c1, creatorGithubUrl: _c2, creatorLinkedinUrl: _c3, ...clean } = record as any;
  return clean as UserSettings;
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = (await db.userSettings.get('settings')) || DEFAULT_USER_SETTINGS;
  // Ensure platform creator properties can never be injected or overwritten via user settings
  const { creatorName: _c1, creatorGithubUrl: _c2, creatorLinkedinUrl: _c3, ...cleanSettings } = settings as any;
  const updated: UserSettings & { id: string } = {
    ...current,
    ...cleanSettings,
    id: 'settings',
  };
  delete (updated as any).creatorName;
  delete (updated as any).creatorGithubUrl;
  delete (updated as any).creatorLinkedinUrl;
  await db.userSettings.put(updated);
  return updated;
}
