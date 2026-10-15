import { z } from 'zod';
import { db, updateUserSettings } from './index';
import { Subject, AttendanceRecord, Task, TimetableSession, StudySessionPlan, UserSettings, AcademicEvent } from '../types';

export const CURRENT_BACKUP_SCHEMA_VERSION = 2;

// Zod schemas for strict JSON validation
const AssessmentComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['internal', 'assignment', 'quiz', 'lab', 'project', 'final', 'other']),
  weight: z.number().min(0),
  maxMarks: z.number().positive(),
  marksObtained: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  isCompleted: z.boolean(),
  isFinalExam: z.boolean(),
  notes: z.string().optional(),
});

const SubjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  semester: z.string().min(1),
  academicYear: z.string().min(1),
  credits: z.number().min(0),
  instructor: z.string().optional(),
  color: z.string().min(1),
  attendanceThreshold: z.number().min(0).max(100),
  targetScore: z.number().min(0).max(100),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  assessmentComponents: z.array(AssessmentComponentSchema),
  notes: z.string().optional(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const AttendanceRecordSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string(),
  status: z.enum(['present', 'absent', 'cancelled']),
  sessionType: z.enum(['lecture', 'lab', 'tutorial', 'study', 'break', 'free_period']),
  notes: z.string().optional(),
  createdAt: z.string(),
});

const SubTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  isCompleted: z.boolean(),
});

const TaskSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string(),
  dueDate: z.string(),
  dueTime: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  estimatedMinutes: z.number().min(0),
  completionPercentage: z.number().min(0).max(100),
  subtasks: z.array(SubTaskSchema).optional().default([]),
  category: z.enum(['assignment', 'exam_prep', 'project', 'reading', 'other']),
  notes: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const TimetableSessionSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().optional().default(''),
  customTitle: z.string().optional(),
  dayOfWeek: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  startTime: z.string(),
  endTime: z.string(),
  type: z.enum(['lecture', 'lab', 'tutorial', 'study', 'break', 'free_period']),
  room: z.string().optional(),
  notes: z.string().optional(),
});

const StudySessionPlanSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().nullable().optional(),
  subjectId: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  durationMinutes: z.number().positive(),
  title: z.string().min(1),
  reason: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  isCompleted: z.boolean(),
  createdAt: z.string(),
});

const AcademicEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  eventType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  allDay: z.boolean().default(true),
  affectedSubjectIds: z.array(z.string()).optional(),
  description: z.string().optional(),
  sourceType: z.string().default('manual_entry'),
  sourceName: z.string().optional(),
  isUserOverride: z.boolean().default(false),
  confidence: z.number().optional(),
  reviewStatus: z.string().optional(),
  recurrence: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BackupFileSchema = z.object({
  appName: z.literal('ScholarSync'),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  data: z.object({
    subjects: z.array(SubjectSchema),
    attendanceRecords: z.array(AttendanceRecordSchema),
    tasks: z.array(TaskSchema),
    timetableSessions: z.array(TimetableSessionSchema),
    studyPlans: z.array(StudySessionPlanSchema),
    academicEvents: z.array(AcademicEventSchema).optional().default([]),
    userSettings: z.any().optional(),
  }),
});

export type BackupFilePayload = z.infer<typeof BackupFileSchema>;

export interface ImportPreview {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  schemaVersion: number;
  exportedAt: string;
  counts: {
    subjects: number;
    attendanceRecords: number;
    tasks: number;
    timetableSessions: number;
    studyPlans: number;
    academicEvents?: number;
  };
  hasDuplicateIdsWithExisting: boolean;
  duplicateIdsCount: number;
  parsedData: BackupFilePayload | null;
}

/**
 * Exports entire database into a JSON string formatted file.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const [subjects, attendanceRecords, tasks, timetableSessions, studyPlans, events, settings] = await Promise.all([
    db.subjects.toArray(),
    db.attendanceRecords.toArray(),
    db.tasks.toArray(),
    db.timetableSessions.toArray(),
    db.studyPlans.toArray(),
    db.academicEvents.toArray(),
    db.userSettings.get('settings'),
  ]);

  let sanitizedSettings: UserSettings | undefined;
  if (settings) {
    const { id: _id, creatorName: _c1, creatorGithubUrl: _c2, creatorLinkedinUrl: _c3, ...clean } = settings as any;
    sanitizedSettings = clean as UserSettings;
  }

  const payload: BackupFilePayload = {
    appName: 'ScholarSync',
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      subjects,
      attendanceRecords,
      tasks,
      timetableSessions,
      studyPlans,
      academicEvents: events,
      userSettings: sanitizedSettings,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Validates a JSON backup file content and produces a preview without altering DB.
 */
export async function validateAndPreviewImport(rawJson: string): Promise<ImportPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawJson);
  } catch (err: any) {
    return {
      isValid: false,
      errors: [`Invalid JSON formatting: ${err.message}`],
      warnings: [],
      schemaVersion: 0,
      exportedAt: '',
      counts: { subjects: 0, attendanceRecords: 0, tasks: 0, timetableSessions: 0, studyPlans: 0, academicEvents: 0 },
      hasDuplicateIdsWithExisting: false,
      duplicateIdsCount: 0,
      parsedData: null,
    };
  }

  const result = BackupFileSchema.safeParse(parsedRaw);
  if (!result.success) {
    const formattedErrors = result.error.errors.map(
      (e) => `Field [${e.path.join('.')}]: ${e.message}`
    );
    return {
      isValid: false,
      errors: formattedErrors.slice(0, 8),
      warnings: [],
      schemaVersion: (parsedRaw as any)?.schemaVersion ?? 0,
      exportedAt: (parsedRaw as any)?.exportedAt ?? '',
      counts: { subjects: 0, attendanceRecords: 0, tasks: 0, timetableSessions: 0, studyPlans: 0, academicEvents: 0 },
      hasDuplicateIdsWithExisting: false,
      duplicateIdsCount: 0,
      parsedData: null,
    };
  }

  const payload = result.data;
  if (payload.schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION) {
    warnings.push(
      `Backup was created with newer schema version (${payload.schemaVersion}). Some fields might be omitted.`
    );
  } else if (payload.schemaVersion < CURRENT_BACKUP_SCHEMA_VERSION) {
    warnings.push(
      `Backup is from older schema Version ${payload.schemaVersion}. It has been migrated to Version ${CURRENT_BACKUP_SCHEMA_VERSION}.`
    );
  }

  // Check duplicate IDs against current database
  const [existingSubIds, existingAttIds, existingTaskIds, existingTtIds, existingPlanIds, existingEventIds] = await Promise.all([
    db.subjects.toCollection().primaryKeys(),
    db.attendanceRecords.toCollection().primaryKeys(),
    db.tasks.toCollection().primaryKeys(),
    db.timetableSessions.toCollection().primaryKeys(),
    db.studyPlans.toCollection().primaryKeys(),
    db.academicEvents.toCollection().primaryKeys(),
  ]);

  const existingSet = new Set([
    ...existingSubIds,
    ...existingAttIds,
    ...existingTaskIds,
    ...existingTtIds,
    ...existingPlanIds,
    ...existingEventIds,
  ]);

  let duplicateCount = 0;
  for (const s of payload.data.subjects) if (existingSet.has(s.id)) duplicateCount++;
  for (const a of payload.data.attendanceRecords) if (existingSet.has(a.id)) duplicateCount++;
  for (const t of payload.data.tasks) if (existingSet.has(t.id)) duplicateCount++;
  for (const tt of payload.data.timetableSessions) if (existingSet.has(tt.id)) duplicateCount++;
  for (const p of payload.data.studyPlans) if (existingSet.has(p.id)) duplicateCount++;
  if (payload.data.academicEvents) {
    for (const e of payload.data.academicEvents) if (existingSet.has(e.id)) duplicateCount++;
  }

  if (duplicateCount > 0) {
    warnings.push(
      `Found ${duplicateCount} item(s) with identical IDs to existing items. Merging will update existing records.`
    );
  }

  return {
    isValid: true,
    errors,
    warnings,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    counts: {
      subjects: payload.data.subjects.length,
      attendanceRecords: payload.data.attendanceRecords.length,
      tasks: payload.data.tasks.length,
      timetableSessions: payload.data.timetableSessions.length,
      studyPlans: payload.data.studyPlans.length,
      academicEvents: payload.data.academicEvents?.length || 0,
    },
    hasDuplicateIdsWithExisting: duplicateCount > 0,
    duplicateIdsCount: duplicateCount,
    parsedData: payload,
  };
}

/**
 * Applies a validated backup payload into the database.
 */
export async function applyImport(
  payload: BackupFilePayload,
  mode: 'replace' | 'merge'
): Promise<void> {
  await db.transaction(
    'rw',
    [db.subjects, db.attendanceRecords, db.tasks, db.timetableSessions, db.studyPlans, db.academicEvents, db.userSettings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.subjects.clear(),
          db.attendanceRecords.clear(),
          db.tasks.clear(),
          db.timetableSessions.clear(),
          db.studyPlans.clear(),
          db.academicEvents.clear(),
        ]);
      }

      await Promise.all([
        db.subjects.bulkPut(payload.data.subjects),
        db.attendanceRecords.bulkPut(payload.data.attendanceRecords),
        db.tasks.bulkPut(payload.data.tasks),
        db.timetableSessions.bulkPut(payload.data.timetableSessions),
        db.studyPlans.bulkPut(payload.data.studyPlans),
        payload.data.academicEvents && payload.data.academicEvents.length > 0
          ? db.academicEvents.bulkPut(payload.data.academicEvents as any)
          : Promise.resolve(),
      ]);

      if (payload.data.userSettings) {
        const { creatorName: _c1, creatorGithubUrl: _c2, creatorLinkedinUrl: _c3, ...cleanSettings } = payload.data.userSettings as any;
        await updateUserSettings(cleanSettings);
      }
    }
  );
}

/**
 * Resets the entire database safely.
 */
export async function resetDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.subjects,
      db.attendanceRecords,
      db.tasks,
      db.timetableSessions,
      db.studyPlans,
      db.academicEvents,
      db.calendarSources,
      db.calendarImports,
      db.scheduleChangeLogs,
      db.userSettings,
      db.notifications,
    ],
    async () => {
      await Promise.all([
        db.subjects.clear(),
        db.attendanceRecords.clear(),
        db.tasks.clear(),
        db.timetableSessions.clear(),
        db.studyPlans.clear(),
        db.academicEvents.clear(),
        db.calendarSources.clear(),
        db.calendarImports.clear(),
        db.scheduleChangeLogs.clear(),
        db.userSettings.clear(),
        db.notifications.clear(),
      ]);
    }
  );
}

/**
 * CSV Generation Helpers
 */
export function generateSubjectsCsv(subjects: Subject[]): string {
  const headers = ['ID', 'Name', 'Code', 'Semester', 'Academic Year', 'Credits', 'Instructor', 'Target %', 'Threshold %', 'Difficulty'];
  const rows = subjects.map((s) => [
    `"${s.id}"`,
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.code || ''}"`,
    `"${s.semester}"`,
    `"${s.academicYear}"`,
    s.credits,
    `"${s.instructor || ''}"`,
    s.targetScore,
    s.attendanceThreshold,
    s.difficulty,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateTasksCsv(tasks: Task[], subjects: Subject[]): string {
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const headers = ['Task ID', 'Title', 'Subject', 'Due Date', 'Due Time', 'Priority', 'Status', 'Estimated Mins', 'Completion %'];
  const rows = tasks.map((t) => [
    `"${t.id}"`,
    `"${t.title.replace(/"/g, '""')}"`,
    `"${(t.subjectId ? subjectMap.get(t.subjectId) : '') || 'General'}"`,
    `"${t.dueDate}"`,
    `"${t.dueTime || ''}"`,
    `"${t.priority}"`,
    `"${t.status}"`,
    t.estimatedMinutes,
    t.completionPercentage,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateAttendanceCsv(records: AttendanceRecord[], subjects: Subject[]): string {
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const headers = ['Record ID', 'Date', 'Subject', 'Status', 'Session Type', 'Notes'];
  const rows = records.map((r) => [
    `"${r.id}"`,
    `"${r.date}"`,
    `"${subjectMap.get(r.subjectId) || r.subjectId}"`,
    `"${r.status}"`,
    `"${r.sessionType}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateAcademicEventsCsv(events: AcademicEvent[]): string {
  const headers = ['Event ID', 'Title', 'Event Type', 'Start Date', 'End Date', 'All Day', 'Source', 'User Override', 'Notes'];
  const rows = events.map((e) => [
    `"${e.id}"`,
    `"${e.title.replace(/"/g, '""')}"`,
    `"${e.eventType}"`,
    `"${e.startDate}"`,
    `"${e.endDate}"`,
    e.allDay ? 'Yes' : 'No',
    `"${e.sourceName || e.sourceType}"`,
    e.isUserOverride ? 'Yes' : 'No',
    `"${(e.notes || '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
