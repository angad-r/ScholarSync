import { AttendanceRecord, AttendanceSummary } from '../types';
import { roundToDecimals } from './marksCalculator';

export interface AttendanceCalculationResult {
  totalConducted: number;
  attended: number;
  missed: number;
  percentage: number | null; // null if zero conducted
  status: 'safe' | 'warning' | 'critical' | 'no_data';
  classesNeededToTarget: number;
  maxClassesCanMiss: number;
  isRecoveryPossible: boolean;
  explanation: string;
  advice: string;
}

/**
 * Validates raw class counts.
 */
export function validateAttendanceCounts(
  attended: number,
  totalConducted: number
): { isValid: boolean; error?: string } {
  if (attended < 0 || totalConducted < 0) {
    return { isValid: false, error: 'Class counts cannot be negative.' };
  }
  if (attended > totalConducted) {
    return {
      isValid: false,
      error: `Attended classes (${attended}) cannot exceed total classes conducted (${totalConducted}).`,
    };
  }
  return { isValid: true };
}

/**
 * Calculates attendance metrics, consecutive classes needed to recover, and safe skips.
 */
export function calculateAttendanceMetrics(
  attended: number,
  totalConducted: number,
  threshold: number = 75
): AttendanceCalculationResult {
  const validation = validateAttendanceCounts(attended, totalConducted);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const missed = totalConducted - attended;

  if (totalConducted === 0) {
    return {
      totalConducted: 0,
      attended: 0,
      missed: 0,
      percentage: null,
      status: 'no_data',
      classesNeededToTarget: 0,
      maxClassesCanMiss: 0,
      isRecoveryPossible: true,
      explanation: 'No classes have been conducted yet for this subject.',
      advice: `Maintain attendance above ${threshold}% once classes begin.`,
    };
  }

  const percentage = roundToDecimals((attended / totalConducted) * 100, 2);

  let status: AttendanceCalculationResult['status'] = 'safe';
  if (percentage < threshold) {
    status = percentage < threshold - 10 ? 'critical' : 'warning';
  }

  // Calculate consecutive classes needed to reach threshold
  // Target: (attended + x) / (totalConducted + x) >= threshold / 100
  let classesNeededToTarget = 0;
  let isRecoveryPossible = true;

  if (threshold >= 100) {
    if (missed > 0) {
      isRecoveryPossible = false;
      classesNeededToTarget = 0;
    } else {
      classesNeededToTarget = 0;
    }
  } else if (percentage < threshold) {
    const numerator = threshold * totalConducted - 100 * attended;
    const denominator = 100 - threshold;
    if (denominator > 0) {
      classesNeededToTarget = Math.max(0, Math.ceil(numerator / denominator));
    }
  }

  // Calculate max classes student can safely miss without dropping below threshold
  // Target: attended / (totalConducted + y) >= threshold / 100
  let maxClassesCanMiss = 0;
  if (threshold > 0 && percentage >= threshold) {
    const numerator = 100 * attended - threshold * totalConducted;
    maxClassesCanMiss = Math.max(0, Math.floor(numerator / threshold));
  }

  let explanation = '';
  let advice = '';

  if (percentage < threshold) {
    if (!isRecoveryPossible) {
      explanation = `Current attendance is ${percentage}%. 100% attendance is impossible because ${missed} class(es) have already been missed.`;
      advice = 'Target maximum possible attendance from now on.';
    } else {
      explanation = `Current attendance is ${percentage}%, which is below your target of ${threshold}%.`;
      advice = `Attend the next ${classesNeededToTarget} consecutive class(es) without absence to reach ${threshold}%.`;
    }
  } else {
    explanation = `Current attendance is ${percentage}%, safely meeting your requirement of ${threshold}%.`;
    advice =
      maxClassesCanMiss > 0
        ? `You can miss up to ${maxClassesCanMiss} more class(es) and remain above ${threshold}%.`
        : `You are exactly at or near the ${threshold}% margin. Do not miss any upcoming classes.`;
  }

  return {
    totalConducted,
    attended,
    missed,
    percentage,
    status,
    classesNeededToTarget,
    maxClassesCanMiss,
    isRecoveryPossible,
    explanation,
    advice,
  };
}

/**
 * Summarizes attendance from an array of attendance records.
 */
export function summarizeRecords(
  subjectId: string,
  subjectName: string,
  records: AttendanceRecord[],
  threshold: number = 75
): AttendanceSummary {
  const subjectRecords = records.filter((r) => r.subjectId === subjectId && r.status !== 'cancelled');
  const totalConducted = subjectRecords.length;
  const attended = subjectRecords.filter((r) => r.status === 'present').length;

  const metrics = calculateAttendanceMetrics(attended, totalConducted, threshold);

  return {
    subjectId,
    subjectName,
    totalConducted: metrics.totalConducted,
    attended: metrics.attended,
    missed: metrics.missed,
    percentage: metrics.percentage,
    threshold,
    status: metrics.status,
    classesNeededToTarget: metrics.classesNeededToTarget,
    maxClassesCanMiss: metrics.maxClassesCanMiss,
    isRecoveryPossible: metrics.isRecoveryPossible,
  };
}

/**
 * Simulates future attendance scenario.
 */
export function projectFutureAttendance(
  currentAttended: number,
  currentTotal: number,
  futureTotalClasses: number,
  futureClassesToAttend: number
): { projectedTotal: number; projectedAttended: number; projectedPercentage: number } {
  const projectedTotal = currentTotal + futureTotalClasses;
  const projectedAttended = currentAttended + Math.min(futureTotalClasses, Math.max(0, futureClassesToAttend));
  const projectedPercentage =
    projectedTotal > 0 ? roundToDecimals((projectedAttended / projectedTotal) * 100, 2) : 0;

  return {
    projectedTotal,
    projectedAttended,
    projectedPercentage,
  };
}
