import { TimetableSession, TimetableConflict } from '../types';

/**
 * Converts "HH:mm" time string into total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats total minutes into "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Checks whether two time intervals [start1, end1) and [start2, end2) overlap.
 */
export function intervalsOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return Math.max(start1, start2) < Math.min(end1, end2);
}

/**
 * Detects all overlaps and conflicts in a given collection of timetable sessions.
 */
export function detectTimetableConflicts(
  sessions: TimetableSession[],
  subjectNames?: Record<string, string>
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  // First pass: validate each session independently
  for (const session of sessions) {
    const start = timeToMinutes(session.startTime);
    const end = timeToMinutes(session.endTime);

    if (start >= end) {
      const subjectName = session.customTitle || subjectNames?.[session.subjectId] || session.type;
      conflicts.push({
        session1: session,
        session2: session,
        type: 'invalid_time',
        reason: `${subjectName} has invalid time window: start (${session.startTime}) is at or after end (${session.endTime}).`,
      });
    }
  }

  // Second pass: pairwise comparisons on the same day of week
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const s1 = sessions[i];
      const s2 = sessions[j];

      if (s1.dayOfWeek !== s2.dayOfWeek) continue;

      const start1 = timeToMinutes(s1.startTime);
      const end1 = timeToMinutes(s1.endTime);
      const start2 = timeToMinutes(s2.startTime);
      const end2 = timeToMinutes(s2.endTime);

      if (intervalsOverlap(start1, end1, start2, end2)) {
        const name1 = s1.customTitle || subjectNames?.[s1.subjectId] || s1.type;
        const name2 = s2.customTitle || subjectNames?.[s2.subjectId] || s2.type;

        const isLectureStudyClash =
          (s1.type === 'study' && (s2.type === 'lecture' || s2.type === 'lab')) ||
          (s2.type === 'study' && (s1.type === 'lecture' || s1.type === 'lab'));

        conflicts.push({
          session1: s1,
          session2: s2,
          type: isLectureStudyClash ? 'lecture_study_clash' : 'overlap',
          reason: `Schedule conflict: "${name1}" (${s1.startTime} - ${s1.endTime}) overlaps with "${name2}" (${s2.startTime} - ${s2.endTime}).`,
        });
      }
    }
  }

  return conflicts;
}
