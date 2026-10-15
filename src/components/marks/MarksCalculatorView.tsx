import React, { useState } from 'react';
import { Subject, AssessmentComponent } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import {
  calculateSubjectMarks,
  projectFinalScore,
  roundToDecimals,
} from '../../lib/marksCalculator';
import {
  Calculator,
  Target,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Percent,
} from 'lucide-react';

interface MarksCalculatorViewProps {
  subjects: Subject[];
  selectedSubjectId?: string;
  onUpdateSubjectComponents: (
    subjectId: string,
    components: AssessmentComponent[],
    targetScore: number
  ) => Promise<void>;
  onNavigateToSubjects: () => void;
}

export function MarksCalculatorView({
  subjects,
  selectedSubjectId,
  onUpdateSubjectComponents,
  onNavigateToSubjects,
}: MarksCalculatorViewProps) {
  const [activeSubjectId, setActiveSubjectId] = useState<string>(
    selectedSubjectId || (subjects.length > 0 ? subjects[0].id : '')
  );
  const [includeFinalExam, setIncludeFinalExam] = useState<boolean>(true);
  const [targetScoreInput, setTargetScoreInput] = useState<number>(85);
  const [simulationHypothesis, setSimulationHypothesis] = useState<
    'maintain_average' | 'target' | 'custom'
  >('maintain_average');
  const [customRemainingInput, setCustomRemainingInput] = useState<number>(80);
  const [isSaving, setIsSaving] = useState(false);

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || subjects[0];

  // Sync target score when active subject changes
  React.useEffect(() => {
    if (activeSubject) {
      setTargetScoreInput(activeSubject.targetScore || 85);
    }
  }, [activeSubjectId, activeSubject]);

  if (!activeSubject) {
    return (
      <Card className="p-12 text-center border-dashed border-2">
        <Calculator className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">No Subjects Available</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          Create a subject first to configure assessments and calculate weighted academic performance.
        </p>
        <Button variant="primary" className="mt-4" onClick={onNavigateToSubjects}>
          Create Subject
        </Button>
      </Card>
    );
  }

  const analysis = calculateSubjectMarks(
    activeSubject.id,
    activeSubject.name,
    targetScoreInput,
    activeSubject.assessmentComponents || [],
    { includeFinalExam }
  );

  const projection = projectFinalScore(analysis, simulationHypothesis, customRemainingInput);

  const handleScoreChange = async (componentId: string, rawScoreText: string) => {
    const rawVal = rawScoreText === '' ? null : Number(rawScoreText);
    const updatedComponents = (activeSubject.assessmentComponents || []).map((c) => {
      if (c.id === componentId) {
        return {
          ...c,
          marksObtained: rawVal,
          isCompleted: rawVal !== null && !isNaN(rawVal),
        };
      }
      return c;
    });

    setIsSaving(true);
    try {
      await onUpdateSubjectComponents(activeSubject.id, updatedComponents, targetScoreInput);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTargetScoreBlur = async () => {
    if (targetScoreInput !== activeSubject.targetScore) {
      setIsSaving(true);
      try {
        await onUpdateSubjectComponents(
          activeSubject.id,
          activeSubject.assessmentComponents || [],
          targetScoreInput
        );
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Subject Picker Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {subjects.map((sub) => (
          <button
            key={sub.id}
            onClick={() => setActiveSubjectId(sub.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border flex items-center gap-2 ${
              activeSubject.id === sub.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: sub.color }}
            />
            {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
          </button>
        ))}
      </div>

      {/* Warnings & Diagnostics Banner */}
      {analysis.warnings.length > 0 && (
        <Alert variant="warning" title="Academic Configuration Diagnostics">
          <ul className="list-disc list-inside space-y-1">
            {analysis.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Score Earned So Far */}
        <Card className="border-l-4 border-l-indigo-600 dark:border-l-indigo-500">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardDescription>Current Score Earned</CardDescription>
              <Badge variant="primary" size="sm">
                Completed: {analysis.completedWeight}% wt
              </Badge>
            </div>
            <CardTitle className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5 mt-1">
              <span>{analysis.currentWeightedScore}</span>
              <span className="text-base font-normal text-slate-500">/ 100%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            {analysis.completedWeight > 0 ? (
              <p>
                Average of{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {analysis.currentAveragePercentage}%
                </span>{' '}
                on finished assessments.
              </p>
            ) : (
              <p>No assessment marks recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Max Achievable Score */}
        <Card className="border-l-4 border-l-sky-600 dark:border-l-sky-500">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardDescription>Max Achievable Score</CardDescription>
              <Badge variant="secondary" size="sm">
                Remaining: {analysis.remainingWeight}% wt
              </Badge>
            </div>
            <CardTitle className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 flex items-baseline gap-1.5 mt-1">
              <span>{analysis.maxAchievableScore}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            Assuming perfect 100% marks in all remaining tests/exams.
          </CardContent>
        </Card>

        {/* Card 3: Required in Remaining */}
        <Card
          className={`border-l-4 ${
            analysis.targetAchievableStatus === 'already_achieved'
              ? 'border-l-emerald-600'
              : analysis.targetAchievableStatus === 'impossible'
              ? 'border-l-rose-600'
              : 'border-l-amber-500'
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardDescription>Target: {analysis.targetScore}%</CardDescription>
              <Badge
                variant={
                  analysis.targetAchievableStatus === 'already_achieved'
                    ? 'success'
                    : analysis.targetAchievableStatus === 'impossible'
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
              >
                {analysis.targetAchievableStatus === 'already_achieved'
                  ? 'Target Met'
                  : analysis.targetAchievableStatus === 'impossible'
                  ? 'Impossible'
                  : 'Achievable'}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {analysis.targetAchievableStatus === 'already_achieved' ? (
                <span className="text-emerald-600">Already Secured</span>
              ) : analysis.targetAchievableStatus === 'impossible' ? (
                <span className="text-rose-600">Cap: {analysis.maxAchievableScore}%</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  {analysis.requiredScoreInRemaining}% required
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            {analysis.targetAchievableStatus === 'already_achieved' ? (
              <p>You have already earned enough weighted points to secure your target!</p>
            ) : analysis.targetAchievableStatus === 'impossible' ? (
              <p>Target exceeds maximum achievable score ({analysis.maxAchievableScore}%).</p>
            ) : (
              <p>Needed weighted average across remaining {analysis.remainingWeight}% weights.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Configurable Assessments Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <span>Assessment Breakdown & Marks Entry</span>
              {isSaving && <span className="text-xs font-normal text-indigo-500">(Saving...)</span>}
            </CardTitle>
            <CardDescription>
              Enter raw marks obtained. Weighted contributions update automatically with strict mathematical precision.
            </CardDescription>
          </div>

          {/* Controls: Target Score & Final Exam Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <Target className="w-4 h-4 text-indigo-500 shrink-0" />
              <label htmlFor="target-score-input" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Target %:
              </label>
              <input
                id="target-score-input"
                type="number"
                min="0"
                max="100"
                value={targetScoreInput}
                onChange={(e) => setTargetScoreInput(Number(e.target.value))}
                onBlur={handleTargetScoreBlur}
                className="w-14 text-xs font-bold text-center py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeFinalExam}
                onChange={(e) => setIncludeFinalExam(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              Include Final Exam
            </label>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 font-semibold text-slate-600 dark:text-slate-400">
                <th className="p-3.5 pl-5">Assessment Component</th>
                <th className="p-3.5">Weight (%)</th>
                <th className="p-3.5">Max Marks</th>
                <th className="p-3.5">Marks Obtained</th>
                <th className="p-3.5">Normalized (%)</th>
                <th className="p-3.5">Final Contribution (%)</th>
                <th className="p-3.5 pr-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {analysis.components.map((comp) => {
                return (
                  <tr
                    key={comp.componentId}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3.5 pl-5 font-semibold text-slate-900 dark:text-slate-100">
                      <div>
                        {comp.name}
                        {comp.isFinalExam && (
                          <Badge variant="purple" size="sm" className="ml-2 text-[10px]">
                            Final Exam
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                      {comp.weight}%
                    </td>
                    <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                      {comp.maxMarks}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 max-w-[110px]">
                        <input
                          type="number"
                          min="0"
                          max={comp.maxMarks}
                          step="0.5"
                          placeholder="—"
                          value={comp.rawMarks ?? ''}
                          onChange={(e) => handleScoreChange(comp.componentId, e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-slate-400">/ {comp.maxMarks}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {comp.normalizedPercentage !== null ? `${comp.normalizedPercentage}%` : '—'}
                    </td>
                    <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                      {comp.contribution !== null ? `+${comp.contribution}%` : '0%'}
                    </td>
                    <td className="p-3.5 pr-5">
                      {comp.isCompleted ? (
                        <Badge variant="success" size="sm">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 font-bold text-slate-900 dark:text-slate-100">
                <td className="p-3.5 pl-5">Total Configured Weights</td>
                <td className="p-3.5 text-indigo-600 dark:text-indigo-400">
                  {analysis.totalConfiguredWeight}%
                </td>
                <td colSpan={3} className="p-3.5 text-right text-slate-500">
                  Current Weighted Score:
                </td>
                <td className="p-3.5 text-indigo-600 dark:text-indigo-400 text-sm">
                  {analysis.currentWeightedScore}%
                </td>
                <td className="p-3.5 pr-5"></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Two Column Grid: Calculation Transparency & Performance Prediction Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Transparency Breakdown Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-500" />
              Calculation Transparency & Mathematical Proof
            </CardTitle>
            <CardDescription>
              Complete mathematical audit of how every number was calculated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-indigo-600 dark:text-indigo-400">Formula:</p>
              <p>{analysis.formulaDescription}</p>
            </div>

            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <p>
                <strong className="text-slate-900 dark:text-white">Active Components:</strong>{' '}
                {analysis.components.length} components evaluated (Completed weight:{' '}
                {analysis.completedWeight}%, Remaining weight: {analysis.remainingWeight}%).
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">Assumptions Made:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                {analysis.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Projection & Hypothesis Simulator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Hypothetical Grade Projection Simulator
            </CardTitle>
            <CardDescription>
              Simulate your expected final grade under different performance assumptions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Future Performance Assumption:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSimulationHypothesis('maintain_average')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    simulationHypothesis === 'maintain_average'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Current Average ({analysis.currentAveragePercentage ?? 70}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulationHypothesis('target')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    simulationHypothesis === 'target'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Hit Target ({targetScoreInput}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulationHypothesis('custom')}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    simulationHypothesis === 'custom'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Custom Simulation
                </button>
              </div>
            </div>

            {simulationHypothesis === 'custom' && (
              <div className="flex items-center gap-3">
                <label className="text-slate-600 dark:text-slate-400">
                  Assumed score in remaining assessments (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={customRemainingInput}
                  onChange={(e) => setCustomRemainingInput(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-center font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            )}

            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-indigo-950 dark:text-indigo-200">
                  Projected Final Score:
                </span>
                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {projection.projectedScore}%
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {projection.explanation}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
