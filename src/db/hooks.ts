import { useLiveQuery } from 'dexie-react-hooks';
import { db, getUserSettings, DEFAULT_USER_SETTINGS } from './index';
import {
  Subject,
  AttendanceRecord,
  Task,
  TimetableSession,
  StudySessionPlan,
  UserSettings,
  AcademicEvent,
  CalendarSource,
  ScheduleChangeLog,
} from '../types';

export function useSubjects(includeArchived: boolean = false): Subject[] {
  const subjects = useLiveQuery(
    () =>
      db.subjects
        .filter((s) => (includeArchived ? true : !s.isArchived))
        .sortBy('name'),
    [includeArchived]
  );
  return subjects || [];
}

export function useAllSubjects(): Subject[] {
  const subjects = useLiveQuery(() => db.subjects.toArray());
  return subjects || [];
}

export function useAttendanceRecords(subjectId?: string): AttendanceRecord[] {
  const records = useLiveQuery(
    () => {
      if (subjectId) {
        return db.attendanceRecords.where('subjectId').equals(subjectId).reverse().sortBy('date');
      }
      return db.attendanceRecords.reverse().sortBy('date');
    },
    [subjectId]
  );
  return records || [];
}

export function useTasks(): Task[] {
  const tasks = useLiveQuery(() => db.tasks.reverse().sortBy('createdAt'));
  return tasks || [];
}

export function useTimetableSessions(): TimetableSession[] {
  const sessions = useLiveQuery(() => db.timetableSessions.toArray());
  return sessions || [];
}

export function useStudyPlans(): StudySessionPlan[] {
  const plans = useLiveQuery(() => db.studyPlans.orderBy('date').toArray());
  return plans || [];
}

export function useUserSettings(): UserSettings {
  const settings = useLiveQuery(
    async () => {
      return await getUserSettings();
    },
    [],
    DEFAULT_USER_SETTINGS
  );
  return settings || DEFAULT_USER_SETTINGS;
}

// Version 2 Hooks
export function useAcademicEvents(): AcademicEvent[] {
  const events = useLiveQuery(() => db.academicEvents.orderBy('startDate').toArray());
  return events || [];
}

export function useCalendarSources(): CalendarSource[] {
  const sources = useLiveQuery(() => db.calendarSources.toArray());
  return sources || [];
}

export function useScheduleChangeLogs(): ScheduleChangeLog[] {
  const logs = useLiveQuery(() => db.scheduleChangeLogs.reverse().sortBy('timestamp'));
  return logs || [];
}
