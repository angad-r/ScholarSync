import * as XLSX from 'xlsx';
import { SessionType, Subject, TimetableSession } from '../types';

export interface ExtractedTimetableSlotPreview {
  tempId: string;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  dayName: string;
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  type: SessionType;
  rawText: string;
  customTitle?: string;
  subjectId?: string;
  matchedSubjectName?: string;
  room?: string;
  notes?: string;
  confidence: number;
}

export interface TimetableExtractionResult {
  slots: ExtractedTimetableSlotPreview[];
  unmatchedSubjectNames: string[];
  detectedSubjects?: Subject[];
  strategy?: string;
  warnings: string[];
  totalRawRowsScanned: number;
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/**
 * Standardizes time strings like "09:00 - 10:00", "9:00 AM - 10:00 AM", "1:15 - 2:00" into { startTime: "09:00", endTime: "10:00" }.
 */
export function parseTimeRange(timeStr: string): { startTime: string; endTime: string } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern matching: "09:00 - 10:00", "9:00 to 10:00", "9.00 - 10.00", "9:00 AM - 10:00 AM"
  const rangeMatch = clean.match(
    /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i
  );

  if (!rangeMatch) return null;

  let startH = parseInt(rangeMatch[1], 10);
  const startM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
  const startMeridiem = rangeMatch[3]?.toLowerCase();

  let endH = parseInt(rangeMatch[4], 10);
  const endM = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
  const endMeridiem = rangeMatch[6]?.toLowerCase();

  // 12-hour AM/PM normalization
  if (startMeridiem === 'pm' && startH < 12) startH += 12;
  if (startMeridiem === 'am' && startH === 12) startH = 0;

  if (endMeridiem === 'pm' && endH < 12) endH += 12;
  if (endMeridiem === 'am' && endH === 12) endH = 0;

  // College schedule heuristic when AM/PM is omitted:
  // Hours between 1 and 6 PM are common in college afternoons
  if (!startMeridiem && !endMeridiem) {
    if (startH >= 1 && startH <= 6) startH += 12;
    if (endH >= 1 && endH <= 6) endH += 12;
    if (endH < startH && endH < 12) endH += 12;
  } else if (!startMeridiem && endMeridiem === 'pm') {
    if (startH >= 1 && startH <= 6) startH += 12;
  } else if (startMeridiem === 'am' && !endMeridiem) {
    if (endH >= 1 && endH <= 6) endH += 12;
  }

  if (startH < 0 || startH > 23 || endH < 0 || endH > 23 || startM < 0 || startM > 59 || endM < 0 || endM > 59) {
    return null;
  }

  const startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
  const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

  if (startTime >= endTime) return null;

  return { startTime, endTime };
}

/**
 * Parses day of the week from text representation.
 */
export function parseDayOfWeek(text: string): { dayNum: 1 | 2 | 3 | 4 | 5 | 6 | 7; dayName: string } | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  if (/^(1|mon|monday|m)$/i.test(clean)) return { dayNum: 1, dayName: 'Monday' };
  if (/^(2|tue|tues|tuesday|tu)$/i.test(clean)) return { dayNum: 2, dayName: 'Tuesday' };
  if (/^(3|wed|wednesday|w)$/i.test(clean)) return { dayNum: 3, dayName: 'Wednesday' };
  if (/^(4|thu|thur|thurs|thursday|th)$/i.test(clean)) return { dayNum: 4, dayName: 'Thursday' };
  if (/^(5|fri|friday|f)$/i.test(clean)) return { dayNum: 5, dayName: 'Friday' };
  if (/^(6|sat|saturday|s)$/i.test(clean)) return { dayNum: 6, dayName: 'Saturday' };
  if (/^(7|sun|sunday)$/i.test(clean)) return { dayNum: 7, dayName: 'Sunday' };

  return null;
}

/**
 * Classifies cell content into session type and extracts venue / room if present.
 */
export interface ClassifiedCell {
  type: SessionType;
  title: string;
  customTitle?: string;
  subjectCandidate?: string;
  room?: string;
  confidence: number;
}

/**
 * Classifies cell content into session type and extracts venue / room if present.
 */
export function classifyTimetableCell(rawText: string): ClassifiedCell {
  const clean = rawText.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();

  // 1. Check for Free / Unassigned Period
  if (
    !clean ||
    /^(nil|none|na|n\/a|-|--|free|free\s*period|empty|recreation)$/i.test(lower) ||
    lower.includes('free period') ||
    lower.includes('library') ||
    lower.includes('leisure') ||
    lower.includes('sports') ||
    lower.includes('games') ||
    lower.includes('unassigned')
  ) {
    let title = 'Free Period';
    if (lower.includes('library')) title = 'Library / Self Study';
    else if (lower.includes('sports') || lower.includes('games')) title = 'Sports / Recreation';
    else if (clean && clean !== '-' && clean !== '--') title = clean;
    return { type: 'free_period', title, customTitle: title, confidence: 95 };
  }

  // 2. Check for Breaks (Lunch, Tea, Snack, Interval, Recess)
  if (
    lower.includes('break') ||
    lower.includes('lunch') ||
    lower.includes('tea') ||
    lower.includes('coffee') ||
    lower.includes('recess') ||
    lower.includes('interval') ||
    lower.includes('tiffin') ||
    lower.includes('snack')
  ) {
    let title = clean;
    if (lower === 'lunch' || lower === 'lunch break') title = 'Lunch Break';
    else if (lower === 'tea' || lower === 'tea break') title = 'Tea Break';
    else if (lower.includes('lunch') || lower.includes('tiffin')) title = clean;
    return { type: 'break', title, customTitle: title, confidence: 95 };
  }

  // Extract Room / Venue if written in parentheses, brackets, or after slash
  // e.g. "Mathematics (LH-101)", "OS Lab [Lab 3]", "Physics / Room 204"
  let extractedRoom: string | undefined;
  let subjectText = clean;

  const roomParenMatch = clean.match(/\s*[([]([A-Za-z0-9\-\s]+)[)\]]$/i);
  if (roomParenMatch && roomParenMatch.index !== undefined) {
    extractedRoom = roomParenMatch[1].trim();
    subjectText = clean.slice(0, roomParenMatch.index).trim();
  } else {
    const slashMatch = clean.match(/\s*\/\s*(?:room|lab|lh)?\s*([A-Za-z0-9\-\s]+)$/i);
    if (slashMatch && slashMatch[1].length <= 15 && slashMatch.index !== undefined) {
      extractedRoom = slashMatch[1].trim();
      subjectText = clean.slice(0, slashMatch.index).trim();
    }
  }

  // 3. Lab / Practical
  if (
    lower.includes('lab') ||
    lower.includes('practical') ||
    lower.includes('workshop') ||
    lower.includes('hands-on') ||
    lower.includes('computing lab')
  ) {
    return {
      type: 'lab',
      title: subjectText,
      subjectCandidate: subjectText,
      room: extractedRoom,
      confidence: 92,
    };
  }

  // 4. Tutorial
  if (lower.includes('tutorial') || lower.includes('tut')) {
    return {
      type: 'tutorial',
      title: subjectText,
      subjectCandidate: subjectText,
      room: extractedRoom,
      confidence: 90,
    };
  }

  // 5. Study / Revision
  if (lower.includes('personal study') || lower.includes('self study') || lower.includes('revision')) {
    return {
      type: 'study',
      title: subjectText,
      subjectCandidate: subjectText,
      room: extractedRoom,
      confidence: 88,
    };
  }

  // 6. Default Lecture
  return {
    type: 'lecture',
    title: subjectText,
    subjectCandidate: subjectText,
    room: extractedRoom,
    confidence: 85,
  };
}

/**
 * Matches extracted subject text against user's existing registered subjects.
 */
export function matchSubjectWithExisting(
  subjectText: string,
  subjects: Subject[]
): Subject | undefined {
  if (!subjectText || subjects.length === 0) return undefined;
  const clean = subjectText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Exact subject code match (e.g. "CS501", "22CS501", "MAT101")
  const codeMatch = subjects.find(
    (s) => s.code && s.code.toLowerCase().trim() === clean
  );
  if (codeMatch) return codeMatch;

  // 2. Exact subject name match
  const nameMatch = subjects.find(
    (s) => s.name.toLowerCase().trim() === clean
  );
  if (nameMatch) return nameMatch;

  // 3. Subject code contained in subjectText
  const codeContained = subjects.find(
    (s) => s.code && clean.includes(s.code.toLowerCase().trim())
  );
  if (codeContained) return codeContained;

  // 4. Acronym mapping (e.g. "DBMS" -> "Database Management Systems", "OS" -> "Operating Systems")
  for (const s of subjects) {
    const words = s.name.split(/[\s\-_]+/).filter((w) => w.length > 0);
    if (words.length >= 2) {
      const acronymDirect = words.map((w) => w[0]).join('').toLowerCase();
      if (acronymDirect === clean) return s;

      // Handle 'Database' -> 'db' (e.g. DBMS -> Database Management Systems)
      const acronymDb = words
        .map((w) => (w.toLowerCase() === 'database' ? 'db' : w[0]))
        .join('')
        .toLowerCase();
      if (acronymDb === clean) return s;
    }
  }

  // 5. Substring / contains match
  const containsMatch = subjects.find(
    (s) =>
      clean.length > 3 &&
      (s.name.toLowerCase().includes(clean) || clean.includes(s.name.toLowerCase()))
  );
  if (containsMatch) return containsMatch;

  return undefined;
}

function createDetectedSubjects(unmatchedNames: string[]): Subject[] {
  const PRESET_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
  return unmatchedNames.map((name, i) => ({
    id: `subj-auto-${Date.now()}-${i}`,
    name,
    code: name.length <= 10 && !name.includes(' ') ? name : undefined,
    semester: 'Current Sem',
    academicYear: '2025-2026',
    credits: 3,
    color: PRESET_COLORS[i % PRESET_COLORS.length],
    attendanceThreshold: 75,
    targetScore: 80,
    difficulty: 3 as const,
    assessmentComponents: [],
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Parses spreadsheet or CSV timetable into timetable preview slots.
 */
export async function parseSpreadsheetTimetable(
  data: ArrayBuffer | Uint8Array,
  filename: string,
  subjects: Subject[] = []
): Promise<TimetableExtractionResult> {
  const warnings: string[] = [];
  const workbook = XLSX.read(data, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return { slots: [], unmatchedSubjectNames: [], warnings: ['Spreadsheet contains no sheets.'], totalRawRowsScanned: 0 };
  }

  // Find sheet with timetable data (score by presence of days or times)
  let bestSheetName = workbook.SheetNames[0];
  let maxScore = -1;

  for (const sName of workbook.SheetNames) {
    const s = workbook.Sheets[sName];
    if (!s) continue;
    const sRows: any[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: false });
    let score = 0;
    for (let r = 0; r < Math.min(10, sRows.length); r++) {
      const row = sRows[r];
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const val = String(cell || '').trim();
        if (parseTimeRange(val)) score += 10;
        if (parseDayOfWeek(val)) score += 10;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestSheetName = sName;
    }
  }

  const sheet = workbook.Sheets[bestSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  if (rows.length === 0) {
    return { slots: [], unmatchedSubjectNames: [], warnings: ['Spreadsheet is empty.'], totalRawRowsScanned: 0 };
  }

  const slots: ExtractedTimetableSlotPreview[] = [];
  const unmatchedSet = new Set<string>();

  // Determine layout:
  // Strategy 1: Grid Matrix - Days as Rows (Col 0), Time ranges as Columns (Row 0..2)
  let timeHeaderRowIndex = -1;
  const timeCols: { col: number; startTime: string; endTime: string }[] = [];

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const parsedCols: { col: number; startTime: string; endTime: string }[] = [];

    for (let c = 1; c < row.length; c++) {
      const val = String(row[c] || '').trim();
      const tr = parseTimeRange(val);
      if (tr) {
        parsedCols.push({ col: c, ...tr });
      }
    }

    if (parsedCols.length >= 2) {
      timeHeaderRowIndex = r;
      timeCols.push(...parsedCols);
      break;
    }
  }

  if (timeHeaderRowIndex !== -1 && timeCols.length > 0) {
    // Strategy 1: Days along rows, Times along columns
    for (let r = timeHeaderRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const dayCell = String(row[0] || '').trim();
      const dayInfo = parseDayOfWeek(dayCell);
      if (!dayInfo) continue;

      for (const tCol of timeCols) {
        if (row.length <= tCol.col) continue;
        const cellVal = String(row[tCol.col] || '').trim();
        if (!cellVal) continue;

        const classification = classifyTimetableCell(cellVal);
        let subjectId = '';
        let matchedSubjectName: string | undefined;

        if (classification.type !== 'break' && classification.type !== 'free_period') {
          const matched = matchSubjectWithExisting(classification.title, subjects);
          if (matched) {
            subjectId = matched.id;
            matchedSubjectName = matched.name;
          } else {
            unmatchedSet.add(classification.title);
          }
        }

        slots.push({
          tempId: `slot-${Date.now()}-${r}-${tCol.col}`,
          dayOfWeek: dayInfo.dayNum,
          dayName: dayInfo.dayName,
          startTime: tCol.startTime,
          endTime: tCol.endTime,
          type: classification.type,
          rawText: cellVal,
          customTitle: classification.type === 'break' || classification.type === 'free_period' || !subjectId ? classification.title : undefined,
          subjectId,
          matchedSubjectName,
          room: classification.room,
          confidence: classification.confidence,
        });
      }
    }

    if (slots.length > 0) {
      const unmatchedList = Array.from(unmatchedSet);
      return {
        slots: slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
        unmatchedSubjectNames: unmatchedList,
        detectedSubjects: createDetectedSubjects(unmatchedList),
        strategy: 'Day x Time Matrix',
        warnings,
        totalRawRowsScanned: rows.length,
      };
    }
  }

  // Strategy 2: Grid Matrix - Times in Column 0, Days in Header Row
  let dayHeaderRowIndex = -1;
  const dayCols: { col: number; dayNum: 1 | 2 | 3 | 4 | 5 | 6 | 7; dayName: string }[] = [];

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const parsedCols: { col: number; dayNum: 1 | 2 | 3 | 4 | 5 | 6 | 7; dayName: string }[] = [];

    for (let c = 1; c < row.length; c++) {
      const val = String(row[c] || '').trim();
      const d = parseDayOfWeek(val);
      if (d) {
        parsedCols.push({ col: c, ...d });
      }
    }

    if (parsedCols.length >= 2) {
      dayHeaderRowIndex = r;
      dayCols.push(...parsedCols);
      break;
    }
  }

  if (dayHeaderRowIndex !== -1 && dayCols.length > 0) {
    // Strategy 2: Times along rows, Days along columns
    for (let r = dayHeaderRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const timeCell = String(row[0] || '').trim();
      const tr = parseTimeRange(timeCell);
      if (!tr) continue;

      for (const dCol of dayCols) {
        if (row.length <= dCol.col) continue;
        const cellVal = String(row[dCol.col] || '').trim();
        if (!cellVal) continue;

        const classification = classifyTimetableCell(cellVal);
        let subjectId = '';
        let matchedSubjectName: string | undefined;

        if (classification.type !== 'break' && classification.type !== 'free_period') {
          const matched = matchSubjectWithExisting(classification.title, subjects);
          if (matched) {
            subjectId = matched.id;
            matchedSubjectName = matched.name;
          } else {
            unmatchedSet.add(classification.title);
          }
        }

        slots.push({
          tempId: `slot-${Date.now()}-${r}-${dCol.col}`,
          dayOfWeek: dCol.dayNum,
          dayName: dCol.dayName,
          startTime: tr.startTime,
          endTime: tr.endTime,
          type: classification.type,
          rawText: cellVal,
          customTitle: classification.type === 'break' || classification.type === 'free_period' || !subjectId ? classification.title : undefined,
          subjectId,
          matchedSubjectName,
          room: classification.room,
          confidence: classification.confidence,
        });
      }
    }

    if (slots.length > 0) {
      const unmatchedList = Array.from(unmatchedSet);
      return {
        slots: slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
        unmatchedSubjectNames: unmatchedList,
        detectedSubjects: createDetectedSubjects(unmatchedList),
        strategy: 'Time x Day Matrix',
        warnings,
        totalRawRowsScanned: rows.length,
      };
    }
  }

  // Strategy 3: Tabular Column List format (Day, Start, End, Subject, Type, Room)
  let dayCol = -1;
  let startCol = -1;
  let endCol = -1;
  let timeCol = -1;
  let subjectCol = -1;
  let typeCol = -1;
  let roomCol = -1;

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (/^(day|weekday|days)$/i.test(cell)) dayCol = c;
      else if (/^(start\s*time|start|from)$/i.test(cell)) startCol = c;
      else if (/^(end\s*time|end|to)$/i.test(cell)) endCol = c;
      else if (/^(time|time\s*slot|period\s*time|slot)$/i.test(cell)) timeCol = c;
      else if (/^(subject|course|class|activity|title|name)$/i.test(cell)) subjectCol = c;
      else if (/^(type|session\s*type|category)$/i.test(cell)) typeCol = c;
      else if (/^(room|venue|classroom|lab|location)$/i.test(cell)) roomCol = c;
    }

    if ((dayCol !== -1 || timeCol !== -1 || startCol !== -1) && subjectCol !== -1) {
      break;
    }
  }

  // Fallback defaults for list
  if (dayCol === -1) dayCol = 0;
  if (subjectCol === -1) subjectCol = 1;
  if (startCol === -1 && timeCol === -1) timeCol = 2;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const dayCell = String(row[dayCol] || '').trim();
    const dayInfo = parseDayOfWeek(dayCell);
    if (!dayInfo) continue;

    const rawSubject = String(row[subjectCol] || '').trim();
    if (!rawSubject) continue;

    let startTime = '09:00';
    let endTime = '10:00';

    if (startCol !== -1 && endCol !== -1 && row[startCol] && row[endCol]) {
      const s = String(row[startCol]).trim();
      const e = String(row[endCol]).trim();
      const tr = parseTimeRange(`${s} - ${e}`);
      if (tr) {
        startTime = tr.startTime;
        endTime = tr.endTime;
      }
    } else if (timeCol !== -1 && row[timeCol]) {
      const tr = parseTimeRange(String(row[timeCol]));
      if (tr) {
        startTime = tr.startTime;
        endTime = tr.endTime;
      }
    }

    const classification = classifyTimetableCell(rawSubject);
    let sessionType = classification.type;

    if (typeCol !== -1 && row[typeCol]) {
      const rawType = String(row[typeCol]).toLowerCase().trim();
      if (rawType.includes('break') || rawType.includes('lunch')) sessionType = 'break';
      else if (rawType.includes('free')) sessionType = 'free_period';
      else if (rawType.includes('lab')) sessionType = 'lab';
      else if (rawType.includes('tut')) sessionType = 'tutorial';
      else if (rawType.includes('study')) sessionType = 'study';
      else if (rawType.includes('lecture')) sessionType = 'lecture';
    }

    const room = roomCol !== -1 && row[roomCol] ? String(row[roomCol]).trim() : classification.room;

    let subjectId = '';
    let matchedSubjectName: string | undefined;

    if (sessionType !== 'break' && sessionType !== 'free_period') {
      const matched = matchSubjectWithExisting(classification.title, subjects);
      if (matched) {
        subjectId = matched.id;
        matchedSubjectName = matched.name;
      } else {
        unmatchedSet.add(classification.title);
      }
    }

    slots.push({
      tempId: `slot-list-${Date.now()}-${r}`,
      dayOfWeek: dayInfo.dayNum,
      dayName: dayInfo.dayName,
      startTime,
      endTime,
      type: sessionType,
      rawText: rawSubject,
      customTitle: sessionType === 'break' || sessionType === 'free_period' || !subjectId ? classification.title : undefined,
      subjectId,
      matchedSubjectName,
      room,
      confidence: classification.confidence,
    });
  }

  if (slots.length === 0) {
    warnings.push('Could not detect timetable slots. Please verify your file uses a Day/Time matrix or standard Day, Time, Subject list columns.');
  }

  const unmatchedList = Array.from(unmatchedSet);
  return {
    slots: slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    unmatchedSubjectNames: unmatchedList,
    detectedSubjects: createDetectedSubjects(unmatchedList),
    strategy: 'Tabular List',
    warnings,
    totalRawRowsScanned: rows.length,
  };
}

/**
 * Generates a clean, editable sample CSV timetable template.
 */
export function generateSampleTimetableCsv(): string {
  return `Day,Start Time,End Time,Subject / Activity,Type,Room,Notes
Monday,09:00,10:00,Mathematics,lecture,LH-101,Prof. Raman
Monday,10:00,11:00,Operating Systems,lecture,LH-101,
Monday,11:00,11:15,Tea Break,break,,Cafeteria
Monday,11:15,12:15,Data Structures,lecture,LH-102,
Monday,12:15,13:15,Lunch Break,break,,Student Center
Monday,13:15,15:15,OS Lab,lab,Computing Lab 3,Batch A
Monday,15:15,16:15,Free Period,free_period,,Library / Self Study
Tuesday,09:00,10:00,Computer Networks,lecture,LH-201,
Tuesday,10:00,11:00,Database Management,lecture,LH-201,
Tuesday,11:00,11:15,Tea Break,break,,
Tuesday,11:15,12:15,Free Period,free_period,,Self Study
Tuesday,12:15,13:15,Lunch Break,break,,
Tuesday,13:15,14:15,Mathematics,tutorial,LH-101,Problem Solving
Tuesday,14:15,16:15,DBMS Lab,lab,Database Lab 1,Batch B
Wednesday,09:00,10:00,Operating Systems,lecture,LH-101,
Wednesday,10:00,11:00,Computer Networks,lecture,LH-201,
Wednesday,11:00,11:15,Tea Break,break,,
Wednesday,11:15,12:15,Mathematics,lecture,LH-101,
Wednesday,12:15,13:15,Lunch Break,break,,
Wednesday,13:15,14:15,Data Structures,lecture,LH-102,
Wednesday,14:15,15:15,Free Period,free_period,,Seminar Prep
Thursday,09:00,10:00,Database Management,lecture,LH-201,
Thursday,10:00,11:00,Data Structures,lecture,LH-102,
Thursday,11:00,11:15,Tea Break,break,,
Thursday,11:15,12:15,Computer Networks,lecture,LH-201,
Thursday,12:15,13:15,Lunch Break,break,,
Thursday,13:15,15:15,Networks Lab,lab,Networking Lab,
Friday,09:00,10:00,Operating Systems,lecture,LH-101,
Friday,10:00,11:00,Mathematics,lecture,LH-101,
Friday,11:00,11:15,Tea Break,break,,
Friday,11:15,12:15,Database Management,lecture,LH-201,
Friday,12:15,13:15,Lunch Break,break,,
Friday,13:15,14:15,Free Period,free_period,,Mentoring
Friday,14:15,15:15,Personal Study,study,Library,Revision
`;
}
