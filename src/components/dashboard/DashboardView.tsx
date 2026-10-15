import React from 'react';
import {
  Subject,
  AttendanceRecord,
  Task,
  TimetableSession,
  StudySessionPlan,
  UserSettings,
  AcademicEvent,
  CalendarSource,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { NavigationTab } from '../layout/Sidebar';
import { calculateSubjectMarks } from '../../lib/marksCalculator';
import { summarizeRecords } from '../../lib/attendanceCalculator';
import { detectTimetableConflicts } from '../../lib/timetableConflict';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ListTodo,
  CalendarClock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';

interface DashboardViewProps {
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
  tasks: Task[];
  timetableSessions: TimetableSession[];
  studyPlans: StudySessionPlan[];
  userSettings: UserSettings;
  academicEvents?: AcademicEvent[];
  calendarSources?: CalendarSource[];
  onNavigate: (tab: NavigationTab) => void;
  onLoadDemoData: () => void;
}

export function DashboardView({
  subjects,
  attendanceRecords,
  tasks,
  timetableSessions,
  studyPlans,
  userSettings,
  academicEvents = [],
  calendarSources = [],
  onNavigate,
  onLoadDemoData,
}: DashboardViewProps) {
  const today = new Date();
  const dayOfWeekNum = ((today.getDay() + 6) % 7) + 1; // 1 = Monday, 7 = Sunday
  const todayStr = format(today, 'yyyy-MM-dd');

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const subjectNames: Record<string, string> = {};
  for (const s of subjects) subjectNames[s.id] = s.name;

  // Conflicts check
  const conflicts = detectTimetableConflicts(timetableSessions, subjectNames);

  // Today's classes
  const todaysClasses = timetableSessions
    .filter((s) => s.dayOfWeek === dayOfWeekNum)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Tasks metrics
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const due = parseISO(t.dueDate);
    return isPast(due) && !isToday(due);
  });

  // Upcoming deadlines (next 7 days)
  const upcomingTasks = pendingTasks
    .filter((t) => {
      const due = parseISO(t.dueDate);
      const diff = differenceInDays(due, today);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Attendance summaries
  const attendanceSummaries = subjects.map((sub) => {
    const subRecs = attendanceRecords.filter((r) => r.subjectId === sub.id);
    return summarizeRecords(sub.id, sub.name, subRecs, sub.attendanceThreshold);
  });

  const lowAttendanceSubjects = attendanceSummaries.filter(
    (s) => s.status === 'critical' || s.status === 'warning'
  );

  // Study progress this week
  const studySessionsCompleted = studyPlans.filter((p) => p.isCompleted).length;
  const studySessionsTotal = studyPlans.length;

  // Empty state check
  if (subjects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-3">
            <Badge variant="primary" size="md" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
              Welcome to ScholarSync
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Organize your semester with mathematical precision.
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              ScholarSync helps you calculate weighted internal marks, prevent low attendance with our bunk calculator, and automatically balance study workloads without paid APIs or cloud dependencies.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => onNavigate('subjects')}
                className="bg-white text-indigo-950 hover:bg-slate-100 font-semibold"
              >
                <BookOpen className="w-4 h-4 mr-1.5" />
                Add Your Subjects
              </Button>
              <Button
                variant="outline"
                onClick={onLoadDemoData}
                className="border-indigo-400 text-indigo-200 hover:bg-indigo-900/50"
              >
                <Sparkles className="w-4 h-4 mr-1.5 text-indigo-400" />
                Load Demo Dataset
              </Button>
            </div>
          </div>
        </div>

        {/* Informational Guidance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="p-5">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                1
              </span>
              Setup Semester & Schemes
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Add your courses and configure university evaluation weights (Midterms, Assignments, Final Exams).
            </p>
          </Card>

          <Card className="p-5">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                2
              </span>
              Log Attendance & Marks
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Track classes to calculate exact safe bunks or consecutive sessions required to reach 75%.
            </p>
          </Card>

          <Card className="p-5">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                3
              </span>
              Generate Study Plans
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Our deterministic algorithm schedules revision without overflowing your daily hours budget.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Calendar Events and Highlights
  const calEvents = academicEvents || [];
  const upcomingExams = calEvents
    .filter((e) => (e.eventType === 'rescheduled_exam' || e.eventType === 'postponed_exam') && e.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const nextExam = upcomingExams[0];

  const upcomingHolidays = calEvents
    .filter((e) => (e.eventType === 'official_holiday' || e.eventType === 'user_holiday' || e.eventType === 'college_closure' || e.eventType === 'vacation_break') && e.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const nextHoliday = upcomingHolidays[0];

  const upcomingCollegeEvents = calEvents
    .filter((e) => e.eventType === 'college_event' && e.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const reviewEvents = calEvents.filter((e) => e.reviewStatus === 'needs_review' || e.reviewStatus === 'conflicting');

  return (
    <div className="space-y-6">
      {/* Diagnostics / Alert Banners */}
      {reviewEvents.length > 0 && (
        <Alert variant="warning" title="Academic Calendar Events Awaiting Review">
          You have {reviewEvents.length} imported calendar event(s) requiring verification or conflict resolution.
          {' '}<button onClick={() => onNavigate('calendar')} className="underline font-bold">Review in Academic Calendar &rarr;</button>
        </Alert>
      )}

      {lowAttendanceSubjects.length > 0 && (
        <Alert variant="warning" title="Low Attendance Warning Detected">
          Attendance in{' '}
          <strong>
            {lowAttendanceSubjects.map((s) => `${s.subjectName} (${s.percentage}%)`).join(', ')}
          </strong>{' '}
          is currently below required threshold. Check Attendance Tracker for recovery plans.
        </Alert>
      )}

      {conflicts.length > 0 && (
        <Alert variant="danger" title="Timetable Overlaps Detected">
          You have {conflicts.length} overlapping session(s) in your weekly timetable. Review the Weekly Timetable module.
        </Alert>
      )}

      {/* Calendar Highlights row (when calendar events exist) */}
      {(nextExam || nextHoliday || upcomingCollegeEvents.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nextExam && (
            <Card hoverable onClick={() => onNavigate('calendar')} className="cursor-pointer border-l-4 border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/10">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-center">
                  <CardDescription className="text-xs font-semibold text-rose-600 dark:text-rose-400">Next University Examination</CardDescription>
                  <Badge variant="danger" size="sm">Exam</Badge>
                </div>
                <CardTitle className="text-base font-bold mt-1 text-slate-900 dark:text-slate-100 line-clamp-1">{nextExam.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
                Scheduled: <strong>{nextExam.startDate}</strong> {nextExam.endDate !== nextExam.startDate ? `to ${nextExam.endDate}` : ''}
              </CardContent>
            </Card>
          )}

          {nextHoliday && (
            <Card hoverable onClick={() => onNavigate('calendar')} className="cursor-pointer border-l-4 border-l-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-center">
                  <CardDescription className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Next Holiday / Break</CardDescription>
                  <Badge variant="success" size="sm">Holiday</Badge>
                </div>
                <CardTitle className="text-base font-bold mt-1 text-slate-900 dark:text-slate-100 line-clamp-1">{nextHoliday.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
                Date: <strong>{nextHoliday.startDate}</strong> {nextHoliday.endDate !== nextHoliday.startDate ? `to ${nextHoliday.endDate}` : ''}
              </CardContent>
            </Card>
          )}

          {upcomingCollegeEvents.length > 0 && (
            <Card hoverable onClick={() => onNavigate('calendar')} className="cursor-pointer border-l-4 border-l-purple-500 bg-purple-50/20 dark:bg-purple-950/10">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-center">
                  <CardDescription className="text-xs font-semibold text-purple-600 dark:text-purple-400">Upcoming College Event</CardDescription>
                  <Badge variant="purple" size="sm">Fest / Event</Badge>
                </div>
                <CardTitle className="text-base font-bold mt-1 text-slate-900 dark:text-slate-100 line-clamp-1">{upcomingCollegeEvents[0].title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
                Date: <strong>{upcomingCollegeEvents[0].startDate}</strong>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subjects */}
        <Card hoverable onClick={() => onNavigate('subjects')} className="cursor-pointer">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-center">
              <CardDescription className="text-xs">Active Subjects</CardDescription>
              <BookOpen className="w-4 h-4 text-indigo-500" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{subjects.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
            {userSettings.semester} • {userSettings.academicYear}
          </CardContent>
        </Card>

        {/* Tasks KPI */}
        <Card hoverable onClick={() => onNavigate('tasks')} className="cursor-pointer">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-center">
              <CardDescription className="text-xs">Pending Tasks</CardDescription>
              <ListTodo className="w-4 h-4 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">{pendingTasks.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px]">
            {overdueTasks.length > 0 ? (
              <span className="text-rose-600 font-semibold">{overdueTasks.length} overdue</span>
            ) : (
              <span className="text-emerald-600 font-semibold">{completedTasks.length} completed</span>
            )}
          </CardContent>
        </Card>

        {/* Attendance Health */}
        <Card hoverable onClick={() => onNavigate('attendance')} className="cursor-pointer">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-center">
              <CardDescription className="text-xs">Attendance Health</CardDescription>
              {lowAttendanceSubjects.length === 0 ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {lowAttendanceSubjects.length === 0 ? 'All Safe' : `${lowAttendanceSubjects.length} At Risk`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
            Min requirement: {userSettings.defaultAttendanceThreshold}%
          </CardContent>
        </Card>

        {/* Study Progress */}
        <Card hoverable onClick={() => onNavigate('studyPlanner')} className="cursor-pointer">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-center">
              <CardDescription className="text-xs">Study Sessions</CardDescription>
              <CalendarClock className="w-4 h-4 text-sky-500" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {studySessionsCompleted} / {studySessionsTotal}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
            {studySessionsTotal > 0
              ? `${Math.round((studySessionsCompleted / studySessionsTotal) * 100)}% adherence`
              : 'No sessions scheduled'}
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Today's Schedule & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Today's Schedule ({format(today, 'EEEE, MMM d')})
              </CardTitle>
              <CardDescription>{todaysClasses.length} lecture/lab slot(s) today</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('timetable')} className="text-xs">
              View Week <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-2.5">
            {todaysClasses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No scheduled lectures or labs for today! Perfect day for study planner sessions.
              </div>
            ) : (
              todaysClasses.map((session) => {
                const sub = subjectMap.get(session.subjectId);
                return (
                  <div
                    key={session.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs"
                    style={{ borderLeftWidth: '3.5px', borderLeftColor: sub?.color || '#4f46e5' }}
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {sub?.name || 'Class Session'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {session.room ? `Room ${session.room} • ` : ''}
                        <span className="capitalize">{session.type}</span>
                      </p>
                    </div>

                    <div className="text-right font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {session.startTime} - {session.endTime}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines & Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Upcoming Deadlines & Tasks
              </CardTitle>
              <CardDescription>Deliverables due in the next 7 days</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('tasks')} className="text-xs">
              All Tasks <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-2.5">
            {upcomingTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-1.5" />
                No pending deadlines due in the next 7 days!
              </div>
            ) : (
              upcomingTasks.map((task) => {
                const sub = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
                const isTaskToday = isToday(parseISO(task.dueDate));

                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {task.title}
                        </span>
                        {sub && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded"
                            style={{ backgroundColor: `${sub.color}20`, color: sub.color }}
                          >
                            {sub.code || sub.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isTaskToday ? (
                          <strong className="text-amber-600 dark:text-amber-400">Due Today</strong>
                        ) : (
                          `Due on ${task.dueDate}`
                        )}{' '}
                        • Est. {task.estimatedMinutes}m
                      </p>
                    </div>

                    <Badge
                      variant={task.priority === 'high' ? 'danger' : 'neutral'}
                      size="sm"
                    >
                      {task.priority.toUpperCase()}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject-Wise Performance & Attendance Matrix */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold">
              Subject Academic Standing & Attendance Health
            </CardTitle>
            <CardDescription>
              Real-time weighted score, required marks in remaining assessments, and bunk headroom.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('marks')} className="text-xs">
            Open Calculator <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 font-semibold text-slate-600 dark:text-slate-400">
                <th className="p-3 pl-5">Subject</th>
                <th className="p-3">Current Score</th>
                <th className="p-3">Target %</th>
                <th className="p-3">Required in Remaining</th>
                <th className="p-3">Attendance %</th>
                <th className="p-3 pr-5">Safe Misses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {subjects.map((sub) => {
                const analysis = calculateSubjectMarks(
                  sub.id,
                  sub.name,
                  sub.targetScore,
                  sub.assessmentComponents || []
                );
                const subRecs = attendanceRecords.filter((r) => r.subjectId === sub.id);
                const attSummary = summarizeRecords(sub.id, sub.name, subRecs, sub.attendanceThreshold);

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 pl-5 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                        <span>{sub.name}</span>
                        {sub.code && <span className="text-[10px] text-slate-400">({sub.code})</span>}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                      {analysis.currentWeightedScore}% / 100%
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {sub.targetScore}%
                    </td>
                    <td className="p-3">
                      {analysis.targetAchievableStatus === 'already_achieved' ? (
                        <Badge variant="success" size="sm">Secured</Badge>
                      ) : analysis.targetAchievableStatus === 'impossible' ? (
                        <Badge variant="danger" size="sm">Cap: {analysis.maxAchievableScore}%</Badge>
                      ) : (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {analysis.requiredScoreInRemaining}%
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {attSummary.percentage !== null ? (
                        <Badge
                          variant={
                            attSummary.status === 'safe'
                              ? 'success'
                              : attSummary.status === 'warning'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {attSummary.percentage}% ({attSummary.attended}/{attSummary.totalConducted})
                        </Badge>
                      ) : (
                        <span className="text-slate-400">No data</span>
                      )}
                    </td>
                    <td className="p-3 pr-5 font-semibold text-sky-600 dark:text-sky-400">
                      {attSummary.maxClassesCanMiss > 0 ? (
                        <span>+{attSummary.maxClassesCanMiss} classes</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
