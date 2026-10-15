import { AssessmentComponent, ComponentCalculation, SubjectMarksAnalysis } from '../types';

/**
 * Rounds a number to a specified number of decimal places safely against floating point inaccuracy.
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface ValidationIssue {
  componentId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validates assessment components according to strict academic rules.
 */
export function validateAssessmentComponents(
  components: AssessmentComponent[],
  expectedTotalWeight: number = 100
): { isValid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!components || components.length === 0) {
    issues.push({
      message: 'No assessment components defined. Add at least one assessment to track performance.',
      severity: 'warning',
    });
    return { isValid: false, issues };
  }

  const nameSet = new Set<string>();
  let totalWeight = 0;

  for (const comp of components) {
    // Check component name
    if (!comp.name || comp.name.trim() === '') {
      issues.push({
        componentId: comp.id,
        field: 'name',
        message: 'Assessment name cannot be empty.',
        severity: 'error',
      });
    } else {
      const lower = comp.name.trim().toLowerCase();
      if (nameSet.has(lower)) {
        issues.push({
          componentId: comp.id,
          field: 'name',
          message: `Duplicate component name "${comp.name}". Components should have distinct names.`,
          severity: 'warning',
        });
      }
      nameSet.add(lower);
    }

    // Weight validation
    if (comp.weight < 0) {
      issues.push({
        componentId: comp.id,
        field: 'weight',
        message: `Weight for "${comp.name || 'Component'}" cannot be negative (${comp.weight}%).`,
        severity: 'error',
      });
    }
    totalWeight += comp.weight;

    // Max marks validation
    if (comp.maxMarks <= 0) {
      issues.push({
        componentId: comp.id,
        field: 'maxMarks',
        message: `Maximum marks for "${comp.name || 'Component'}" must be greater than zero.`,
        severity: 'error',
      });
    }

    // Marks obtained validation
    if (comp.marksObtained !== null && comp.marksObtained !== undefined) {
      if (comp.marksObtained < 0) {
        issues.push({
          componentId: comp.id,
          field: 'marksObtained',
          message: `Obtained marks for "${comp.name}" cannot be negative (${comp.marksObtained}).`,
          severity: 'error',
        });
      } else if (comp.marksObtained > comp.maxMarks) {
        issues.push({
          componentId: comp.id,
          field: 'marksObtained',
          message: `Obtained marks (${comp.marksObtained}) cannot exceed maximum marks (${comp.maxMarks}) for "${comp.name}".`,
          severity: 'error',
        });
      }
    }
  }

  // Check sum of weights
  const roundedTotalWeight = roundToDecimals(totalWeight, 2);
  if (roundedTotalWeight !== expectedTotalWeight) {
    issues.push({
      message: `Assessment weights sum to ${roundedTotalWeight}%, which deviates from the expected total of ${expectedTotalWeight}%. Calculations reflect configured weights directly.`,
      severity: 'warning',
    });
  }

  const hasFatalErrors = issues.some((i) => i.severity === 'error');
  return { isValid: !hasFatalErrors, issues };
}

/**
 * Calculates detailed component breakdown and overall weighted score.
 */
export function calculateSubjectMarks(
  subjectId: string,
  subjectName: string,
  targetScore: number,
  components: AssessmentComponent[],
  options?: {
    includeFinalExam?: boolean; // defaults to true
    expectedTotalWeight?: number; // defaults to 100
  }
): SubjectMarksAnalysis {
  const includeFinalExam = options?.includeFinalExam ?? true;
  const expectedTotalWeight = options?.expectedTotalWeight ?? 100;

  const warnings: string[] = [];
  const assumptions: string[] = [];

  const { issues } = validateAssessmentComponents(components, expectedTotalWeight);
  for (const issue of issues) {
    warnings.push(issue.message);
  }

  const activeComponents = components.filter((c) => {
    if (!includeFinalExam && c.isFinalExam) return false;
    return true;
  });

  if (!includeFinalExam && components.some((c) => c.isFinalExam)) {
    assumptions.push('Final examination is excluded from the current analysis per user selection.');
  }

  const calculatedComponents: ComponentCalculation[] = [];
  let totalConfiguredWeight = 0;
  let completedWeight = 0;
  let remainingWeight = 0;
  let weightedPointsEarned = 0;

  for (const comp of activeComponents) {
    totalConfiguredWeight += comp.weight;

    let normalizedPercentage: number | null = null;
    let contribution: number | null = null;

    if (comp.isCompleted && comp.marksObtained !== null && comp.marksObtained !== undefined && comp.maxMarks > 0) {
      normalizedPercentage = roundToDecimals((comp.marksObtained / comp.maxMarks) * 100, 2);
      contribution = roundToDecimals((normalizedPercentage * comp.weight) / 100, 2);
      completedWeight += comp.weight;
      weightedPointsEarned += contribution;
    } else {
      remainingWeight += comp.weight;
    }

    calculatedComponents.push({
      componentId: comp.id,
      name: comp.name,
      type: comp.type,
      rawMarks: comp.marksObtained,
      maxMarks: comp.maxMarks,
      normalizedPercentage,
      weight: comp.weight,
      contribution,
      isCompleted: comp.isCompleted && comp.marksObtained !== null && comp.marksObtained !== undefined,
      isFinalExam: comp.isFinalExam,
    });
  }

  totalConfiguredWeight = roundToDecimals(totalConfiguredWeight, 2);
  completedWeight = roundToDecimals(completedWeight, 2);
  remainingWeight = roundToDecimals(remainingWeight, 2);
  const currentWeightedScore = roundToDecimals(weightedPointsEarned, 2);

  // Current average percentage among completed assessments
  const currentAveragePercentage =
    completedWeight > 0 ? roundToDecimals((currentWeightedScore / completedWeight) * 100, 2) : null;

  // Max achievable score: current points earned + 100% on all remaining weights
  // Note: 100% on remainingWeight contributes remainingWeight points
  const maxAchievableScore = roundToDecimals(currentWeightedScore + remainingWeight, 2);

  // Required score calculation
  let targetAchievableStatus: SubjectMarksAnalysis['targetAchievableStatus'] = 'achievable';
  let requiredScoreInRemaining: number | null = null;

  if (activeComponents.length === 0) {
    targetAchievableStatus = 'invalid_configuration';
    warnings.push('No valid assessment components are active for calculation.');
  } else if (remainingWeight === 0) {
    targetAchievableStatus = 'no_remaining';
    assumptions.push('All assessment components are completed; no future assessments remain.');
  } else if (currentWeightedScore >= targetScore) {
    targetAchievableStatus = 'already_achieved';
    requiredScoreInRemaining = 0;
    assumptions.push(
      `Target score of ${targetScore}% has already been achieved with ${currentWeightedScore} marks earned so far.`
    );
  } else if (maxAchievableScore < targetScore) {
    targetAchievableStatus = 'impossible';
    requiredScoreInRemaining = null;
    warnings.push(
      `Target score of ${targetScore}% is mathematically impossible. Maximum achievable score is ${maxAchievableScore}%, even with 100% in all remaining assessments.`
    );
  } else {
    // Formula: (Target - CurrentEarned) / RemainingWeight * 100
    const pointsNeeded = targetScore - currentWeightedScore;
    const reqPercentage = roundToDecimals((pointsNeeded / remainingWeight) * 100, 2);

    if (reqPercentage >= 99.99) {
      targetAchievableStatus = 'requires_100_percent';
      requiredScoreInRemaining = 100;
      assumptions.push(
        `Reaching target ${targetScore}% requires a perfect 100% weighted average across remaining assessments.`
      );
    } else {
      targetAchievableStatus = 'achievable';
      requiredScoreInRemaining = reqPercentage;
      assumptions.push(
        `Requires an average of ${reqPercentage}% across the remaining ${remainingWeight}% weighted assessments.`
      );
    }
  }

  const formulaDescription =
    'Weighted Score = Sum of (Normalized Component % × Component Weight) / 100. ' +
    'Required in Remaining = ((Target Score − Points Earned So Far) / Remaining Weight) × 100.';

  return {
    subjectId,
    subjectName,
    targetScore,
    totalConfiguredWeight,
    completedWeight,
    remainingWeight,
    currentWeightedScore,
    currentAveragePercentage,
    maxAchievableScore,
    targetAchievableStatus,
    requiredScoreInRemaining,
    components: calculatedComponents,
    warnings,
    assumptions,
    formulaDescription,
  };
}

/**
 * Predicts final score based on a chosen future performance assumption.
 * - 'maintain_average': assumes student gets their current completed average on remaining
 * - 'target': assumes student meets target required average
 * - 'custom': custom percentage in remaining
 */
export function projectFinalScore(
  analysis: SubjectMarksAnalysis,
  hypothesis: 'maintain_average' | 'target' | 'custom',
  customPercentage: number = 75
): {
  projectedScore: number;
  assumedRemainingPercentage: number;
  explanation: string;
} {
  const { currentWeightedScore, remainingWeight, currentAveragePercentage, targetScore } = analysis;

  if (remainingWeight === 0) {
    return {
      projectedScore: currentWeightedScore,
      assumedRemainingPercentage: 0,
      explanation: 'All assessments are completed; projected score equals final score earned.',
    };
  }

  let assumedRemaining = 0;
  if (hypothesis === 'maintain_average') {
    assumedRemaining = currentAveragePercentage ?? 70;
  } else if (hypothesis === 'target') {
    assumedRemaining = analysis.requiredScoreInRemaining ?? targetScore;
  } else {
    assumedRemaining = Math.max(0, Math.min(100, customPercentage));
  }

  const projectedRemainingPoints = roundToDecimals((assumedRemaining * remainingWeight) / 100, 2);
  const projectedScore = roundToDecimals(currentWeightedScore + projectedRemainingPoints, 2);

  const explanation = `If you score ${assumedRemaining}% on average across remaining assessments (${remainingWeight}% weight), your final score will be ${projectedScore}%.`;

  return {
    projectedScore,
    assumedRemainingPercentage: assumedRemaining,
    explanation,
  };
}
