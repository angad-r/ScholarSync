import React, { useState } from 'react';
import { Subject, AttendanceRecord, SessionType } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import {
  summarizeRecords,
  projectFutureAttendance,
  calculateAttendanceMetrics,
} from '../../lib/attendanceCalculator';
import { format } from 'date-fns';
import {
  CheckSquare,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Trash2,
  TrendingUp,
  History,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface AttendanceViewProps {
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
  onAddRecord: (record: Omit<AttendanceRecord, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onNavigateToSubjects: () => void;
}

export function AttendanceView({
  subjects,
  attendanceRecords,
  onAddRecord,
  onDeleteRecord,
  onNavigateToSubjects,
}: AttendanceViewProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects.length > 0 ? subjects[0].id : ''
  );

  // Manual record modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [modalStatus, setModalStatus] = useState<'present' | 'absent'>('present');
  const [modalSessionType, setModalSessionType] = useState<SessionType>('lecture');
  const [modalNotes, setModalNotes] = useState('');

  // Future projection simulator inputs
  const [simFutureTotal, setSimFutureTotal] = useState<number>(10);
  const [simFutureAttend, setSimFutureAttend] = useState<number>(8);

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  if (!activeSubject) {
    return (
      <Card className="p-12 text-center border-dashed border-2">
        <CheckSquare className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">No Subjects Found</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          Please add your semester subjects before recording attendance.
        </p>
        <Button variant="primary" className="mt-4" onClick={onNavigateToSubjects}>
          Add Subject
        </Button>
      </Card>
    );
  }

  const subjectRecords = attendanceRecords.filter((r) => r.subjectId === activeSubject.id);
  const summary = summarizeRecords(
    activeSubject.id,
    activeSubject.name,
    subjectRecords,
    activeSubject.attendanceThreshold
  );

  const metrics = calculateAttendanceMetrics(
    summary.attended,
    summary.totalConducted,
    activeSubject.attendanceThreshold
  );

  const projection = projectFutureAttendance(
    summary.attended,
    summary.totalConducted,
    simFutureTotal,
    simFutureAttend
  );

  // Quick 1-click attendance logger for today
  const handleQuickLog = async (status: 'present' | 'absent') => {
    await onAddRecord({
      subjectId: activeSubject.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      status,
      sessionType: 'lecture',
    });
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddRecord({
      subjectId: activeSubject.id,
      date: modalDate,
      status: modalStatus,
      sessionType: modalSessionType,
      notes: modalNotes.trim() || undefined,
    });
    setIsModalOpen(false);
    setModalNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Subject Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {subjects.map((sub) => {
          const subRecs = attendanceRecords.filter((r) => r.subjectId === sub.id);
          const subSum = summarizeRecords(sub.id, sub.name, subRecs, sub.attendanceThreshold);
          return (
            <button
              key={sub.id}
              onClick={() => setSelectedSubjectId(sub.id)}
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
              <span>{sub.code ? `${sub.code} - ${sub.name}` : sub.name}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeSubject.id === sub.id
                    ? 'bg-white/20 text-white'
                    : subSum.status === 'safe'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : subSum.status === 'warning'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : subSum.status === 'critical'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {subSum.percentage !== null ? `${subSum.percentage}%` : 'New'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status Warning Banner if below threshold */}
      {metrics.percentage !== null && metrics.percentage < activeSubject.attendanceThreshold && (
        <Alert variant={metrics.status === 'critical' ? 'danger' : 'warning'} title="Attendance Alert">
          {metrics.explanation} <strong>{metrics.advice}</strong>
        </Alert>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance % */}
        <Card className="border-l-4 border-l-indigo-600">
          <CardHeader className="pb-1">
            <CardDescription>Attendance Percentage</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {metrics.percentage !== null ? `${metrics.percentage}%` : 'No Data'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            Min. Requirement: {activeSubject.attendanceThreshold}%
          </CardContent>
        </Card>

        {/* Classes Attended / Conducted */}
        <Card className="border-l-4 border-l-emerald-600">
          <CardHeader className="pb-1">
            <CardDescription>Attended / Conducted</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.attended} / {metrics.totalConducted}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            Missed: {metrics.missed} class(es)
          </CardContent>
        </Card>

        {/* Bunk Allowance (Safe Misses) */}
        <Card className="border-l-4 border-l-sky-600">
          <CardHeader className="pb-1">
            <div className="flex justify-between items-center">
              <CardDescription>Safe Absences (Bunks)</CardDescription>
              <ShieldCheck className="w-4 h-4 text-sky-500" />
            </div>
            <CardTitle className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
              {metrics.maxClassesCanMiss}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            Additional classes you can miss while keeping ≥{activeSubject.attendanceThreshold}%
          </CardContent>
        </Card>

        {/* Recovery Classes Needed */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1">
            <div className="flex justify-between items-center">
              <CardDescription>Consecutive Classes Needed</CardDescription>
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            </div>
            <CardTitle className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {metrics.classesNeededToTarget}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 dark:text-slate-400">
            {metrics.classesNeededToTarget > 0
              ? `Attend next ${metrics.classesNeededToTarget} classes to reach threshold`
              : 'Threshold currently satisfied'}
          </CardContent>
        </Card>
      </div>

      {/* Quick Mark & Attendance History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Log & Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Quick Attendance Logger</CardTitle>
              <CardDescription>Mark today's lecture with a single click.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="success"
                  size="md"
                  onClick={() => handleQuickLog('present')}
                  className="w-full text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Mark Present
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => handleQuickLog('absent')}
                  className="w-full text-xs"
                >
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  Mark Absent
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="w-full text-xs"
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                Add Historical / Lab Record
              </Button>
            </CardContent>
          </Card>

          {/* Future Attendance Projection Simulator */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Future Projection Simulator
              </CardTitle>
              <CardDescription>Test what happens if you attend upcoming classes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="future-conducted-input" className="text-slate-500 block mb-1">Upcoming Classes:</label>
                  <input
                    id="future-conducted-input"
                    type="number"
                    min="1"
                    max="100"
                    value={simFutureTotal}
                    onChange={(e) => setSimFutureTotal(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label htmlFor="future-attend-input" className="text-slate-500 block mb-1">Will Attend:</label>
                  <input
                    id="future-attend-input"
                    type="number"
                    min="0"
                    max={simFutureTotal}
                    value={simFutureAttend}
                    onChange={(e) => setSimFutureAttend(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-slate-600 dark:text-slate-400">Projected Attendance:</span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {projection.projectedPercentage}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Total will become {projection.projectedAttended} / {projection.projectedTotal}{' '}
                  classes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History Log Table */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Attendance Session Log
                </CardTitle>
                <CardDescription>
                  {subjectRecords.length} recorded session(s) for {activeSubject.name}.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto max-h-96">
              {subjectRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No attendance entries yet. Use the buttons on the left to record your first class!
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 font-semibold text-slate-600 dark:text-slate-400">
                      <th className="p-3 pl-4">Date</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Notes</th>
                      <th className="p-3 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subjectRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-3 pl-4 font-medium text-slate-900 dark:text-slate-100">
                          {rec.date}
                        </td>
                        <td className="p-3 capitalize text-slate-600 dark:text-slate-400">
                          {rec.sessionType}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={rec.status === 'present' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {rec.status === 'present' ? 'Present' : 'Absent'}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500 text-[11px] truncate max-w-xs">
                          {rec.notes || '—'}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            onClick={() => onDeleteRecord(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Attendance Session"
        description={`Log class session for ${activeSubject.name}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleModalSubmit}>
              Save Session
            </Button>
          </>
        }
      >
        <form onSubmit={handleModalSubmit} className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={modalDate}
            onChange={(e) => setModalDate(e.target.value)}
          />
          <Select
            label="Attendance Status"
            value={modalStatus}
            onChange={(e) => setModalStatus(e.target.value as 'present' | 'absent')}
          >
            <option value="present">Present (Attended)</option>
            <option value="absent">Absent (Missed)</option>
          </Select>
          <Select
            label="Session Type"
            value={modalSessionType}
            onChange={(e) => setModalSessionType(e.target.value as SessionType)}
          >
            <option value="lecture">Lecture</option>
            <option value="lab">Lab Practical</option>
            <option value="tutorial">Tutorial</option>
          </Select>
          <Input
            label="Notes (Optional)"
            placeholder="e.g. Traffic delay, Sick leave, Extra class"
            value={modalNotes}
            onChange={(e) => setModalNotes(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
