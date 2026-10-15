import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseFlexibleDate,
  classifyAcademicEvent,
  parseSpreadsheetCalendar,
  parsePlainTextCalendar,
} from '../src/lib/calendarParser';
import {
  validateCollegeUrl,
  calculateCalendarDiff,
  discoverCollegeCalendar,
} from '../src/lib/collegeWebsiteIntegration';
import { generateStudySchedule, calculateTaskUrgencyScore } from '../src/lib/studyPlanner';
import {
  validateAndPreviewImport,
  generateAcademicEventsCsv,
  CURRENT_BACKUP_SCHEMA_VERSION,
} from '../src/db/backupRestore';
import {
  AcademicEvent,
  Task,
  Subject,
  StudyPreferences,
  TimetableSession,
} from '../src/types';
import { format, addDays } from 'date-fns';

describe('Academic Calendar Extension & Smart Integration Engine', () => {
  // =========================================================================
  // 1. Intelligent Date & Classification Parser
  // =========================================================================
  describe('Flexible Date Parsing & Classification', () => {
    it('standardizes ISO, Indian/UK, US, and ordinal dates into YYYY-MM-DD', () => {
      expect(parseFlexibleDate('2024-10-15')).toBe('2024-10-15');
      expect(parseFlexibleDate('15/08/2024')).toBe('2024-08-15');
      expect(parseFlexibleDate('15-08-2024')).toBe('2024-08-15');
      expect(parseFlexibleDate('08/15/2024')).toBe('2024-08-15');
      expect(parseFlexibleDate('15th August 2024')).toBe('2024-08-15');
      expect(parseFlexibleDate('2nd October 2024')).toBe('2024-10-02');
      expect(parseFlexibleDate('26 Jan 2025')).toBe('2025-01-26');
      expect(parseFlexibleDate('invalid-date-string')).toBeNull();
    });

    it('infers default academic year when year is omitted from day/month', () => {
      expect(parseFlexibleDate('15 Aug', 2025)).toBe('2025-08-15');
      expect(parseFlexibleDate('02/10', 2024)).toBe('2024-10-02');
    });

    it('categorizes academic events into correct types with confidence scores', () => {
      const exam = classifyAcademicEvent('Mid-Term Theory Examination');
      expect(exam.type).toBe('rescheduled_exam');
      expect(exam.confidence).toBeGreaterThanOrEqual(90);

      const lab = classifyAcademicEvent('Practical Lab Exam & Viva Voce');
      expect(lab.type).toBe('cancelled_lab');
      expect(lab.confidence).toBeGreaterThanOrEqual(90);

      const holiday = classifyAcademicEvent('Diwali Holiday & College Closed');
      expect(holiday.type).toBe('official_holiday');
      expect(holiday.confidence).toBeGreaterThanOrEqual(95);

      const vacation = classifyAcademicEvent('Winter Vacation & Preparatory Leave');
      expect(vacation.type).toBe('vacation_break');
      expect(vacation.confidence).toBeGreaterThanOrEqual(90);

      const deadline = classifyAcademicEvent('Final Capstone Project Report Submission Deadline');
      expect(deadline.type).toBe('assignment_deadline');
      expect(deadline.confidence).toBeGreaterThanOrEqual(85);

      const fest = classifyAcademicEvent('Annual Cultural & Technical Symposium Hackathon');
      expect(fest.type).toBe('college_event');
      expect(fest.confidence).toBeGreaterThanOrEqual(85);

      const other = classifyAcademicEvent('Guest Lecture by Alumnus');
      expect(other.type).toBe('other');
      expect(other.confidence).toBeLessThan(75);
    });
  });

  // =========================================================================
  // 2. Multi-Format Calendar Extraction (Spreadsheet & Plaintext)
  // =========================================================================
  describe('Multi-Format Calendar Extraction', () => {
    it('parses structured spreadsheet/CSV data and detects duplicates & conflicts', async () => {
      // Create an in-memory workbook using SheetJS
      const sheetData = [
        ['Date', 'Event Description', 'Category'],
        ['15/08/2024', 'Independence Day Holiday', 'Official Holiday'],
        ['10/10/2024 to 15/10/2024', 'Mid-Term Examinations', 'Exam'],
        ['20/10/2024', 'Guest Lecture on AI', 'Lecture'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'AcademicCalendar');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const existingEvents: AcademicEvent[] = [
        {
          id: 'ex-1',
          title: 'Independence Day Holiday',
          eventType: 'official_holiday',
          startDate: '2024-08-15',
          endDate: '2024-08-15',
          allDay: true,
          sourceType: 'manual_entry',
          isUserOverride: false,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const result = await parseSpreadsheetCalendar(buffer, 'calendar.xlsx', existingEvents);

      expect(result.events.length).toBe(3);
      // Row 1: Independence day (detected as duplicate of ex-1)
      const independenceEvent = result.events.find((e) => e.title.includes('Independence'));
      expect(independenceEvent).toBeDefined();
      expect(independenceEvent?.startDate).toBe('2024-08-15');
      expect(independenceEvent?.reviewStatus).toBe('duplicate');

      // Row 2: Mid-Term Examinations range
      const examEvent = result.events.find((e) => e.title.includes('Mid-Term'));
      expect(examEvent).toBeDefined();
      expect(examEvent?.startDate).toBe('2024-10-10');
      expect(examEvent?.endDate).toBe('2024-10-15');
      expect(examEvent?.eventType).toBe('rescheduled_exam');
      expect(examEvent?.reviewStatus).toBe('new');

      // Row 3: Guest Lecture on AI
      const lectureEvent = result.events.find((e) => e.title.includes('Guest Lecture'));
      expect(lectureEvent).toBeDefined();
      expect(lectureEvent?.startDate).toBe('2024-10-20');
    });

    it('correctly parses university format with Sl. No., Date, Day, and Particulars headers without mistaking Day for Date', async () => {
      const universitySheet = [
        ['XYZ Institute of Technology'],
        ['Odd Semester Academic Calendar 2024-2025'],
        ['Schedule of Events'],
        [''],
        ['Sl. No.', 'Date', 'Day', 'Particulars'],
        ['1', '07.11.2024', 'Thur', 'Hall Ticket Generation for 3rd, 5th & 7th Sem'],
        ['2', '11.11.2024', 'Mon', 'SEE: 7 -22 for 3rd, 5th & 7th Sem'],
        ['3', '13.11.2024', 'Wed', 'Chairs Meeting'],
        ['4', '20.11.2024', 'Wed', 'SEE: 16-31 for 1st Sem'],
        ['5', '21.11.2024', 'Thur', 'Last Working Day for 1st Sem'],
        ['6', '22.11.2024', 'Fri', 'Compilation of Attendance & Uploading CIA marks to ERP for 1st sem'],
        ['7', '28.11.2024', 'Thur', 'Hall Ticket Generation for 1st Sem'],
        ['8', '25.12.2024', 'Fri', 'Christmas'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(universitySheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const result = await parseSpreadsheetCalendar(buffer, 'vtu_calendar.xlsx', []);

      expect(result.warnings.length).toBe(0);
      expect(result.events.length).toBe(8);

      // Verify that "Particulars" header row was NOT parsed as an event
      const particularsEvent = result.events.find((e) => e.title.toLowerCase() === 'particulars');
      expect(particularsEvent).toBeUndefined();

      // Check Hall ticket event
      const hallTicket = result.events.find((e) => e.title.includes('Hall Ticket Generation for 3rd'));
      expect(hallTicket).toBeDefined();
      expect(hallTicket?.startDate).toBe('2024-11-07');
      expect(hallTicket?.eventType).toBe('registration_deadline');

      // Check SEE exam range
      const seeExam = result.events.find((e) => e.title.includes('SEE: 7 -22'));
      expect(seeExam).toBeDefined();
      expect(seeExam?.startDate).toBe('2024-11-11');
      expect(seeExam?.eventType).toBe('rescheduled_exam');

      // Check Christmas
      const christmas = result.events.find((e) => e.title === 'Christmas');
      expect(christmas).toBeDefined();
      expect(christmas?.startDate).toBe('2024-12-25');
      expect(christmas?.eventType).toBe('official_holiday');
    });

    it('correctly parses month section headers and day numbers without full dates', async () => {
      const monthSectionSheet = [
        ['XYZ Institute of Technology'],
        ['Academic Calendar 2024-2025'],
        [''],
        ['Sl. No.', 'Date', 'Day', 'Particulars'],
        ['AUGUST 2024'],
        ['1', '3', 'Sat', 'Commencement of classes for 3rd, 5th & 7th Semester'],
        ['2', '5', 'Mon', 'Chairs Meeting'],
        ['3', '12', 'Mon', 'Orientation program for 1st Semester'],
        ['4', '15', 'Thu', 'Independence Day'],
        ['5', '20', 'Tue', 'Commencement of classes for 1st Semester'],
        ['SEPTEMBER 2024'],
        ['6', '26', 'Thu', 'Eid - Milad'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(monthSectionSheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const result = await parseSpreadsheetCalendar(buffer, 'month_section_calendar.xlsx', []);

      expect(result.warnings.length).toBe(0);
      expect(result.events.length).toBe(6);

      // Verify August 3
      const classStart = result.events.find((e) => e.title.includes('Commencement of classes for 3rd'));
      expect(classStart).toBeDefined();
      expect(classStart?.startDate).toBe('2024-08-03');

      // Verify August 15 (Independence Day)
      const indepDay = result.events.find((e) => e.title === 'Independence Day');
      expect(indepDay).toBeDefined();
      expect(indepDay?.startDate).toBe('2024-08-15');
      expect(indepDay?.eventType).toBe('official_holiday');

      // Verify September 26 (Eid - Milad)
      const eid = result.events.find((e) => e.title === 'Eid - Milad');
      expect(eid).toBeDefined();
      expect(eid?.startDate).toBe('2024-09-26');
      expect(eid?.eventType).toBe('official_holiday');
    });

    it('resolves dates 3, 5, 12 before a landmark holiday using backward propagation even without explicit month header', async () => {
      const sheetWithoutMonthHeader = [
        ['University Academic Calendar 2024-2025'],
        ['Schedule of Events'],
        [''],
        ['Sl. No.', 'Date', 'Day', 'Particulars'],
        ['1', '3', 'Sat', 'Commencement of classes for 3rd, 5th & 7th Semester'],
        ['2', '5', 'Mon', 'Chairs Meeting'],
        ['3', '12', 'Mon', 'Orientation program for 1st Semester'],
        ['4', '15', 'Thu', 'Independence Day'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetWithoutMonthHeader);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const result = await parseSpreadsheetCalendar(buffer, 'backward_prop_calendar.xlsx', []);

      expect(result.warnings.length).toBe(0);
      expect(result.events.length).toBe(4);

      const d3 = result.events.find((e) => e.title.includes('Commencement of classes for 3rd'));
      expect(d3?.startDate).toBe('2024-08-03');

      const d5 = result.events.find((e) => e.title.includes('Chairs Meeting'));
      expect(d5?.startDate).toBe('2024-08-05');

      const d12 = result.events.find((e) => e.title.includes('Orientation program'));
      expect(d12?.startDate).toBe('2024-08-12');

      const d15 = result.events.find((e) => e.title === 'Independence Day');
      expect(d15?.startDate).toBe('2024-08-15');
    });

    it('parses plain text calendar documents with line-by-line regex extraction', () => {
      const rawText = `
        ACADEMIC CALENDAR 2024-2025
        15/08/2024 - Independence Day Holiday
        02-10-2024 - Gandhi Jayanti
        10/10/2024 to 15/10/2024: End-Sem Theory Examination
        25/12/2024: Christmas Vacation
      `;

      const result = parsePlainTextCalendar(rawText, 'document.pdf');
      expect(result.events.length).toBe(4);
      expect(result.events[0].startDate).toBe('2024-08-15');
      expect(result.events[0].title).toBe('Independence Day Holiday');
      expect(result.events[2].startDate).toBe('2024-10-10');
      expect(result.events[2].endDate).toBe('2024-10-15');
      expect(result.events[2].eventType).toBe('rescheduled_exam');
    });
  });

  // =========================================================================
  // 3. College Website Integration & SSRF Protection
  // =========================================================================
  describe('Website Integration & SSRF Security', () => {
    it('permits valid HTTP and HTTPS university domain URLs', () => {
      const res1 = validateCollegeUrl('https://www.iitb.ac.in/academic-calendar');
      expect(res1.isValid).toBe(true);
      expect(res1.sanitizedUrl).toBe('https://www.iitb.ac.in/academic-calendar');

      const res2 = validateCollegeUrl('http://university.edu/notices/calendar.html');
      expect(res2.isValid).toBe(true);
    });

    it('blocks dangerous protocols, localhost, private IP ranges, and cloud metadata (SSRF)', () => {
      // Protocol checks
      expect(validateCollegeUrl('ftp://example.com/calendar').isValid).toBe(false);
      expect(validateCollegeUrl('file:///etc/passwd').isValid).toBe(false);
      expect(validateCollegeUrl('javascript:alert(1)').isValid).toBe(false);

      // Localhost & loopback
      expect(validateCollegeUrl('http://localhost:3000/calendar').isValid).toBe(false);
      expect(validateCollegeUrl('http://127.0.0.1:8080').isValid).toBe(false);
      expect(validateCollegeUrl('http://subdomain.localhost').isValid).toBe(false);

      // Private RFC 1918 subnets
      expect(validateCollegeUrl('http://192.168.1.1/admin').isValid).toBe(false);
      expect(validateCollegeUrl('http://10.0.0.5/api').isValid).toBe(false);
      expect(validateCollegeUrl('http://172.16.0.1/status').isValid).toBe(false);
      expect(validateCollegeUrl('http://0.0.0.0').isValid).toBe(false);

      // Cloud metadata endpoints
      expect(validateCollegeUrl('http://169.254.169.254/latest/meta-data/').isValid).toBe(false);
      expect(validateCollegeUrl('http://metadata.google.internal/computeMetadata/v1/').isValid).toBe(false);
    });

    it('discovers official academic calendar events from verified university portal', async () => {
      const result = await discoverCollegeCalendar('https://university.ac.in/calendar', 'State Tech University');
      expect(result.success).toBe(true);
      expect(result.detectedEvents.length).toBeGreaterThan(0);
      expect(result.sourceDetails.syncStatus).toBe('success');
      expect(result.sourceDetails.institutionName).toBe('State Tech University');
    });
  });

  // =========================================================================
  // 4. Calendar Diffing & Precedence Protection (User Override Safeguard)
  // =========================================================================
  describe('Calendar Diff & Precedence Rules', () => {
    it('safeguards user manual overrides against being overwritten by website updates', () => {
      const existingUserOverride: AcademicEvent = {
        id: 'usr-1',
        title: 'Mid-Term Examinations',
        eventType: 'rescheduled_exam',
        startDate: '2026-11-05',
        endDate: '2026-11-12',
        allDay: true,
        sourceType: 'manual_entry',
        isUserOverride: true, // Explicit user override!
        createdAt: '',
        updatedAt: '',
      };

      const officialCollegeEvent: AcademicEvent = {
        id: 'off-1',
        title: 'Mid-Term Examinations',
        eventType: 'rescheduled_exam',
        startDate: '2026-11-10', // College portal proposes different date
        endDate: '2026-11-17',
        allDay: true,
        sourceType: 'college_website',
        isUserOverride: false,
        createdAt: '',
        updatedAt: '',
      };

      const diffs = calculateCalendarDiff([officialCollegeEvent], [existingUserOverride]);

      expect(diffs.length).toBe(1);
      expect(diffs[0].type).toBe('conflict');
      expect(diffs[0].requiresReview).toBe(true);
      expect(diffs[0].changeDescription).toContain('Your override takes precedence');
    });

    it('identifies rescheduled dates for non-override events and flags omitted events', () => {
      const normalEvent: AcademicEvent = {
        id: 'norm-1',
        title: 'Annual Sports Meet',
        eventType: 'college_event',
        startDate: '2026-10-15',
        endDate: '2026-10-15',
        allDay: true,
        sourceType: 'college_website',
        isUserOverride: false,
        createdAt: '',
        updatedAt: '',
      };

      const omittedEvent: AcademicEvent = {
        id: 'omit-1',
        title: 'Freshers Welcome Party',
        eventType: 'college_event',
        startDate: '2026-10-20',
        endDate: '2026-10-20',
        allDay: true,
        sourceType: 'college_website',
        isUserOverride: false,
        createdAt: '',
        updatedAt: '',
      };

      const updatedSportsEvent: AcademicEvent = {
        id: 'norm-1-upd',
        title: 'Annual Sports Meet',
        eventType: 'college_event',
        startDate: '2026-10-25', // Rescheduled!
        endDate: '2026-10-25',
        allDay: true,
        sourceType: 'college_website',
        isUserOverride: false,
        createdAt: '',
        updatedAt: '',
      };

      const diffs = calculateCalendarDiff([updatedSportsEvent], [normalEvent, omittedEvent]);

      const changedDiff = diffs.find((d) => d.type === 'changed');
      expect(changedDiff).toBeDefined();
      expect(changedDiff?.changeDescription).toContain('Date changed from 2026-10-15 to 2026-10-25');

      const omittedDiff = diffs.find((d) => d.type === 'omitted');
      expect(omittedDiff).toBeDefined();
      expect(omittedDiff?.event.title).toBe('Freshers Welcome Party');
    });
  });

  // =========================================================================
  // 5. Study Planner Integration (Holidays & Urgency Boosting)
  // =========================================================================
  describe('Study Planner Integration with Calendar Events', () => {
    it('blocks official/user holiday dates completely from receiving study sessions', () => {
      const today = new Date();
      // Tomorrow is a national holiday
      const tomorrow = addDays(today, 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const dayAfter = addDays(today, 2);
      const dayAfterStr = format(dayAfter, 'yyyy-MM-dd');

      const holidayEvent: AcademicEvent = {
        id: 'hol-1',
        title: 'National Holiday Closure',
        eventType: 'official_holiday',
        startDate: tomorrowStr,
        endDate: tomorrowStr,
        allDay: true,
        sourceType: 'college_website',
        isUserOverride: false,
        createdAt: '',
        updatedAt: '',
      };

      const testSubject: Subject = {
        id: 'sub-algo',
        name: 'Algorithms',
        semester: 'Sem 5',
        academicYear: '2024-2025',
        credits: 4,
        color: '#4f46e5',
        attendanceThreshold: 75,
        targetScore: 85,
        difficulty: 4,
        assessmentComponents: [],
        isArchived: false,
        createdAt: '',
        updatedAt: '',
      };

      const urgentTask: Task = {
        id: 't-algo-1',
        subjectId: 'sub-algo',
        title: 'Dynamic Programming Problem Set',
        description: '',
        dueDate: dayAfterStr,
        dueTime: '23:59',
        priority: 'high',
        status: 'pending',
        estimatedMinutes: 120,
        completionPercentage: 0,
        subtasks: [],
        category: 'assignment',
        completedAt: null,
        createdAt: '',
        updatedAt: '',
      };

      const preferences: StudyPreferences = {
        dailyBudgetMinutes: 120,
        availableDays: [1, 2, 3, 4, 5, 6, 7], // All days available
        preferredTimeSlots: [{ start: '18:00', end: '20:00' }],
        focusPriority: 'balanced',
      };

      const timetable: TimetableSession[] = [];

      const planResult = generateStudySchedule(
        [urgentTask],
        [testSubject],
        timetable,
        preferences,
        [],
        7,
        [holidayEvent]
      );

      // Verify that NO session is scheduled on tomorrow (the holiday)
      const sessionsOnHoliday = planResult.plans.filter((p) => p.date === tomorrowStr);
      expect(sessionsOnHoliday.length).toBe(0);

      // Verify diagnostic warning was emitted
      expect(planResult.warnings.some((w) => w.includes('holiday'))).toBe(true);
    });

    it('boosts task urgency score by +45 points when an academic calendar exam approaches', () => {
      const today = new Date();
      const testSubject: Subject = {
        id: 'sub-db',
        name: 'Database Management',
        code: 'CS502',
        semester: 'Sem 5',
        academicYear: '2024-2025',
        credits: 4,
        color: '#059669',
        attendanceThreshold: 75,
        targetScore: 85,
        difficulty: 3,
        assessmentComponents: [],
        isArchived: false,
        createdAt: '',
        updatedAt: '',
      };

      const task: Task = {
        id: 't-db-prep',
        subjectId: 'sub-db',
        title: 'Review SQL Normalization & Transactions',
        description: '',
        dueDate: format(addDays(today, 5), 'yyyy-MM-dd'),
        dueTime: '10:00',
        priority: 'medium',
        status: 'pending',
        estimatedMinutes: 90,
        completionPercentage: 0,
        subtasks: [],
        category: 'exam_prep',
        completedAt: null,
        createdAt: '',
        updatedAt: '',
      };

      // Score without calendar exam
      const baseline = calculateTaskUrgencyScore(task, testSubject, today, []);

      // With an academic calendar examination scheduled for Database Management
      const calendarExam: AcademicEvent = {
        id: 'exam-db',
        title: 'CS502 Database Management Theory Exam',
        eventType: 'rescheduled_exam',
        startDate: format(addDays(today, 6), 'yyyy-MM-dd'),
        endDate: format(addDays(today, 6), 'yyyy-MM-dd'),
        allDay: true,
        sourceType: 'college_website',
        affectedSubjectIds: ['sub-db'],
        isUserOverride: false,
        createdAt: '',
        updatedAt: '',
      };

      const boosted = calculateTaskUrgencyScore(task, testSubject, today, [calendarExam]);

      expect(boosted.score).toBe(baseline.score + 45);
      expect(boosted.reason).toContain('Scheduled university examination approaching');
    });
  });

  // =========================================================================
  // 6. Schema Migration & Backup/Restore V2 Engine
  // =========================================================================
  describe('Schema V2 Upgrade & Academic Events Backup Engine', () => {
    it('validates and accepts Version 2 backups containing academic events', async () => {
      const backupPayloadV2 = {
        appName: 'ScholarSync',
        schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          subjects: [],
          attendanceRecords: [],
          tasks: [],
          timetableSessions: [],
          studyPlans: [],
          academicEvents: [
            {
              id: 'ev-backup-1',
              title: 'Mid-Sem Examination',
              eventType: 'rescheduled_exam',
              startDate: '2026-10-15',
              endDate: '2026-10-20',
              allDay: true,
              sourceType: 'uploaded_calendar',
              sourceName: 'Official_Calendar_2026.pdf',
              isUserOverride: false,
              confidence: 94,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      };

      const preview = await validateAndPreviewImport(JSON.stringify(backupPayloadV2));
      expect(preview.isValid).toBe(true);
      expect(preview.counts.academicEvents).toBe(1);
      expect(preview.errors.length).toBe(0);
    });

    it('maintains backwards compatibility with Version 1 backups', async () => {
      const legacyBackupPayloadV1 = {
        appName: 'ScholarSync',
        schemaVersion: 1, // Legacy V1 backup
        exportedAt: new Date().toISOString(),
        data: {
          subjects: [],
          attendanceRecords: [],
          tasks: [],
          timetableSessions: [],
          studyPlans: [],
          // Note: academicEvents omitted in v1
        },
      };

      const preview = await validateAndPreviewImport(JSON.stringify(legacyBackupPayloadV1));
      expect(preview.isValid).toBe(true);
      expect(preview.counts.academicEvents).toBe(0);
      expect(preview.warnings.some((w) => w.includes('Version 1'))).toBe(true);
    });

    it('generates well-formatted CSV exports for academic events', () => {
      const events: AcademicEvent[] = [
        {
          id: 'ev-csv',
          title: 'Diwali Break, "Special"',
          eventType: 'official_holiday',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          allDay: true,
          sourceType: 'manual_entry',
          isUserOverride: true,
          description: 'Official institute festival closure',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const csv = generateAcademicEventsCsv(events);
      expect(csv).toContain('Title');
      expect(csv).toContain('Start Date');
      expect(csv).toContain('End Date');
      expect(csv).toContain('"Diwali Break, ""Special"""');
      expect(csv).toContain('official_holiday');
      expect(csv).toContain('2026-11-01');
    });

    it('accurately parses Dayananda Sagar University multi-month side-by-side matrix calendar', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const csvPath = path.resolve(__dirname, 'dsu_calendar.csv');
      const csvBuffer = fs.readFileSync(csvPath);

      const result = await parseSpreadsheetCalendar(csvBuffer, 'dsu_calendar.csv');

      // Assert 0 warnings and all 35 events extracted
      expect(result.warnings).toEqual([]);
      expect(result.events.length).toBe(35);

      // Verify specific multi-month events
      // 1. August
      const commencementAug = result.events.find((e) => e.title.includes('Commencement of classes for 3rd'));
      expect(commencementAug).toBeDefined();
      expect(commencementAug?.startDate).toBe('2026-08-03');
      expect(commencementAug?.eventType).toBe('registration_deadline');

      const eidMilad = result.events.find((e) => e.title.includes('Eid - Milad'));
      expect(eidMilad?.startDate).toBe('2026-08-26');
      expect(eidMilad?.eventType).toBe('official_holiday');

      // 2. September
      const faSep = result.events.find((e) => e.title.includes('Formative Assessment week (Module 1'));
      expect(faSep?.startDate).toBe('2026-09-08');
      expect(faSep?.eventType).toBe('rescheduled_exam');

      const ganesh = result.events.find((e) => e.title.includes('Ganesh Chaturthi'));
      expect(ganesh?.startDate).toBe('2026-09-14');
      expect(ganesh?.eventType).toBe('official_holiday');

      const mseEvents = result.events.filter((e) => e.title === 'MSE');
      expect(mseEvents.length).toBe(3);
      expect(mseEvents.map((e) => e.startDate)).toEqual(['2026-09-26', '2026-09-28', '2026-09-29']);
      expect(mseEvents.every((e) => e.eventType === 'rescheduled_exam')).toBe(true);

      // 3. October
      const gandhi = result.events.find((e) => e.title.includes('Gandhi Jayanti'));
      expect(gandhi?.startDate).toBe('2026-10-02');
      expect(gandhi?.eventType).toBe('official_holiday');

      const ptm = result.events.find((e) => e.title.includes('Parent Teacher Meeting (PTM)'));
      expect(ptm?.startDate).toBe('2026-10-24');
      expect(ptm?.eventType).toBe('college_event');

      const arm = result.events.find((e) => e.title.includes('ARM'));
      expect(arm?.startDate).toBe('2026-10-14');
      expect(arm?.eventType).toBe('college_event');

      // 4. November
      const rajyotsava = result.events.find((e) => e.title.includes('Kannada Rajyothsava'));
      expect(rajyotsava?.startDate).toBe('2026-11-01');
      expect(rajyotsava?.eventType).toBe('official_holiday');

      const naraka = result.events.find((e) => e.title.includes('Naraka Chaturdashi'));
      expect(naraka?.startDate).toBe('2026-11-08');
      expect(naraka?.eventType).toBe('official_holiday');

      const balipadyami = result.events.find((e) => e.title.includes('Balipadyami'));
      expect(balipadyami?.startDate).toBe('2026-11-10');
      expect(balipadyami?.eventType).toBe('official_holiday');

      const lastWorkingNov = result.events.find((e) => e.title.includes('Last Working Day for 3rd'));
      expect(lastWorkingNov?.startDate).toBe('2026-11-26');
      expect(lastWorkingNov?.eventType).toBe('vacation_break');

      // 5. December
      const hallTicketDec = result.events.find((e) => e.title.includes('Hall Ticket Generation for 3rd'));
      expect(hallTicketDec?.startDate).toBe('2026-12-03');
      expect(hallTicketDec?.eventType).toBe('registration_deadline');

      const seeDecRange = result.events.find((e) => e.title.includes('SEE: 7 -22'));
      expect(seeDecRange?.startDate).toBe('2026-12-07');
      expect(seeDecRange?.endDate).toBe('2026-12-22');
      expect(seeDecRange?.eventType).toBe('rescheduled_exam');

      const seeDecRange2 = result.events.find((e) => e.title.includes('SEE: 16-31'));
      expect(seeDecRange2?.startDate).toBe('2026-12-16');
      expect(seeDecRange2?.endDate).toBe('2026-12-31');
      expect(seeDecRange2?.eventType).toBe('rescheduled_exam');

      const christmas = result.events.find((e) => e.title.includes('Christmas'));
      expect(christmas?.startDate).toBe('2026-12-25');
      expect(christmas?.eventType).toBe('official_holiday');

      // Also verify Chairs Meetings appear in August, October, November, December
      const chairsMeetings = result.events.filter((e) => e.title === 'Chairs Meeting');
      expect(chairsMeetings.length).toBe(4);
      expect(chairsMeetings.map((e) => e.startDate)).toEqual([
        '2026-08-05',
        '2026-10-07',
        '2026-11-11',
        '2026-12-09',
      ]);
    });

    it('accurately parses Even Semester multi-sheet workbook without false title date errors', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const evnPath = path.resolve(__dirname, 'evn_calendar.xlsx');
      const evnBuffer = fs.readFileSync(evnPath);

      const result = await parseSpreadsheetCalendar(evnBuffer, 'evn.xlsx');

      // Assert 0 warnings (no "Row 2: Could not parse date" errors)
      expect(result.warnings).toEqual([]);
      expect(result.events.length).toBe(39);

      // Verify specific even semester events
      const seeJan = result.events.find((e) => e.title === 'SEE for 1st sem' && e.startDate === '2026-01-01');
      expect(seeJan).toBeDefined();
      expect(seeJan?.eventType).toBe('rescheduled_exam');

      const sankranti = result.events.find((e) => e.title === 'Makara Sankranti');
      expect(sankranti?.startDate).toBe('2026-01-15');
      expect(sankranti?.eventType).toBe('official_holiday');

      const republicDay = result.events.find((e) => e.title === 'Republic Day');
      expect(republicDay?.startDate).toBe('2026-01-26');
      expect(republicDay?.eventType).toBe('official_holiday');

      const ciaAat = result.events.find((e) => e.title.includes('Commencement of Continuous Internal Assessment'));
      expect(ciaAat?.startDate).toBe('2026-02-02');
      expect(ciaAat?.eventType).toBe('rescheduled_exam');

      const ccMeeting = result.events.find((e) => e.title.includes('9-14: 1st CC Meeting'));
      expect(ccMeeting?.startDate).toBe('2026-02-09');
      expect(ccMeeting?.endDate).toBe('2026-02-14');
      expect(ccMeeting?.eventType).toBe('college_event');

      const ambedkar = result.events.find((e) => e.title.includes('Ambedkar Jayanti'));
      expect(ambedkar?.startDate).toBe('2026-04-14');
      expect(ambedkar?.eventType).toBe('official_holiday');

      const basava = result.events.find((e) => e.title.includes('Basava Jayanti'));
      expect(basava?.startDate).toBe('2026-04-20');
      expect(basava?.eventType).toBe('official_holiday');

      const mayDay = result.events.find((e) => e.title === 'May Day');
      expect(mayDay?.startDate).toBe('2026-05-01');
      expect(mayDay?.eventType).toBe('official_holiday');

      const hallTicketMay = result.events.find((e) => e.title.includes('4-6: Hall Ticket Generation'));
      expect(hallTicketMay?.startDate).toBe('2026-05-04');
      expect(hallTicketMay?.endDate).toBe('2026-05-06');
      expect(hallTicketMay?.eventType).toBe('registration_deadline');

      const bakrid = result.events.find((e) => e.title === 'Bakrid');
      expect(bakrid?.startDate).toBe('2026-05-28');
      expect(bakrid?.eventType).toBe('official_holiday');
    });
  });
});
