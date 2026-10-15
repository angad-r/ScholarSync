import { describe, it, expect } from 'vitest';
import {
  calculateAttendanceMetrics,
  validateAttendanceCounts,
  projectFutureAttendance,
} from '../src/lib/attendanceCalculator';

describe('Attendance Calculator & Bunk Allowance Engine', () => {
  it('8. calculates attendance percentage accurately', () => {
    // 18 attended out of 24 conducted = 75.00%
    const res = calculateAttendanceMetrics(18, 24, 75);
    expect(res.percentage).toBe(75);
    expect(res.status).toBe('safe');
    expect(res.missed).toBe(6);
  });

  it('9. handles zero-class conducted gracefully without divide by zero', () => {
    const res = calculateAttendanceMetrics(0, 0, 75);
    expect(res.percentage).toBeNull();
    expect(res.status).toBe('no_data');
    expect(res.classesNeededToTarget).toBe(0);
    expect(res.maxClassesCanMiss).toBe(0);
    expect(res.explanation).toContain('No classes have been conducted yet');
  });

  it('10. calculates required consecutive classes to reach attendance target', () => {
    // Attended: 12, Conducted: 20 -> 60% attendance.
    // Target: 75%.
    // Formula: (75 * 20 - 100 * 12) / (100 - 75) = (1500 - 1200) / 25 = 300 / 25 = 12 classes!
    // Check: (12 + 12) / (20 + 12) = 24 / 32 = 0.75 (75%)!
    const res = calculateAttendanceMetrics(12, 20, 75);
    expect(res.percentage).toBe(60);
    expect(res.classesNeededToTarget).toBe(12);
    expect(res.status).toBe('critical');
  });

  it('11. calculates maximum additional classes a student can safely miss (bunk calculator)', () => {
    // Attended: 24, Conducted: 25 -> 96% attendance.
    // Target: 75%.
    // Formula: floor((100 * 24 - 75 * 25) / 75) = floor((2400 - 1875) / 75) = floor(525 / 75) = 7 classes!
    // Check: 24 / (25 + 7) = 24 / 32 = 75%!
    const res = calculateAttendanceMetrics(24, 25, 75);
    expect(res.percentage).toBe(96);
    expect(res.maxClassesCanMiss).toBe(7);
  });

  it('identifies when threshold is 100% and recovery is impossible', () => {
    // Attended: 9, Conducted: 10 -> missed 1 class. Target: 100%.
    const res = calculateAttendanceMetrics(9, 10, 100);
    expect(res.isRecoveryPossible).toBe(false);
    expect(res.explanation).toContain('100% attendance is impossible');
  });

  it('validates class counts and rejects attended > total', () => {
    expect(() => calculateAttendanceMetrics(15, 10, 75)).toThrowError(
      'Attended classes (15) cannot exceed total classes conducted (10)'
    );
    expect(() => calculateAttendanceMetrics(-1, 10, 75)).toThrowError(
      'Class counts cannot be negative'
    );
  });

  it('projects future attendance based on planned sessions', () => {
    // Currently 15 / 20. Upcoming: 10 classes, will attend 8.
    // Projected: 23 / 30 = 76.67%
    const proj = projectFutureAttendance(15, 20, 10, 8);
    expect(proj.projectedTotal).toBe(30);
    expect(proj.projectedAttended).toBe(23);
    expect(proj.projectedPercentage).toBe(76.67);
  });
});
