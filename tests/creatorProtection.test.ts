import { describe, it, expect, beforeEach } from 'vitest';
import { PLATFORM_CREATOR } from '../src/config/creator';
import { db, getUserSettings, updateUserSettings, DEFAULT_USER_SETTINGS } from '../src/db';
import {
  exportDatabaseToJson,
  applyImport,
  resetDatabase,
  CURRENT_BACKUP_SCHEMA_VERSION,
  BackupFilePayload,
} from '../src/db/backupRestore';

describe('Platform Creator Profile & Identity Protection', () => {
  beforeEach(async () => {
    await db.userSettings.clear();
    await db.subjects.clear();
    await db.tasks.clear();
  });

  it('1. verifies PLATFORM_CREATOR contains correct official details and is frozen', () => {
    expect(PLATFORM_CREATOR.name).toBe('Angad Ranjan');
    expect(PLATFORM_CREATOR.githubUrl).toBe('https://github.com/angad-r');
    expect(PLATFORM_CREATOR.linkedinUrl).toBe('https://in.linkedin.com/in/angad-ranjan-057616380');

    expect(Object.isFrozen(PLATFORM_CREATOR)).toBe(true);

    // In JavaScript/TypeScript, mutating a frozen object should fail or throw
    expect(() => {
      (PLATFORM_CREATOR as any).name = 'Imposter User';
    }).toThrow();

    expect(() => {
      (PLATFORM_CREATOR as any).githubUrl = 'https://github.com/imposter';
    }).toThrow();

    expect(() => {
      (PLATFORM_CREATOR as any).linkedinUrl = 'https://linkedin.com/in/imposter';
    }).toThrow();

    expect(PLATFORM_CREATOR.name).toBe('Angad Ranjan');
  });

  it('2. ensures updateUserSettings cannot overwrite or inject creator identity into database', async () => {
    // Attempt to pass unauthorized creator properties via user settings update
    await updateUserSettings({
      semester: 'Semester 6',
      academicYear: '2025 - 2026',
      ...({
        creatorName: 'Hacker Name',
        creatorGithubUrl: 'https://github.com/hacker',
        creatorLinkedinUrl: 'https://linkedin.com/in/hacker',
      } as any),
    });

    const settings = await getUserSettings();
    expect(settings.semester).toBe('Semester 6');
    expect(settings.academicYear).toBe('2025 - 2026');

    // Confirm creator properties are not present on user settings
    expect((settings as any).creatorName).toBeUndefined();
    expect((settings as any).creatorGithubUrl).toBeUndefined();
    expect((settings as any).creatorLinkedinUrl).toBeUndefined();

    // Raw database inspection
    const rawDbRecord = await db.userSettings.get('settings');
    expect((rawDbRecord as any)?.creatorName).toBeUndefined();
    expect((rawDbRecord as any)?.creatorGithubUrl).toBeUndefined();
    expect((rawDbRecord as any)?.creatorLinkedinUrl).toBeUndefined();

    // Platform creator constant remains untouched
    expect(PLATFORM_CREATOR.name).toBe('Angad Ranjan');
  });

  it('3. ensures personal data import cannot overwrite platform creator details', async () => {
    const maliciousPayload: BackupFilePayload = {
      appName: 'ScholarSync',
      schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        subjects: [],
        attendanceRecords: [],
        tasks: [],
        timetableSessions: [],
        studyPlans: [],
        academicEvents: [],
        userSettings: {
          semester: 'Semester 7',
          academicYear: '2026 - 2027',
          defaultAttendanceThreshold: 80,
          defaultTargetScore: 90,
          studyBudgetHoursPerDay: 4,
          isOnboarded: true,
          theme: 'dark',
          browserNotificationsEnabled: true,
          ...({
            creatorName: 'Fake Author',
            creatorGithubUrl: 'https://github.com/fakeauthor',
            creatorLinkedinUrl: 'https://linkedin.com/in/fakeauthor',
          } as any),
        },
      },
    };

    await applyImport(maliciousPayload, 'replace');

    // Verify imported user settings were applied
    const settings = await getUserSettings();
    expect(settings.semester).toBe('Semester 7');
    expect(settings.defaultAttendanceThreshold).toBe(80);

    // Verify creator details were stripped and not saved
    expect((settings as any).creatorName).toBeUndefined();
    expect((settings as any).creatorGithubUrl).toBeUndefined();
    expect((settings as any).creatorLinkedinUrl).toBeUndefined();

    // Verify PLATFORM_CREATOR constant is intact
    expect(PLATFORM_CREATOR.name).toBe('Angad Ranjan');
    expect(PLATFORM_CREATOR.githubUrl).toBe('https://github.com/angad-r');
  });

  it('4. ensures resetDatabase clears user data but leaves PLATFORM_CREATOR intact', async () => {
    // Add sample student data and customize settings
    await updateUserSettings({
      semester: 'Semester 4',
      academicYear: '2023 - 2024',
    });

    await db.subjects.add({
      id: 'sub-reset-test',
      name: 'Computer Networks',
      semester: 'Semester 4',
      academicYear: '2023 - 2024',
      credits: 4,
      color: '#4f46e5',
      attendanceThreshold: 75,
      targetScore: 80,
      difficulty: 3,
      assessmentComponents: [],
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(await db.subjects.count()).toBe(1);

    // Perform database reset
    await resetDatabase();

    // Verify user data is wiped
    expect(await db.subjects.count()).toBe(0);
    const settingsAfterReset = await getUserSettings();
    expect(settingsAfterReset.semester).toBe(DEFAULT_USER_SETTINGS.semester);

    // Verify PLATFORM_CREATOR details remain constant and accessible
    expect(PLATFORM_CREATOR.name).toBe('Angad Ranjan');
    expect(PLATFORM_CREATOR.githubUrl).toBe('https://github.com/angad-r');
    expect(PLATFORM_CREATOR.linkedinUrl).toBe('https://in.linkedin.com/in/angad-ranjan-057616380');
  });

  it('5. ensures exportDatabaseToJson excludes creator identity from user backup files', async () => {
    await updateUserSettings({
      semester: 'Semester 3',
      academicYear: '2023 - 2024',
    });

    const json = await exportDatabaseToJson();
    const parsed = JSON.parse(json);

    expect(parsed.data.userSettings.semester).toBe('Semester 3');
    expect(parsed.data.userSettings.creatorName).toBeUndefined();
    expect(parsed.data.userSettings.creatorGithubUrl).toBeUndefined();
    expect(parsed.data.userSettings.creatorLinkedinUrl).toBeUndefined();
  });
});
