import * as XLSX from 'xlsx';
import { AcademicEvent, AcademicEventType, EventReviewStatus } from '../types';
import { parseISO, isValid, format, parse } from 'date-fns';

export interface ExtractedEventPreview {
  tempId: string;
  title: string;
  eventType: AcademicEventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  allDay: boolean;
  description?: string;
  sourceName: string;
  confidence: number;
  reviewStatus: EventReviewStatus;
  conflictReason?: string;
}

export interface CalendarExtractionResult {
  detectedSemester?: string;
  detectedAcademicYear?: string;
  events: ExtractedEventPreview[];
  warnings: string[];
  totalRawRowsScanned: number;
}

/**
 * Standardizes various date string representations into YYYY-MM-DD.
 */
export function parseFlexibleDate(dateStr: string, defaultYear: number = new Date().getFullYear()): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Pure weekday names are NOT dates: e.g. "Mon", "Tue", "Wed", "Thur", "Friday"
  const WEEKDAY_NAMES = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thur|thurs|fri|sat|sun)\.?$/i;
  if (WEEKDAY_NAMES.test(clean)) return null;

  // Try direct ISO YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const d = parseISO(clean);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }

  // Strip weekday names and enclosing parens if part of date: e.g. "07-11-2024 (Thursday)" -> "07-11-2024"
  const stripped = clean
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thur|thurs|fri|sat|sun)\b\.?/gi, '')
    .replace(/[(),]/g, ' ')
    .trim();

  // Common date formats (including dot separators used in Indian and European university calendars)
  const formats = [
    'dd.MM.yyyy',
    'd.M.yyyy',
    'dd.MM.yy',
    'd.M.yy',
    'dd/MM/yyyy',
    'd/M/yyyy',
    'dd/MM/yy',
    'd/M/yy',
    'dd-MM-yyyy',
    'd-M-yyyy',
    'dd-MM-yy',
    'd-M-yy',
    'MM/dd/yyyy',
    'M/d/yyyy',
    'MM-dd-yyyy',
    'M-d-yyyy',
    'dd MMM yyyy',
    'd MMM yyyy',
    'dd-MMM-yyyy',
    'd-MMM-yyyy',
    'dd-MMMM-yyyy',
    'dd MMMM yyyy',
    'd MMMM yyyy',
    'MMMM d, yyyy',
    'MMM d, yyyy',
    'MMMM d yyyy',
    'MMM d yyyy',
    'yyyy/MM/dd',
    'yyyy.MM.dd',
    'dd MMM yy',
    'd MMM yy',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(stripped, fmt, new Date());
      if (isValid(parsed) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
        return format(parsed, 'yyyy-MM-dd');
      }
    } catch {
      // Continue to next format
    }
  }

  // Handle format like "15th August 2024" or "2nd Oct 2024"
  const ordinalClean = stripped.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  if (ordinalClean !== stripped) {
    const res = parseFlexibleDate(ordinalClean, defaultYear);
    if (res) return res;
  }

  // Date without year, e.g. "15 Aug", "10/12", "07.11"
  const formatsNoYear = ['dd.MM', 'd.M', 'dd MMM', 'd MMM', 'dd-MMM', 'd-MMM', 'dd MMMM', 'd MMMM', 'dd/MM', 'dd-MM', 'd/M', 'd-M'];
  for (const fmt of formatsNoYear) {
    try {
      const parsed = parse(ordinalClean, fmt, new Date(defaultYear, 0, 1));
      if (isValid(parsed)) {
        parsed.setFullYear(defaultYear);
        return format(parsed, 'yyyy-MM-dd');
      }
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Classifies an event title and description into an AcademicEventType.
 */
export function classifyAcademicEvent(text: string): { type: AcademicEventType; confidence: number } {
  const lower = text.toLowerCase().trim();

  // 1. Examination patterns (including Semester End Exam "SEE", Midterms, Internal Assessments, Formative Assessments, MSE)
  if (
    lower.includes('mid term') ||
    lower.includes('midterm') ||
    lower.includes('end sem') ||
    lower.includes('end-sem') ||
    lower.includes('final exam') ||
    lower.includes('theory exam') ||
    lower.includes('internal assessment') ||
    lower.includes('formative assessment') ||
    lower.includes('continuous internal assessment') ||
    lower.includes('cia ') ||
    lower.includes('examination') ||
    lower.includes('quiz') ||
    lower.startsWith('see:') ||
    lower.startsWith('see ') ||
    lower.includes('see:') ||
    lower.includes('see -') ||
    lower.includes('see: ') ||
    lower.includes('semester end examination') ||
    /\b(mse|see)\b/i.test(text) ||
    /\b(mid\s*sem|mid-sem|mid\s*semester)\b/i.test(text)
  ) {
    return { type: 'rescheduled_exam', confidence: 92 };
  }

  if (lower.includes('lab exam') || lower.includes('practical exam') || lower.includes('viva voce') || lower.includes('viva')) {
    return { type: 'cancelled_lab', confidence: 90 };
  }

  // 2. Official Holidays (Indian National & Regional Holidays, Festival Holidays)
  if (
    lower.includes('holiday') ||
    lower.includes('diwali') ||
    lower.includes('deepavali') ||
    lower.includes('christmas') ||
    lower.includes('eid') ||
    lower.includes('gandhi jayanti') ||
    lower.includes('independence day') ||
    lower.includes('republic day') ||
    lower.includes('kannada rajyothsava') ||
    lower.includes('rajyotsava') ||
    lower.includes('naraka chaturdashi') ||
    lower.includes('balipadyami') ||
    lower.includes('mahanavami') ||
    lower.includes('vijayadasmi') ||
    lower.includes('vijayadashami') ||
    lower.includes('kanakadasa jayanthi') ||
    lower.includes('kanakadasa') ||
    lower.includes('mahalaya') ||
    lower.includes('mahaliaya') ||
    lower.includes('amavsya') ||
    lower.includes('amavasya') ||
    lower.includes('ganesh chaturthi') ||
    lower.includes('vinayaka') ||
    lower.includes('pongal') ||
    lower.includes('makar sankranti') ||
    lower.includes('sankranti') ||
    lower.includes('ugadi') ||
    lower.includes('dusserah') ||
    lower.includes('dasara') ||
    lower.includes('ayudha pooja') ||
    lower.includes('mahavir jayanti') ||
    lower.includes('mahaveera') ||
    lower.includes('buddha purnima') ||
    lower.includes('good friday') ||
    lower.includes('muharram') ||
    lower.includes('bakrid') ||
    lower.includes('new year') ||
    lower.includes('shivratri') ||
    lower.includes('maha shivratri') ||
    lower.includes('milad') ||
    lower.includes('ambedkar') ||
    lower.includes('basava') ||
    lower.includes('may day') ||
    lower.includes('labour day') ||
    lower.includes('labor day') ||
    lower.includes('closed')
  ) {
    return { type: 'official_holiday', confidence: 95 };
  }

  // 3. Vacations & Breaks & Last Working Day
  if (
    lower.includes('vacation') ||
    lower.includes('semester break') ||
    lower.includes('winter break') ||
    lower.includes('summer break') ||
    lower.includes('study holidays') ||
    lower.includes('preparatory leave') ||
    lower.includes('prep leave') ||
    lower.includes('last working day') ||
    lower.includes('last instruction day')
  ) {
    return { type: 'vacation_break', confidence: 92 };
  }

  // 4. Deadlines & Compilation & CIA Marks
  if (
    lower.includes('submission') ||
    lower.includes('deadline') ||
    lower.includes('last date') ||
    lower.includes('closing date') ||
    lower.includes('project report') ||
    lower.includes('assignment') ||
    lower.includes('compilation of attendance') ||
    lower.includes('uploading cia marks') ||
    lower.includes('cia marks')
  ) {
    return { type: 'assignment_deadline', confidence: 88 };
  }

  // 5. College Events, Meetings, PTM, ARM & Fests
  if (
    lower.includes('fest') ||
    lower.includes('symposium') ||
    lower.includes('conference') ||
    lower.includes('hackathon') ||
    lower.includes('sports day') ||
    lower.includes('annual day') ||
    lower.includes('induction') ||
    lower.includes('orientation') ||
    lower.includes('cultural') ||
    lower.includes('meeting') ||
    lower.includes('chairs meeting') ||
    lower.includes('ptm') ||
    lower.includes('parent teacher meeting') ||
    lower.includes('arm (') ||
    lower.includes('academic review meeting')
  ) {
    return { type: 'college_event', confidence: 85 };
  }

  // 6. Registration & Academic Schedule
  if (
    lower.includes('registration') ||
    lower.includes('fee payment') ||
    lower.includes('enrollment') ||
    lower.includes('hall ticket') ||
    lower.includes('commencement of class') ||
    lower.includes('commencement of semester') ||
    lower.includes('start of class')
  ) {
    return { type: 'registration_deadline', confidence: 88 };
  }

  // Fallback
  return { type: 'other', confidence: 60 };
}

export const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const MONTH_REGEX = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;

export function extractMonthFromText(text: string): { month: number; year?: number } | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  const match = clean.match(MONTH_REGEX);
  if (!match) return null;

  const month = MONTH_NAME_TO_NUMBER[match[1].toLowerCase()];
  if (!month) return null;

  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  return { month, year };
}

export function inferMonthFromLandmark(text: string, rawDate?: string): number | null {
  const lower = text.toLowerCase();
  const day = rawDate ? parseInt(rawDate, 10) : NaN;
  if (lower.includes('independence day') && (isNaN(day) || day === 15)) return 8; // Aug 15
  if (lower.includes('republic day') && (isNaN(day) || day === 26)) return 1; // Jan 26
  if (lower.includes('gandhi jayanti') && (isNaN(day) || day === 2)) return 10; // Oct 2
  if (lower.includes('christmas') && (isNaN(day) || day === 25)) return 12; // Dec 25
  if (lower.includes('teachers day') && (isNaN(day) || day === 5)) return 9; // Sep 5
  if (lower.includes('engineers day') && (isNaN(day) || day === 15)) return 9; // Sep 15
  if (lower.includes('national science day') && (isNaN(day) || day === 28)) return 2; // Feb 28
  return null;
}

export const HEADER_WORDS = new Set([
  'particulars',
  'particular',
  'event',
  'events',
  'activity',
  'activities',
  'description',
  'title',
  'details',
  'sl. no.',
  'sl no',
  'sl.no',
  's.no',
  'date',
  'dates',
  'day',
  'days',
  'schedule of events',
  'nature of activity',
]);

export interface MonthMatrixBlock {
  monthName: string;
  month: number;
  year: number;
  startCol: number;
  endCol: number;
  dateCol: number;
  particularsCol: number;
  categoryCol?: number;
}

/**
 * Extracts events from multi-month side-by-side matrix calendars
 * (e.g., Indian engineering universities like Dayananda Sagar University, VTU, autonomous institutions).
 */
export function parseMultiMonthMatrix(
  rows: any[][],
  filename: string,
  existingEvents: AcademicEvent[] = [],
  baseAcademicStartYear: number
): CalendarExtractionResult | null {
  // Look for a row with 2 or more distinct month columns
  let matrixHeaderRow = -1;
  let detectedMonthCols: { col: number; month: number; monthName: string; year: number }[] = [];

  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const rowMonths: { col: number; month: number; monthName: string; year: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim();
      if (!val || val.length > 30) continue;
      const mInfo = extractMonthFromText(val);
      if (
        mInfo &&
        /^(month\s*[:\-]?\s*)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(\s*[-–/]?\s*20\d{2})?$/i.test(
          val
        )
      ) {
        const year = mInfo.year || (mInfo.month >= 7 ? baseAcademicStartYear : baseAcademicStartYear + 1);
        rowMonths.push({ col: c, month: mInfo.month, monthName: val, year });
      }
    }

    if (rowMonths.length >= 2) {
      matrixHeaderRow = r;
      detectedMonthCols = rowMonths;
      break;
    }
  }

  if (matrixHeaderRow === -1 || detectedMonthCols.length < 2) {
    return null;
  }

  detectedMonthCols.sort((a, b) => a.col - b.col);

  // Subheader row (typically matrixHeaderRow + 1, e.g. "Date", "Particulars", "#WD")
  const subheaderRow = matrixHeaderRow + 1 < rows.length ? rows[matrixHeaderRow + 1] : null;
  const blocks: MonthMatrixBlock[] = [];

  for (let i = 0; i < detectedMonthCols.length; i++) {
    const cur = detectedMonthCols[i];
    const startCol = cur.col;
    const nextStart = i < detectedMonthCols.length - 1 ? detectedMonthCols[i + 1].col : Math.max(startCol + 3, rows[matrixHeaderRow].length);
    const endCol = nextStart - 1;

    let dateCol = -1;
    let particularsCol = -1;
    let categoryCol = -1;

    // Check subheader row first
    if (subheaderRow && Array.isArray(subheaderRow)) {
      for (let c = startCol; c <= endCol && c < subheaderRow.length; c++) {
        const subVal = String(subheaderRow[c] || '').toLowerCase().trim();
        if (subVal.includes('date') || subVal === 'd' || subVal === 'day') {
          if (dateCol === -1) dateCol = c;
        } else if (
          subVal.includes('particular') ||
          subVal.includes('event') ||
          subVal.includes('activity') ||
          subVal.includes('description') ||
          subVal.includes('details') ||
          subVal.includes('title')
        ) {
          if (particularsCol === -1) particularsCol = c;
        } else if (
          subVal.includes('type') ||
          subVal.includes('category') ||
          subVal.includes('wd') ||
          subVal.includes('working')
        ) {
          if (categoryCol === -1) categoryCol = c;
        }
      }
    }

    // Fallback: scan data rows in this column range to detect day numbers vs text
    if (dateCol === -1 || particularsCol === -1) {
      const scanStart = matrixHeaderRow + 2;
      const scanEnd = Math.min(rows.length, scanStart + 20);
      const numCounts = new Map<number, number>();
      const textCounts = new Map<number, number>();

      for (let sr = scanStart; sr < scanEnd; sr++) {
        const srow = rows[sr];
        if (!Array.isArray(srow)) continue;
        for (let sc = startCol; sc <= endCol && sc < srow.length; sc++) {
          const sval = String(srow[sc] || '').trim();
          if (!sval) continue;
          if (/^\d{1,2}$/.test(sval)) {
            numCounts.set(sc, (numCounts.get(sc) || 0) + 1);
          } else if (sval.length >= 2 && !/^\d+$/.test(sval)) {
            textCounts.set(sc, (textCounts.get(sc) || 0) + 1);
          }
        }
      }

      if (dateCol === -1) {
        let maxNums = -1;
        for (const [col, cnt] of numCounts.entries()) {
          if (cnt > maxNums) {
            maxNums = cnt;
            dateCol = col;
          }
        }
      }

      if (particularsCol === -1) {
        let maxText = -1;
        for (const [col, cnt] of textCounts.entries()) {
          if (col !== dateCol && cnt > maxText) {
            maxText = cnt;
            particularsCol = col;
          }
        }
      }
    }

    if (dateCol === -1) dateCol = startCol;
    if (particularsCol === -1) particularsCol = startCol + 1;

    blocks.push({
      monthName: cur.monthName,
      month: cur.month,
      year: cur.year,
      startCol,
      endCol,
      dateCol,
      particularsCol,
      categoryCol: categoryCol !== -1 ? categoryCol : undefined,
    });
  }

  // Determine starting row for data rows
  let dataStartRow = matrixHeaderRow + 1;
  if (subheaderRow && Array.isArray(subheaderRow)) {
    const subStr = subheaderRow.map((c) => String(c || '').toLowerCase()).join(' ');
    if (subStr.includes('date') || subStr.includes('particular') || subStr.includes('#wd') || subStr.includes('event')) {
      dataStartRow = matrixHeaderRow + 2;
    }
  }

  const extractedEvents: ExtractedEventPreview[] = [];
  const warnings: string[] = [];

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const rowJoined = row.map((c) => String(c || '').trim()).join(' ').toLowerCase();
    if (
      rowJoined.startsWith('total working days') ||
      rowJoined.startsWith('cumulative') ||
      rowJoined.startsWith('cumalative') ||
      rowJoined.startsWith('total number of working') ||
      rowJoined.startsWith('legend:') ||
      rowJoined.startsWith('note:')
    ) {
      break;
    }

    for (const block of blocks) {
      if (row.length <= Math.max(block.dateCol, block.particularsCol)) continue;

      const rawTitle = String(row[block.particularsCol] || '').trim();
      if (!rawTitle || rawTitle.length < 2) continue;

      const cleanTitle = rawTitle.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanTitle.length < 2) continue;

      const lowerTitle = cleanTitle.toLowerCase();
      if (HEADER_WORDS.has(lowerTitle) || /^(date|particulars|#wd|wd|working days|sl\.?\s*no\.?)$/i.test(lowerTitle)) {
        continue;
      }

      const rawDate = String(row[block.dateCol] || '').trim();
      let startDate: string | null = null;
      let endDate: string | null = null;

      const cleanDateStr = rawDate
        .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thur|thurs|fri|sat|sun)\b\.?/gi, '')
        .replace(/[(),]/g, ' ')
        .trim();

      // 1. Single day number
      const dayNumMatch = cleanDateStr.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
      if (dayNumMatch) {
        const day = parseInt(dayNumMatch[1], 10);
        if (day >= 1 && day <= 31) {
          const paddedDay = String(day).padStart(2, '0');
          const paddedMonth = String(block.month).padStart(2, '0');
          startDate = `${block.year}-${paddedMonth}-${paddedDay}`;
          endDate = startDate;
        }
      }

      // 2. Day range in date cell (e.g. "7 - 22", "16-31")
      if (!startDate) {
        const dayRangeMatch = cleanDateStr.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*[-–to]+\s*(\d{1,2})(?:st|nd|rd|th)?$/);
        if (dayRangeMatch) {
          const startDay = parseInt(dayRangeMatch[1], 10);
          const endDay = parseInt(dayRangeMatch[2], 10);
          if (startDay >= 1 && startDay <= 31 && endDay >= 1 && endDay <= 31) {
            const paddedStart = String(startDay).padStart(2, '0');
            const paddedEnd = String(endDay).padStart(2, '0');
            const paddedMonth = String(block.month).padStart(2, '0');
            startDate = `${block.year}-${paddedMonth}-${paddedStart}`;
            endDate = `${block.year}-${paddedMonth}-${paddedEnd}`;
          }
        }
      }

      // 3. Flexible date in date cell
      if (!startDate && rawDate) {
        const parsed = parseFlexibleDate(rawDate, block.year);
        if (parsed) {
          startDate = parsed;
          endDate = parsed;
        }
      }

      // 4. If rawDate was empty, check if title starts with day number (e.g. "15 Independence Day")
      if (!startDate) {
        const titleDayMatch = cleanTitle.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*[-–:]\s*(.+)$/);
        if (titleDayMatch) {
          const day = parseInt(titleDayMatch[1], 10);
          if (day >= 1 && day <= 31) {
            const paddedDay = String(day).padStart(2, '0');
            const paddedMonth = String(block.month).padStart(2, '0');
            startDate = `${block.year}-${paddedMonth}-${paddedDay}`;
            endDate = startDate;
          }
        }
      }

      // 5. Expand range if title contains range matching startDate (e.g. "SEE: 7 -22 for 3rd, 5th & 7th Sem")
      if (startDate && startDate === endDate) {
        const titleRangeMatch = cleanTitle.match(/\b(\d{1,2})\s*[-–to]+\s*(\d{1,2})\b/);
        if (titleRangeMatch) {
          const startDay = parseInt(titleRangeMatch[1], 10);
          const endDay = parseInt(titleRangeMatch[2], 10);
          const [sYear, sMonth, sDateNum] = startDate.split('-').map(Number);
          if (sDateNum === startDay && endDay > startDay && endDay <= 31) {
            const paddedEnd = String(endDay).padStart(2, '0');
            const paddedMonth = String(sMonth).padStart(2, '0');
            endDate = `${sYear}-${paddedMonth}-${paddedEnd}`;
          }
        }
      }

      if (!startDate) {
        warnings.push(`Row ${r + 1}: Could not parse date "${rawDate}" for event "${cleanTitle}" in ${block.monthName}.`);
        continue;
      }

      if (!endDate) endDate = startDate;

      const { type, confidence } = classifyAcademicEvent(cleanTitle);

      const isDuplicate = existingEvents.some(
        (e) => e.title.toLowerCase() === cleanTitle.toLowerCase() && e.startDate === startDate
      );

      const isConflict = existingEvents.some(
        (e) =>
          e.startDate === startDate &&
          (e.eventType === 'rescheduled_exam' || e.eventType === 'official_holiday') &&
          e.title.toLowerCase() !== cleanTitle.toLowerCase()
      );

      let reviewStatus: EventReviewStatus = 'new';
      let conflictReason: string | undefined;

      if (isDuplicate) {
        reviewStatus = 'duplicate';
      } else if (isConflict) {
        reviewStatus = 'conflicting';
        conflictReason = `Conflicts with another existing event on ${startDate}`;
      } else if (confidence < 75) {
        reviewStatus = 'needs_review';
      }

      extractedEvents.push({
        tempId: `preview-mat-${Date.now()}-${r}-${block.month}`,
        title: cleanTitle,
        eventType: type,
        startDate,
        endDate,
        allDay: true,
        description: block.categoryCol && row[block.categoryCol] ? `Category: ${row[block.categoryCol]}` : undefined,
        sourceName: filename,
        confidence,
        reviewStatus,
        conflictReason,
      });
    }
  }

  extractedEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    events: extractedEvents,
    warnings,
    totalRawRowsScanned: rows.length,
  };
}

/**
 * Parses spreadsheet or CSV file buffer using SheetJS.
 */
export async function parseSpreadsheetCalendar(
  data: ArrayBuffer | Uint8Array,
  filename: string,
  existingEvents: AcademicEvent[] = []
): Promise<CalendarExtractionResult> {
  const warnings: string[] = [];
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return { events: [], warnings: ['Spreadsheet contains no sheets.'], totalRawRowsScanned: 0 };
  }

  // 1. Pre-scan all sheets to detect base academic year and document initial month
  let baseAcademicStartYear = new Date().getFullYear();
  let documentInitialMonth: number | null = null;

  for (const sName of workbook.SheetNames) {
    const s = workbook.Sheets[sName];
    if (!s) continue;
    const sRows: any[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: false });
    for (let r = 0; r < Math.min(25, sRows.length); r++) {
      const row = sRows[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c || '')).join(' ');
      const rangeMatch = rowStr.match(/\b(20\d{2})\s*[-–/]\s*(?:20)?(\d{2})\b/);
      if (rangeMatch) {
        baseAcademicStartYear = parseInt(rangeMatch[1], 10);
      } else {
        const singleYear = rowStr.match(/\b(20\d{2})\b/);
        if (singleYear && baseAcademicStartYear === new Date().getFullYear()) {
          baseAcademicStartYear = parseInt(singleYear[1], 10);
        }
      }
      if (!documentInitialMonth) {
        const m = extractMonthFromText(rowStr);
        if (m) documentInitialMonth = m.month;
      }
    }
  }

  // 2. Check for Multi-Month Side-by-Side Matrix Layout across all sheets
  const allMatrixEvents: ExtractedEventPreview[] = [];
  const allMatrixWarnings: string[] = [];
  let totalMatrixRowsScanned = 0;

  for (const sName of workbook.SheetNames) {
    const s = workbook.Sheets[sName];
    if (!s) continue;
    const sRows: any[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: false });
    if (sRows.length < 2) continue;

    const res = parseMultiMonthMatrix(sRows, filename, existingEvents, baseAcademicStartYear);
    if (res !== null && res.events.length > 0) {
      allMatrixEvents.push(...res.events);
      allMatrixWarnings.push(...res.warnings);
      totalMatrixRowsScanned += res.totalRawRowsScanned;
    }
  }

  if (allMatrixEvents.length > 0) {
    // Deduplicate in case multiple sheets repeat events
    const uniqueMap = new Map<string, ExtractedEventPreview>();
    for (const ev of allMatrixEvents) {
      const key = `${ev.title.toLowerCase()}_${ev.startDate}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ev);
      }
    }
    const finalEvents = Array.from(uniqueMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
    return {
      events: finalEvents,
      warnings: Array.from(new Set(allMatrixWarnings)),
      totalRawRowsScanned: totalMatrixRowsScanned,
    };
  }

  // 3. Fallback for single-column calendars: find the best sheet with calendar dates
  let bestSheetName: string = workbook.SheetNames[0];
  let maxDatesInSheet = 0;

  for (const sName of workbook.SheetNames) {
    const s = workbook.Sheets[sName];
    if (!s) continue;
    const sRows: any[][] = XLSX.utils.sheet_to_json(s, { header: 1, raw: false });
    if (sRows.length < 3) continue;

    let dateHits = 0;
    for (let r = 0; r < Math.min(30, sRows.length); r++) {
      const row = sRows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (val && parseFlexibleDate(val)) {
          dateHits++;
        }
      }
    }
    if (dateHits > maxDatesInSheet) {
      maxDatesInSheet = dateHits;
      bestSheetName = sName;
    }
  }

  const sheet = workbook.Sheets[bestSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  if (rows.length === 0) {
    return { events: [], warnings: ['Spreadsheet sheet is empty.'], totalRawRowsScanned: 0 };
  }

  const WEEKDAY_NAMES = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thur|thurs|fri|sat|sun)\.?$/i;

  // Pass 1: Multi-column header detection with scoring
  let headerRowIndex = -1;
  let dateCol = -1;
  let titleCol = -1;
  let typeCol = -1;
  let endDateCol = -1;
  let dayCol = -1;
  let bestScore = -1;

  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rowDateCols: number[] = [];
    const rowTitleCols: number[] = [];
    const rowDayCols: number[] = [];
    const rowEndDateCols: number[] = [];
    const rowTypeCols: number[] = [];

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (!cell) continue;

      // 1. Day of week column: "day", "days", "day of week", "weekday"
      if (/^(day|days|day\s+of\s+week|weekday)$/i.test(cell)) {
        rowDayCols.push(c);
        continue;
      }

      // 2. Date column: "date", "dates", "from date", "start date", "event date", "date of event", "schedule date"
      if (
        (cell.includes('date') || cell === 'from' || cell === 'start' || cell === 'period' || cell === 'schedule date') &&
        !cell.includes('update') &&
        !cell.includes('candidate')
      ) {
        rowDateCols.push(c);
      }

      // 3. Title / Particulars column: "particulars", "particular", "event", "events", "activity", "activities", "description", "details", "title", "schedule of events", "name of event"
      if (
        cell.includes('particular') ||
        cell.includes('event') ||
        cell.includes('activity') ||
        cell.includes('description') ||
        cell.includes('details') ||
        cell.includes('programme') ||
        cell.includes('schedule of event') ||
        cell === 'title' ||
        cell === 'item'
      ) {
        rowTitleCols.push(c);
      }

      // 4. End Date column: "to date", "end date", "to" (when not the first column)
      if (cell.includes('end date') || cell.includes('to date') || (cell === 'to' && c > 0)) {
        rowEndDateCols.push(c);
      }

      // 5. Category / Type column: "type", "category", "nature"
      if (cell.includes('type') || cell.includes('category') || cell.includes('nature')) {
        rowTypeCols.push(c);
      }
    }

    let score = 0;
    if (rowDateCols.length > 0 && rowTitleCols.length > 0 && rowDateCols[0] !== rowTitleCols[0]) {
      score += 100;
      if (rowDayCols.length > 0) score += 20;
      if (rowTypeCols.length > 0) score += 10;
      if (rowEndDateCols.length > 0) score += 10;
    } else if (rowTitleCols.length > 0 && rowDayCols.length > 0) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = r;
      dateCol = rowDateCols[0] ?? -1;
      titleCol = rowTitleCols[0] ?? -1;
      dayCol = rowDayCols[0] ?? -1;
      endDateCol = rowEndDateCols[0] ?? -1;
      typeCol = rowTypeCols[0] ?? -1;
    }
  }

  // Pass 2: Data Content-Based Fallback / Verification
  // Scan subsequent data rows to verify column assignments
  const dataStartScan = Math.max(0, headerRowIndex + 1);
  const dataEndScan = Math.min(rows.length, dataStartScan + 30);
  const colDateHits = new Map<number, number>();
  const colWeekdayHits = new Map<number, number>();
  const colTextHits = new Map<number, number>();

  for (let r = dataStartScan; r < dataEndScan; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim();
      if (!val) continue;
      if (parseFlexibleDate(val)) {
        colDateHits.set(c, (colDateHits.get(c) || 0) + 1);
      } else if (WEEKDAY_NAMES.test(val)) {
        colWeekdayHits.set(c, (colWeekdayHits.get(c) || 0) + 1);
      } else if (val.length > 8 && !/^\d+$/.test(val)) {
        colTextHits.set(c, (colTextHits.get(c) || 0) + 1);
      }
    }
  }

  // If the chosen dateCol has mostly weekday hits or no date hits, swap with the column that actually has dates!
  const dateColHits = colDateHits.get(dateCol) || 0;
  const dateColWeekdayHits = colWeekdayHits.get(dateCol) || 0;
  if (dateCol === -1 || (dateColWeekdayHits > dateColHits && dateColHits === 0)) {
    let maxDates = 0;
    let bestCol = -1;
    for (const [col, count] of colDateHits.entries()) {
      if (count > maxDates) {
        maxDates = count;
        bestCol = col;
      }
    }
    if (bestCol !== -1) {
      dateCol = bestCol;
    }
  }

  // If titleCol was not found or collided with dateCol:
  if (titleCol === -1 || titleCol === dateCol) {
    let maxText = 0;
    let bestCol = -1;
    for (const [col, count] of colTextHits.entries()) {
      if (col !== dateCol && count > maxText) {
        maxText = count;
        bestCol = col;
      }
    }
    titleCol = bestCol !== -1 ? bestCol : dateCol === 0 ? 1 : 0;
  }

  // Final fallback defaults
  if (dateCol === -1) dateCol = 0;
  if (titleCol === -1) titleCol = 1;
  if (headerRowIndex === -1) headerRowIndex = 0;

  if (bestScore <= 0 && dateColHits === 0) {
    return {
      events: [],
      warnings: ['No calendar dates could be detected in this spreadsheet.'],
      totalRawRowsScanned: rows.length,
    };
  }

  // Pre-scan all rows to locate month headers, landmarks, and full dates
  interface RowMonthData {
    month: number;
    year: number;
    isSectionHeader: boolean;
  }
  const rowMonths: (RowMonthData | null)[] = new Array(rows.length).fill(null);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const nonEmpties = row.map((c) => String(c || '').trim()).filter((c) => c.length > 0);
    if (nonEmpties.length === 0) continue;

    // Check month in any cell
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      if (!cellVal || cellVal.length > 60) continue;
      const mInfo = extractMonthFromText(cellVal);
      if (mInfo) {
        const lowerCell = cellVal.toLowerCase();
        const isHeader =
          nonEmpties.length <= 3 ||
          lowerCell.includes('month') ||
          /^(month\s*[:\-]?\s*)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(\s*[-–/]?\s*20\d{2})?$/i.test(
            lowerCell
          );

        const year = mInfo.year || (mInfo.month >= 7 ? baseAcademicStartYear : baseAcademicStartYear + 1);
        rowMonths[r] = { month: mInfo.month, year, isSectionHeader: isHeader };
        break;
      }
    }

    // Check landmark holidays
    if (!rowMonths[r]) {
      const rowText = row.map((c) => String(c || '')).join(' ');
      const rawDateCandidate = dateCol !== -1 && row[dateCol] ? String(row[dateCol]) : undefined;
      const landmarkMonth = inferMonthFromLandmark(rowText, rawDateCandidate);
      if (landmarkMonth) {
        const year = landmarkMonth >= 7 ? baseAcademicStartYear : baseAcademicStartYear + 1;
        rowMonths[r] = { month: landmarkMonth, year, isSectionHeader: false };
      }
    }

    // Check if row has an explicit full date
    if (!rowMonths[r] && dateCol !== -1 && row[dateCol]) {
      const parsed = parseFlexibleDate(String(row[dateCol]), baseAcademicStartYear);
      if (parsed) {
        const pIso = parseISO(parsed);
        if (isValid(pIso)) {
          rowMonths[r] = { month: pIso.getMonth() + 1, year: pIso.getFullYear(), isSectionHeader: false };
        }
      }
    }
  }

  // Bidirectional month propagation
  // Backward pass (so earlier dates in a month inherit the month from subsequent landmarks/dates, e.g. rows 14, 16, 23 inherit August from row 26)
  let futureMonthData: RowMonthData | null = null;
  for (let r = rows.length - 1; r >= 0; r--) {
    if (rowMonths[r] && rowMonths[r]!.isSectionHeader) {
      futureMonthData = null;
    } else if (rowMonths[r]) {
      futureMonthData = rowMonths[r];
    } else if (futureMonthData) {
      rowMonths[r] = { ...futureMonthData, isSectionHeader: false };
    }
  }

  // Forward pass
  let activeMonthData: RowMonthData | null = documentInitialMonth
    ? {
        month: documentInitialMonth,
        year: documentInitialMonth >= 7 ? baseAcademicStartYear : baseAcademicStartYear + 1,
        isSectionHeader: false,
      }
    : null;

  for (let r = 0; r < rows.length; r++) {
    if (rowMonths[r] && rowMonths[r]!.isSectionHeader) {
      activeMonthData = rowMonths[r];
    } else if (rowMonths[r]) {
      activeMonthData = rowMonths[r];
    } else if (activeMonthData) {
      rowMonths[r] = { ...activeMonthData, isSectionHeader: false };
    }
  }

  const extractedEvents: ExtractedEventPreview[] = [];
  const startRow = headerRowIndex + 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    const rowContext = rowMonths[r];
    if (rowContext && rowContext.isSectionHeader) {
      // Pure month section header row, skip
      continue;
    }

    if (row.length <= Math.max(dateCol, titleCol)) continue;

    const rawTitle = String(row[titleCol] || '').trim();
    if (!rawTitle || rawTitle.length < 2) continue;

    const lowerTitle = rawTitle.toLowerCase();
    // Skip repeated headers
    if (HEADER_WORDS.has(lowerTitle) || /^(sl\.?\s*no\.?|date|day|particulars|event|activity)$/i.test(lowerTitle)) {
      continue;
    }

    let currentMonth: number | null = rowContext ? rowContext.month : null;
    let currentYear: number = rowContext ? rowContext.year : baseAcademicStartYear;

    let rawDate = dateCol !== -1 ? String(row[dateCol] || '').trim() : '';
    const rawEndDate = endDateCol !== -1 ? String(row[endDateCol] || '').trim() : '';

    // Check landmark holiday anchoring if currentMonth is not yet set
    const landmarkMonth = inferMonthFromLandmark(rawTitle, rawDate);
    if (landmarkMonth) {
      currentMonth = landmarkMonth;
      currentYear = currentMonth >= 7 ? baseAcademicStartYear : baseAcademicStartYear + 1;
    }

    // 1. Try parsing full date directly from rawDate
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (rawDate.includes(' - ') || rawDate.includes(' to ') || rawDate.includes('–')) {
      const parts = rawDate.split(/\s*(?:-|to|–)\s*/);
      startDate = parseFlexibleDate(parts[0], currentYear);
      endDate = parseFlexibleDate(parts[1], currentYear) || startDate;
    } else {
      startDate = parseFlexibleDate(rawDate, currentYear);
      endDate = rawEndDate ? parseFlexibleDate(rawEndDate, currentYear) || startDate : startDate;
    }

    // 2. If rawDate is a day number (e.g. "3", "5", "12", "15", "20", "26") or day range ("7 - 22", "16-31")
    if (!startDate && currentMonth) {
      const singleDayMatch = rawDate.match(/^(\d{1,2})$/);
      if (singleDayMatch) {
        const day = parseInt(singleDayMatch[1], 10);
        if (day >= 1 && day <= 31) {
          const paddedDay = String(day).padStart(2, '0');
          const paddedMonth = String(currentMonth).padStart(2, '0');
          startDate = `${currentYear}-${paddedMonth}-${paddedDay}`;
          endDate = startDate;
        }
      } else {
        const rangeDayMatch = rawDate.match(/^(\d{1,2})\s*[-–to]+\s*(\d{1,2})$/);
        if (rangeDayMatch) {
          const startDay = parseInt(rangeDayMatch[1], 10);
          const endDay = parseInt(rangeDayMatch[2], 10);
          if (startDay >= 1 && startDay <= 31 && endDay >= 1 && endDay <= 31) {
            const paddedStart = String(startDay).padStart(2, '0');
            const paddedEnd = String(endDay).padStart(2, '0');
            const paddedMonth = String(currentMonth).padStart(2, '0');
            startDate = `${currentYear}-${paddedMonth}-${paddedStart}`;
            endDate = `${currentYear}-${paddedMonth}-${paddedEnd}`;
          }
        }
      }
    }

    // 3. Fallback: Check other columns in this row if date couldn't be parsed
    if (!startDate) {
      for (let c = 0; c < row.length; c++) {
        if (c === titleCol) continue;
        const candidate = String(row[c] || '').trim();
        if (!candidate) continue;
        const p = parseFlexibleDate(candidate, currentYear);
        if (p) {
          startDate = p;
          endDate = p;
          rawDate = candidate;
          break;
        }
        if (currentMonth && /^\d{1,2}$/.test(candidate)) {
          const day = parseInt(candidate, 10);
          if (day >= 1 && day <= 31) {
            const paddedDay = String(day).padStart(2, '0');
            const paddedMonth = String(currentMonth).padStart(2, '0');
            startDate = `${currentYear}-${paddedMonth}-${paddedDay}`;
            endDate = startDate;
            rawDate = candidate;
            break;
          }
        }
      }
    }

    // If full date was parsed, update currentMonth and currentYear for subsequent rows
    if (startDate) {
      const parsedIso = parseISO(startDate);
      if (isValid(parsedIso)) {
        currentMonth = parsedIso.getMonth() + 1;
        currentYear = parsedIso.getFullYear();
      }
    }

    if (!startDate) {
      // Only warn if rawTitle is an actual event and not a subheader or row number
      if (!/^\d+$/.test(rawTitle) && rawTitle.length >= 3) {
        warnings.push(`Row ${r + 1}: Could not parse date "${rawDate}" for event "${rawTitle}".`);
      }
      continue;
    }

    if (!endDate) endDate = startDate;

    // Check if the title itself contains a range like "SEE: 7 -22" or "16-31 for 1st Sem"
    if (startDate && startDate === endDate) {
      const titleRangeMatch = rawTitle.match(/\b(\d{1,2})\s*[-–to]+\s*(\d{1,2})\b/);
      if (titleRangeMatch) {
        const startDay = parseInt(titleRangeMatch[1], 10);
        const endDay = parseInt(titleRangeMatch[2], 10);
        const [sYear, sMonth, sDateNum] = startDate.split('-').map(Number);
        if (sDateNum === startDay && endDay > startDay && endDay <= 31) {
          const paddedEnd = String(endDay).padStart(2, '0');
          const paddedMonth = String(sMonth).padStart(2, '0');
          endDate = `${sYear}-${paddedMonth}-${paddedEnd}`;
        }
      }
    }

    const { type, confidence } = classifyAcademicEvent(rawTitle);

    // Duplicate detection
    const isDuplicate = existingEvents.some(
      (e) => e.title.toLowerCase() === rawTitle.toLowerCase() && e.startDate === startDate
    );

    const isConflict = existingEvents.some(
      (e) =>
        e.startDate === startDate &&
        (e.eventType === 'rescheduled_exam' || e.eventType === 'official_holiday') &&
        e.title.toLowerCase() !== rawTitle.toLowerCase()
    );

    let reviewStatus: EventReviewStatus = 'new';
    let conflictReason: string | undefined;

    if (isDuplicate) {
      reviewStatus = 'duplicate';
    } else if (isConflict) {
      reviewStatus = 'conflicting';
      conflictReason = `Conflicts with another existing event on ${startDate}`;
    } else if (confidence < 75) {
      reviewStatus = 'needs_review';
    }

    extractedEvents.push({
      tempId: `preview-${Date.now()}-${r}`,
      title: rawTitle,
      eventType: type,
      startDate,
      endDate,
      allDay: true,
      description: row[typeCol] ? `Category: ${row[typeCol]}` : undefined,
      sourceName: filename,
      confidence,
      reviewStatus,
      conflictReason,
    });
  }

  return {
    events: extractedEvents,
    warnings,
    totalRawRowsScanned: rows.length,
  };
}

/**
 * Extracts academic calendar events from text extracted from a PDF or document.
 */
export function parsePlainTextCalendar(
  text: string,
  filename: string,
  existingEvents: AcademicEvent[] = []
): CalendarExtractionResult {
  const warnings: string[] = [];
  const events: ExtractedEventPreview[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Common date regex patterns:
  // e.g. "15/08/2024 - Independence Day"
  // "August 15, 2024: Independence Day"
  // "15-10-2024 to 20-10-2024: Midterm Exams"
  const dateLineRegex = /^(?:(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|([A-Za-z]+ \d{1,2},? \d{4})|(\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?))(?:\s*(?:to|-|–)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|[A-Za-z]+ \d{1,2},? \d{4}|\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?))?[\:\-\–\s]+(.+)$/i;

  let rowCounter = 0;
  for (const line of lines) {
    const match = line.match(dateLineRegex);
    if (match) {
      const rawStart = match[1] || match[2] || match[3];
      const rawEnd = match[4];
      const title = match[5]?.trim();

      if (rawStart && title) {
        const startDate = parseFlexibleDate(rawStart);
        const endDate = rawEnd ? parseFlexibleDate(rawEnd) || startDate : startDate;

        if (startDate && endDate) {
          const { type, confidence } = classifyAcademicEvent(title);

          const isDuplicate = existingEvents.some(
            (e) => e.title.toLowerCase() === title.toLowerCase() && e.startDate === startDate
          );

          events.push({
            tempId: `preview-txt-${Date.now()}-${rowCounter++}`,
            title,
            eventType: type,
            startDate,
            endDate,
            allDay: true,
            sourceName: filename,
            confidence,
            reviewStatus: isDuplicate ? 'duplicate' : confidence < 75 ? 'needs_review' : 'new',
          });
        }
      }
    }
  }

  if (events.length === 0 && lines.length > 0) {
    warnings.push(
      'No explicit date-event patterns could be extracted automatically from text. Please verify formatting or use CSV/Excel.'
    );
  }

  return {
    events,
    warnings,
    totalRawRowsScanned: lines.length,
  };
}

/**
 * Extracts text stream from PDF file bytes.
 * Decodes textual streams and character strings without external paid cloud APIs.
 */
export async function parsePdfCalendar(
  arrayBuffer: ArrayBuffer,
  filename: string,
  existingEvents: AcademicEvent[] = []
): Promise<CalendarExtractionResult> {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    // Simple robust client-side PDF text stream extractor
    const textDecoder = new TextDecoder('latin1');
    const pdfText = textDecoder.decode(bytes);

    // Look for text streams: between "BT" (Begin Text) and "ET" (End Text) or Tj / TJ operators
    const textBlocks: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;

    while ((match = tjRegex.exec(pdfText)) !== null) {
      if (match[1]) textBlocks.push(match[1]);
    }

    // Also look for TJ array strings: e.g. [(Hello) 10 (World)] TJ
    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(pdfText)) !== null) {
      const inner = match[1];
      const strParts = inner.match(/\(([^)]+)\)/g);
      if (strParts) {
        textBlocks.push(strParts.map((s) => s.slice(1, -1)).join(''));
      }
    }

    if (textBlocks.length > 5) {
      const assembledText = textBlocks.join('\n');
      return parsePlainTextCalendar(assembledText, filename, existingEvents);
    } else {
      // PDF may be scanned image or complex format
      return {
        events: [],
        warnings: [
          'PDF text extraction returned limited text streams. If this is a scanned calendar image, please review manually or import as CSV/Excel.',
        ],
        totalRawRowsScanned: 0,
      };
    }
  } catch (err: any) {
    return {
      events: [],
      warnings: [`Failed to parse PDF document: ${err.message}`],
      totalRawRowsScanned: 0,
    };
  }
}
