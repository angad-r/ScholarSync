import { describe, it, expect } from 'vitest';
import {
  calculateSubjectMarks,
  validateAssessmentComponents,
  projectFinalScore,
} from '../src/lib/marksCalculator';
import { AssessmentComponent } from '../src/types';

describe('Marks Calculator & Academic Scoring Engine', () => {
  it('1. calculates weighted scores correctly with normalized contributions', () => {
    // 80% on 20% weight gives 16 points
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Midterm',
        type: 'internal',
        weight: 20,
        maxMarks: 100,
        marksObtained: 80,
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c2',
        name: 'Final',
        type: 'final',
        weight: 80,
        maxMarks: 100,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: true,
      },
    ];

    const result = calculateSubjectMarks('sub-1', 'Algorithms', 75, components);
    expect(result.currentWeightedScore).toBe(16);
    expect(result.components[0].contribution).toBe(16);
    expect(result.completedWeight).toBe(20);
    expect(result.remainingWeight).toBe(80);
  });

  it('2. calculates correctly with different assessment maximum marks', () => {
    // Midterm: 42/50 = 84% -> weight 25% => 21 contribution
    // Assignment: 18/20 = 90% -> weight 15% => 13.5 contribution
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Midterm',
        type: 'internal',
        weight: 25,
        maxMarks: 50,
        marksObtained: 42,
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c2',
        name: 'Assignment',
        type: 'assignment',
        weight: 15,
        maxMarks: 20,
        marksObtained: 18,
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c3',
        name: 'Final Exam',
        type: 'final',
        weight: 60,
        maxMarks: 100,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: true,
      },
    ];

    const result = calculateSubjectMarks('sub-2', 'OS', 80, components);
    expect(result.components[0].normalizedPercentage).toBe(84);
    expect(result.components[0].contribution).toBe(21);
    expect(result.components[1].normalizedPercentage).toBe(90);
    expect(result.components[1].contribution).toBe(13.5);
    expect(result.currentWeightedScore).toBe(34.5);
  });

  it('3. warns when assessment weights deviate from 100%', () => {
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Test 1',
        type: 'internal',
        weight: 40,
        maxMarks: 50,
        marksObtained: 40,
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
    ];

    const { isValid, issues } = validateAssessmentComponents(components, 100);
    expect(isValid).toBe(true); // Warnings do not invalidate execution
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('deviates from the expected total'))).toBe(true);
  });

  it('4. rejects negative weights and marks exceeding maximum', () => {
    const invalidComps: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Invalid Test',
        type: 'internal',
        weight: -10,
        maxMarks: 50,
        marksObtained: 55, // > max
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
    ];

    const { isValid, issues } = validateAssessmentComponents(invalidComps);
    expect(isValid).toBe(false);
    expect(issues.some((i) => i.message.includes('cannot be negative'))).toBe(true);
    expect(issues.some((i) => i.message.includes('cannot exceed maximum marks'))).toBe(true);
  });

  it('5. identifies target already achieved', () => {
    // Current points: 75, target: 70
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Midterm',
        type: 'internal',
        weight: 50,
        maxMarks: 100,
        marksObtained: 90, // 45 points
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c2',
        name: 'Project',
        type: 'project',
        weight: 30,
        maxMarks: 100,
        marksObtained: 100, // 30 points -> Total 75
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c3',
        name: 'Final Exam',
        type: 'final',
        weight: 20,
        maxMarks: 100,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: true,
      },
    ];

    const result = calculateSubjectMarks('sub-3', 'DBMS', 70, components);
    expect(result.targetAchievableStatus).toBe('already_achieved');
    expect(result.requiredScoreInRemaining).toBe(0);
  });

  it('6. correctly identifies mathematically impossible target and returns maximum achievable score', () => {
    // Current points earned: 20 out of 50 weight. Remaining weight: 50.
    // Max achievable = 20 + 50 = 70%.
    // Target is 85%. 85 > 70 => Impossible!
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Midterm',
        type: 'internal',
        weight: 50,
        maxMarks: 100,
        marksObtained: 40, // 40% of 50 = 20 points
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c2',
        name: 'Final',
        type: 'final',
        weight: 50,
        maxMarks: 100,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: true,
      },
    ];

    const result = calculateSubjectMarks('sub-4', 'CN', 85, components);
    expect(result.targetAchievableStatus).toBe('impossible');
    expect(result.maxAchievableScore).toBe(70);
    expect(result.requiredScoreInRemaining).toBeNull();
  });

  it('7. calculates required marks across multiple remaining assessments', () => {
    // Current points earned: 30 out of 40% completed weight.
    // Remaining weight: 60%. Target: 75%.
    // Points needed = 75 - 30 = 45 points.
    // Required weighted average in remaining = (45 / 60) * 100 = 75%.
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Midterm',
        type: 'internal',
        weight: 40,
        maxMarks: 100,
        marksObtained: 75, // 30 points
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c2',
        name: 'Quiz 2',
        type: 'quiz',
        weight: 10,
        maxMarks: 20,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: false,
      },
      {
        id: 'c3',
        name: 'Final',
        type: 'final',
        weight: 50,
        maxMarks: 100,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: true,
      },
    ];

    const result = calculateSubjectMarks('sub-5', 'Web Dev', 75, components);
    expect(result.targetAchievableStatus).toBe('achievable');
    expect(result.requiredScoreInRemaining).toBe(75);
  });

  it('projects final score under custom hypothesis', () => {
    const components: AssessmentComponent[] = [
      {
        id: 'c1',
        name: 'Test 1',
        type: 'internal',
        weight: 50,
        maxMarks: 100,
        marksObtained: 80, // 40 points
        dueDate: null,
        isCompleted: true,
        isFinalExam: false,
      },
      {
        id: 'c2',
        name: 'Final',
        type: 'final',
        weight: 50,
        maxMarks: 100,
        marksObtained: null,
        dueDate: null,
        isCompleted: false,
        isFinalExam: true,
      },
    ];

    const analysis = calculateSubjectMarks('sub-6', 'Math', 80, components);
    const projection = projectFinalScore(analysis, 'custom', 90);
    // 40 points + 90% of 50 (45 points) = 85%
    expect(projection.projectedScore).toBe(85);
  });
});
