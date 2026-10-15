import React from 'react';
import { Subject, AttendanceRecord, Task, StudySessionPlan } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { calculateSubjectMarks } from '../../lib/marksCalculator';
import { summarizeRecords } from '../../lib/attendanceCalculator';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import { BarChart3, AlertCircle } from 'lucide-react';

interface AnalyticsViewProps {
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
  tasks: Task[];
  studyPlans: StudySessionPlan[];
}

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function AnalyticsView({
  subjects,
  attendanceRecords,
  tasks,
  studyPlans,
}: AnalyticsViewProps) {
  if (subjects.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed border-2">
        <BarChart3 className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
          Insufficient Data for Analytics
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          Add subjects and assessment records to generate performance graphs and attendance distributions.
        </p>
      </Card>
    );
  }

  // 1. Subject Score vs Target Score Data
  const scoreData = subjects.map((sub) => {
    const analysis = calculateSubjectMarks(
      sub.id,
      sub.name,
      sub.targetScore,
      sub.assessmentComponents || []
    );
    return {
      name: sub.code || sub.name.substring(0, 10),
      fullName: sub.name,
      currentScore: analysis.currentWeightedScore,
      maxAchievable: analysis.maxAchievableScore,
      targetScore: sub.targetScore,
    };
  });

  // 2. Attendance % by Subject Data
  const attendanceData = subjects.map((sub) => {
    const subRecs = attendanceRecords.filter((r) => r.subjectId === sub.id);
    const summary = summarizeRecords(sub.id, sub.name, subRecs, sub.attendanceThreshold);
    return {
      name: sub.code || sub.name.substring(0, 10),
      fullName: sub.name,
      percentage: summary.percentage ?? 0,
      hasData: summary.percentage !== null,
      threshold: sub.attendanceThreshold,
      attended: summary.attended,
      conducted: summary.totalConducted,
    };
  });

  // 3. Task Status Breakdown Data
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const cancelledTasks = tasks.filter((t) => t.status === 'cancelled').length;

  const taskStatusData = [
    { name: 'Completed', value: completedTasks, color: '#10b981' },
    { name: 'In Progress', value: inProgressTasks, color: '#f59e0b' },
    { name: 'Pending', value: pendingTasks, color: '#6366f1' },
    ...(cancelledTasks > 0 ? [{ name: 'Cancelled', value: cancelledTasks, color: '#94a3b8' }] : []),
  ].filter((item) => item.value > 0);

  // 4. Workload Distribution across Subjects
  const workloadBySubject = subjects.map((sub) => {
    const subTasks = tasks.filter((t) => t.subjectId === sub.id);
    const totalMinutes = subTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    return {
      name: sub.code || sub.name.substring(0, 12),
      hours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }).filter((w) => w.hours > 0);

  return (
    <div className="space-y-6">
      {/* Grid: Marks and Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Current vs Target Marks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              Current Weighted Score vs Target (%)
            </CardTitle>
            <CardDescription>
              Shows actual marks earned so far compared to your semester targets and max achievable scores.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    `${val}%`,
                    name === 'currentScore'
                      ? 'Current Score'
                      : name === 'targetScore'
                      ? 'Target Score'
                      : 'Max Achievable',
                  ]}
                  contentStyle={{
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="currentScore" name="Current Score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="targetScore" name="Target Score" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxAchievable" name="Max Achievable" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: Attendance by Subject */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              Subject Attendance Percentage (%)
            </CardTitle>
            <CardDescription>
              Attendance rates with institutional threshold guidelines (75%).
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Attendance']}
                  contentStyle={{
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                  }}
                />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '75% Min', fill: '#ef4444', fontSize: 10 }} />
                <Bar dataKey="percentage" name="Attendance %" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {attendanceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        !entry.hasData
                          ? '#94a3b8'
                          : entry.percentage < entry.threshold
                          ? '#ef4444'
                          : '#10b981'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Task Status Breakdown & Workload Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              Task Completion Status
            </CardTitle>
            <CardDescription>Breakdown of pending, active, and finished assignments.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400">No task records found.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      backgroundColor: '#1e293b',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Subject Workload Distribution (Hours) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              Estimated Workload by Subject (Hours)
            </CardTitle>
            <CardDescription>Total assignment and study time allocated across courses.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {workloadBySubject.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No active tasks with estimated hours.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadBySubject} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip
                    formatter={(val: any) => [`${val} hrs`, 'Workload']}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      backgroundColor: '#1e293b',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
