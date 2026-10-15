import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseTimeRange,
  classifyTimetableCell,
  parseSpreadsheetTimetable,
  generateSampleTimetableCsv,
  matchSubjectWithExisting,
} from '../src/lib/timetableParser';
import { Subject } from '../src/types';

describe('Timetable Parser Engine', () => {
  describe('parseTimeRange', () => {
    it('parses standard 24-hour time ranges', () => {
      const res = parseTimeRange('09:00 - 10:30');
      expect(res).not.toBeNull();
      expect(res?.startTime).toBe('09:00');
      expect(res?.endTime).toBe('10:30');
    });

    it('parses dot-separated times', () => {
      const res = parseTimeRange('11.15 to 12.45');
      expect(res).not.toBeNull();
      expect(res?.startTime).toBe('11:15');
      expect(res?.endTime).toBe('12:45');
    });

    it('parses 12-hour AM/PM formats correctly', () => {
      const res = parseTimeRange('09:30 AM - 11:00 AM');
      expect(res).not.toBeNull();
      expect(res?.startTime).toBe('09:30');
      expect(res?.endTime).toBe('11:00');

      const pmRes = parseTimeRange('02:00 PM - 04:00 PM');
      expect(pmRes).not.toBeNull();
      expect(pmRes?.startTime).toBe('14:00');
      expect(pmRes?.endTime).toBe('16:00');
    });

    it('infers PM for afternoon classes when AM/PM is omitted', () => {
      // e.g. 1:00 - 2:00 should be 13:00 - 14:00
      const res = parseTimeRange('1:00 - 2:00');
      expect(res).not.toBeNull();
      expect(res?.startTime).toBe('13:00');
      expect(res?.endTime).toBe('14:00');
    });

    it('handles morning to afternoon transitions like 11:30 - 1:30', () => {
      const res = parseTimeRange('11:30 - 1:30');
      expect(res).not.toBeNull();
      expect(res?.startTime).toBe('11:30');
      expect(res?.endTime).toBe('13:30');
    });

    it('returns null for strings without valid time pairs', () => {
      expect(parseTimeRange('Monday')).toBeNull();
      expect(parseTimeRange('Computer Science Lab')).toBeNull();
      expect(parseTimeRange('')).toBeNull();
    });
  });

  describe('classifyTimetableCell', () => {
    it('classifies breaks correctly with custom title', () => {
      const lunch = classifyTimetableCell('Lunch Break');
      expect(lunch.type).toBe('break');
      expect(lunch.customTitle).toBe('Lunch Break');

      const tea = classifyTimetableCell('Tea Break / Recess');
      expect(tea.type).toBe('break');
      expect(tea.customTitle).toBe('Tea Break / Recess');

      const interval = classifyTimetableCell('INTERVAL');
      expect(interval.type).toBe('break');
    });

    it('classifies free periods and library slots', () => {
      const free = classifyTimetableCell('Free Period');
      expect(free.type).toBe('free_period');
      expect(free.customTitle).toBe('Free Period');

      const lib = classifyTimetableCell('Library / Self Study');
      expect(lib.type).toBe('free_period');
      expect(lib.customTitle).toBe('Library / Self Study');

      const sports = classifyTimetableCell('Sports / Leisure');
      expect(sports.type).toBe('free_period');
    });

    it('extracts room and identifies labs and lectures', () => {
      const lab = classifyTimetableCell('Data Structures Lab (Lab 302)');
      expect(lab.type).toBe('lab');
      expect(lab.subjectCandidate).toContain('Data Structures Lab');
      expect(lab.room).toBe('Lab 302');

      const lecture = classifyTimetableCell('Operating Systems [Room 105]');
      expect(lecture.type).toBe('lecture');
      expect(lecture.subjectCandidate).toBe('Operating Systems');
      expect(lecture.room).toBe('Room 105');

      const tutorial = classifyTimetableCell('Mathematics Tutorial (Hall B)');
      expect(tutorial.type).toBe('tutorial');
      expect(tutorial.room).toBe('Hall B');
    });
  });

  describe('matchSubjectWithExisting', () => {
    const existing: Subject[] = [
      {
        id: 'sub-dbms',
        name: 'Database Management Systems',
        code: 'CS301',
        semester: 'Sem 5',
        academicYear: '2025-2026',
        credits: 4,
        color: '#4f46e5',
        attendanceThreshold: 75,
        targetScore: 80,
        difficulty: 3,
        assessmentComponents: [],
        isArchived: false,
        createdAt: '',
        updatedAt: '',
      },
    ];

    it('matches by exact code or name', () => {
      expect(matchSubjectWithExisting('CS301', existing)?.id).toBe('sub-dbms');
      expect(matchSubjectWithExisting('Database Management Systems', existing)?.id).toBe('sub-dbms');
    });

    it('matches by acronym (DBMS -> Database Management Systems)', () => {
      expect(matchSubjectWithExisting('DBMS', existing)?.id).toBe('sub-dbms');
    });
  });

  describe('parseSpreadsheetTimetable - Day x Time Matrix', () => {
    it('parses a full weekly timetable matrix with breaks and labs', async () => {
      const rows = [
        ['Day / Time', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 11:15', '11:15 - 12:15', '12:15 - 01:15', '01:15 - 03:15'],
        ['Monday', 'Database Systems (LH-1)', 'Computer Networks (LH-2)', 'Tea Break', 'Algorithms (LH-1)', 'Lunch Break', 'Web Tech Lab (Lab 201)'],
        ['Tuesday', 'Operating Systems (LH-3)', 'Free Period', 'Tea Break', 'Database Systems (LH-1)', 'Lunch Break', 'Library / Self Study'],
        ['Wednesday', 'Computer Networks (LH-2)', 'Algorithms (LH-1)', 'Tea Break', 'Software Eng (LH-4)', 'Lunch Break', 'Networks Lab (Lab 202)'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const result = await parseSpreadsheetTimetable(buffer, 'timetable.xlsx', []);

      expect(result.strategy).toContain('Matrix');
      expect(result.slots.length).toBeGreaterThanOrEqual(18);

      // Verify breaks exist
      const breaks = result.slots.filter((s) => s.type === 'break');
      expect(breaks.length).toBeGreaterThanOrEqual(6); // 3 tea + 3 lunch
      expect(breaks.some((b) => b.customTitle?.toLowerCase().includes('tea'))).toBe(true);
      expect(breaks.some((b) => b.customTitle?.toLowerCase().includes('lunch'))).toBe(true);

      // Verify free periods exist
      const freePeriods = result.slots.filter((s) => s.type === 'free_period');
      expect(freePeriods.length).toBeGreaterThanOrEqual(2); // Free Period + Library

      // Verify labs exist
      const labs = result.slots.filter((s) => s.type === 'lab');
      expect(labs.length).toBeGreaterThanOrEqual(2);
      expect(labs.some((l) => l.room === 'Lab 201')).toBe(true);

      // Verify auto-detected subjects were generated
      expect(result.detectedSubjects?.length).toBeGreaterThan(0);
      expect(result.detectedSubjects?.some((s) => s.name.includes('Database Systems'))).toBe(true);
    });
  });

  describe('parseSpreadsheetTimetable - Tabular Format', () => {
    it('parses column-based schedule lists with custom types', async () => {
      const csv = `Day,Start Time,End Time,Subject,Type,Room
Monday,09:00,10:00,Artificial Intelligence,lecture,Room 401
Monday,10:00,10:15,Morning Tea,break,Cafeteria
Monday,10:15,12:15,AI Lab,lab,Lab 3
Monday,12:15,01:15,Lunch Hour,break,Campus Center
Monday,01:15,02:15,Open Elective,free_period,Library
`;

      const encoder = new TextEncoder();
      const buffer = encoder.encode(csv).buffer;

      const result = await parseSpreadsheetTimetable(buffer, 'schedule.csv', []);

      expect(result.strategy).toBe('Tabular List');
      expect(result.slots.length).toBe(5);

      const monBreaks = result.slots.filter((s) => s.type === 'break');
      expect(monBreaks.length).toBe(2);
      expect(monBreaks[0].customTitle).toBe('Morning Tea');
      expect(monBreaks[1].customTitle).toBe('Lunch Hour');

      const monFree = result.slots.find((s) => s.type === 'free_period');
      expect(monFree).toBeDefined();
      expect(monFree?.customTitle).toBe('Open Elective');

      const monLab = result.slots.find((s) => s.type === 'lab');
      expect(monLab?.room).toBe('Lab 3');
    });
  });

  describe('generateSampleTimetableCsv', () => {
    it('produces valid CSV with standard headers and sample slots', () => {
      const csv = generateSampleTimetableCsv();
      expect(csv).toContain('Day,Start Time,End Time');
      expect(csv).toContain('Tea Break');
      expect(csv).toContain('Lunch Break');
      expect(csv).toContain('Monday');
      expect(csv).toContain('Friday');
    });
  });
});
