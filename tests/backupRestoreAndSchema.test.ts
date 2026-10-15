import { describe, it, expect } from 'vitest';
import {
  validateAndPreviewImport,
  generateSubjectsCsv,
  generateTasksCsv,
  generateAttendanceCsv,
  CURRENT_BACKUP_SCHEMA_VERSION,
} from '../src/db/backupRestore';
import { Subject, Task, AttendanceRecord } from '../src/types';

describe('Data Storage, Backup, and Recovery Engine', () => {
  it('16. validates a properly structured JSON backup file', async () => {
    const validPayload = {
      appName: 'ScholarSync',
      schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        subjects: [
          {
            id: 'sub-test',
            name: 'Data Structures',
            code: 'CS201',
            semester: 'Sem 3',
            academicYear: '2024-2025',
            credits: 4,
            color: '#4f46e5',
            attendanceThreshold: 75,
            targetScore: 85,
            difficulty: 3,
            assessmentComponents: [],
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        attendanceRecords: [],
        tasks: [],
        timetableSessions: [],
        studyPlans: [],
      },
    };

    const preview = await validateAndPreviewImport(JSON.stringify(validPayload));
    expect(preview.isValid).toBe(true);
    expect(preview.counts.subjects).toBe(1);
    expect(preview.errors.length).toBe(0);
  });

  it('17. rejects malformed JSON and unsupported schemas with clear error messages', async () => {
    // Completely invalid JSON syntax
    const malformed = '{ not valid json syntax }';
    const preview1 = await validateAndPreviewImport(malformed);
    expect(preview1.isValid).toBe(false);
    expect(preview1.errors[0]).toContain('Invalid JSON formatting');

    // Missing required fields
    const missingFields = JSON.stringify({
      appName: 'WrongApp',
      schemaVersion: 1,
      exportedAt: 'now',
      data: {},
    });
    const preview2 = await validateAndPreviewImport(missingFields);
    expect(preview2.isValid).toBe(false);
  });

  it('18. generates valid CSV format for subjects, tasks, and attendance', () => {
    const subjects: Subject[] = [
      {
        id: 's1',
        name: 'Database Systems, "Advanced"',
        code: 'CS503',
        semester: 'Sem 5',
        academicYear: '2024-2025',
        credits: 4,
        instructor: 'Dr. Kumar',
        color: '#059669',
        attendanceThreshold: 75,
        targetScore: 85,
        difficulty: 3,
        assessmentComponents: [],
        isArchived: false,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const tasks: Task[] = [
      {
        id: 't1',
        subjectId: 's1',
        title: 'SQL Normalization Lab',
        description: '',
        dueDate: '2026-10-20',
        dueTime: '23:59',
        priority: 'high',
        status: 'pending',
        estimatedMinutes: 90,
        completionPercentage: 50,
        subtasks: [],
        category: 'assignment',
        completedAt: null,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const records: AttendanceRecord[] = [
      {
        id: 'a1',
        subjectId: 's1',
        date: '2026-10-14',
        status: 'present',
        sessionType: 'lecture',
        createdAt: '',
      },
    ];

    const subCsv = generateSubjectsCsv(subjects);
    expect(subCsv).toContain('Name');
    expect(subCsv).toContain('CS503');

    const taskCsv = generateTasksCsv(tasks, subjects);
    expect(taskCsv).toContain('SQL Normalization Lab');
    expect(taskCsv).toContain('high');

    const attCsv = generateAttendanceCsv(records, subjects);
    expect(attCsv).toContain('present');
    expect(attCsv).toContain('lecture');
  });
});
