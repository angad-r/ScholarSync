import React, { useState } from 'react';
import { UserSettings, Subject, AttendanceRecord, Task } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { Modal } from '../common/Modal';
import {
  exportDatabaseToJson,
  validateAndPreviewImport,
  applyImport,
  resetDatabase,
  generateSubjectsCsv,
  generateTasksCsv,
  generateAttendanceCsv,
  ImportPreview,
} from '../../db/backupRestore';
import {
  requestBrowserNotificationPermission,
  getBrowserNotificationState,
} from '../../lib/notificationService';
import {
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  Shield,
  Bell,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Github,
  Linkedin,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';

interface SettingsViewProps {
  userSettings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  subjects: Subject[];
  attendanceRecords: AttendanceRecord[];
  tasks: Task[];
  onLoadDemoData: () => Promise<void>;
  onRemoveDemoData: () => Promise<void>;
  hasDemoData: boolean;
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export function SettingsView({
  userSettings,
  onUpdateSettings,
  subjects,
  attendanceRecords,
  tasks,
  onLoadDemoData,
  onRemoveDemoData,
  hasDemoData,
  theme,
  onSetTheme,
}: SettingsViewProps) {
  const [semester, setSemester] = useState(userSettings.semester);
  const [academicYear, setAcademicYear] = useState(userSettings.academicYear);
  const [defaultThreshold, setDefaultThreshold] = useState(userSettings.defaultAttendanceThreshold);
  const [defaultTarget, setDefaultTarget] = useState(userSettings.defaultTargetScore);
  const [studyBudget, setStudyBudget] = useState(userSettings.studyBudgetHoursPerDay);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Creator & Social Links State
  const [creatorName, setCreatorName] = useState(userSettings.creatorName || 'Angad Ranjan');
  const [creatorGithubUrl, setCreatorGithubUrl] = useState(userSettings.creatorGithubUrl || 'https://github.com/angad-r');
  const [creatorLinkedinUrl, setCreatorLinkedinUrl] = useState(userSettings.creatorLinkedinUrl || 'https://in.linkedin.com/in/angad-ranjan-057616380');
  const [isSavingCreator, setIsSavingCreator] = useState(false);
  const [creatorSavedSuccess, setCreatorSavedSuccess] = useState(false);

  // Import flow state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Notification state
  const notifState = getBrowserNotificationState();

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        semester,
        academicYear,
        defaultAttendanceThreshold: Number(defaultThreshold),
        defaultTargetScore: Number(defaultTarget),
        studyBudgetHoursPerDay: Number(studyBudget),
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveCreatorLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCreator(true);
    setCreatorSavedSuccess(false);
    try {
      await onUpdateSettings({
        creatorName: creatorName.trim() || 'Angad Ranjan',
        creatorGithubUrl: creatorGithubUrl.trim() || 'https://github.com/angad-r',
        creatorLinkedinUrl: creatorLinkedinUrl.trim() || 'https://in.linkedin.com/in/angad-ranjan-057616380',
      });
      setCreatorSavedSuccess(true);
      setTimeout(() => setCreatorSavedSuccess(false), 3000);
    } finally {
      setIsSavingCreator(false);
    }
  };

  const handleExportJson = async () => {
    const jsonStr = await exportDatabaseToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholarsync_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const preview = await validateAndPreviewImport(content);
      setImportPreview(preview);
      setIsImportModalOpen(true);
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleApplyImport = async (mode: 'merge' | 'replace') => {
    if (!importPreview?.parsedData) return;
    setIsApplyingImport(true);
    try {
      await applyImport(importPreview.parsedData, mode);
      setIsImportModalOpen(false);
      setImportPreview(null);
      setImportFile(null);
      window.location.reload(); // Refresh to reload live tables
    } finally {
      setIsApplyingImport(false);
    }
  };

  const handleResetDatabase = async () => {
    setIsResetting(true);
    try {
      await resetDatabase();
      setIsResetModalOpen(false);
      window.location.reload();
    } finally {
      setIsResetting(false);
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Academic Term Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            Academic Profile & Defaults
          </CardTitle>
          <CardDescription>
            Configure your active semester and default calculation thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Current Semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Semester 5"
              />
              <Input
                label="Academic Year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2024 - 2025"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Default Attendance Threshold (%)"
                type="number"
                min="0"
                max="100"
                value={defaultThreshold}
                onChange={(e) => setDefaultThreshold(Number(e.target.value))}
                helperText="Standard criteria: 75% or 80%"
              />
              <Input
                label="Default Target Score (%)"
                type="number"
                min="0"
                max="100"
                value={defaultTarget}
                onChange={(e) => setDefaultTarget(Number(e.target.value))}
                helperText="Baseline for grade simulations"
              />
              <Input
                label="Daily Study Time Budget (Hours)"
                type="number"
                min="1"
                max="10"
                value={studyBudget}
                onChange={(e) => setStudyBudget(Number(e.target.value))}
                helperText="Max daily planned hours"
              />
            </div>

            <Button type="submit" variant="primary" isLoading={isSavingSettings} size="sm">
              Save Academic Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appearance & Notification Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              Interface Theme
            </CardTitle>
            <CardDescription>Select your preferred color scheme.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <button
              onClick={() => onSetTheme('light')}
              className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                theme === 'light'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600'
              }`}
            >
              <Sun className="w-4 h-4" /> Light
            </button>
            <button
              onClick={() => onSetTheme('dark')}
              className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                theme === 'dark'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600'
              }`}
            >
              <Moon className="w-4 h-4" /> Dark
            </button>
            <button
              onClick={() => onSetTheme('system')}
              className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                theme === 'system'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600'
              }`}
            >
              <Laptop className="w-4 h-4" /> Auto
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              Browser Notifications
            </CardTitle>
            <CardDescription>
              Optional desktop reminders for deadline alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Current Status:</span>
              <Badge
                variant={
                  notifState.permission === 'granted'
                    ? 'success'
                    : notifState.permission === 'denied'
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
              >
                {notifState.permission}
              </Badge>
            </div>
            {notifState.permission !== 'granted' && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const p = await requestBrowserNotificationPermission();
                  if (p === 'granted') {
                    await onUpdateSettings({ browserNotificationsEnabled: true });
                  }
                }}
                className="w-full text-xs"
              >
                Request Notification Permission
              </Button>
            )}
            <p className="text-[11px] text-slate-500">
              Note: In-app reminders will continue to function on the dashboard regardless of browser permissions.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Demonstration Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Demonstration Dataset
          </CardTitle>
          <CardDescription>
            Instantly populate realistic B.Tech CSE courses, marks, attendance, and timetable for presentation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadDemoData}
              className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
              Load B.Tech CSE Demo Data
            </Button>

            {hasDemoData && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRemoveDemoData}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Remove Demo Records Only
              </Button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Demo data items use unique prefixes and can be safely removed without erasing your personal entries.
          </p>
        </CardContent>
      </Card>

      {/* Data Backup, Recovery & Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-500" />
            Data Storage, Backup & Export
          </CardTitle>
          <CardDescription>
            All records reside in your browser's local IndexedDB. Periodically export backups to keep your data secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" onClick={handleExportJson} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Full Backup (JSON)
            </Button>

            <label className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 text-xs px-3 py-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Restore from JSON Backup
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* CSV Export Options */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Spreadsheet Reports (CSV):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(generateSubjectsCsv(subjects), 'scholarsync_subjects.csv')
                }
                className="text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Subjects CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(generateAttendanceCsv(attendanceRecords, subjects), 'scholarsync_attendance.csv')
                }
                className="text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Attendance Log CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(generateTasksCsv(tasks, subjects), 'scholarsync_tasks.csv')
                }
                className="text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Tasks CSV
              </Button>
            </div>
          </div>

          {/* Dangerous Zone */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Reset Local Database</p>
              <p className="text-[11px] text-slate-500">Erases all records and resets application state.</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsResetModalOpen(true)}
              className="text-xs"
            >
              Reset Application
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Creator & Social Profiles Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <CardTitle>Creator & Social Profiles</CardTitle>
          </div>
          <CardDescription>
            Official GitHub and LinkedIn handles for the creator of ScholarSync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveCreatorLinks} className="space-y-4">
            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <a
                href={creatorGithubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-all shadow-sm"
              >
                <Github className="w-4 h-4" />
                <span>Visit GitHub Profile</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>

              <a
                href={creatorLinkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0a66c2] text-white hover:bg-[#004182] transition-all shadow-sm"
              >
                <Linkedin className="w-4 h-4" />
                <span>Visit LinkedIn Profile</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Creator Name"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="e.g. Angad"
                helperText="Displayed in the sidebar, header, and mobile navigation."
              />

              <Input
                label="GitHub URL or Username"
                value={creatorGithubUrl}
                onChange={(e) => setCreatorGithubUrl(e.target.value)}
                placeholder="https://github.com/your-username"
                helperText="Link to creator's GitHub profile repository."
              />

              <Input
                label="LinkedIn Profile URL"
                value={creatorLinkedinUrl}
                onChange={(e) => setCreatorLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/your-profile"
                helperText="Link to creator's LinkedIn profile."
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {creatorSavedSuccess ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Creator social links saved successfully!
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Links update automatically across the entire app interface.
                </span>
              )}

              <Button type="submit" variant="primary" size="sm" isLoading={isSavingCreator}>
                Save Creator Links
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <Shield className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-900 dark:text-slate-200">
            Privacy by Design Guarantee
          </p>
          <p className="text-[11px] leading-relaxed">
            ScholarSync is a 100% client-side application. No analytics, tracking tokens, or personal academic records are ever transmitted to any external server. All calculations and storage happen entirely within your local browser sandbox.
          </p>
        </div>
      </div>

      {/* Import Preview Modal */}
      {importPreview && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Backup File Validation Preview"
          description={
            importPreview.isValid
              ? 'Backup file verified successfully. Review contents before applying.'
              : 'Backup validation failed.'
          }
          size="lg"
          footer={
            importPreview.isValid ? (
              <>
                <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleApplyImport('merge')}
                  isLoading={isApplyingImport}
                >
                  Merge with Existing Records
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleApplyImport('replace')}
                  isLoading={isApplyingImport}
                >
                  Replace Database Entirely
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
                Close
              </Button>
            )
          }
        >
          {importPreview.isValid ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-slate-500 block">Subjects</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {importPreview.counts.subjects}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-slate-500 block">Attendance</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {importPreview.counts.attendanceRecords}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-slate-500 block">Tasks</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {importPreview.counts.tasks}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-slate-500 block">Timetable Slots</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {importPreview.counts.timetableSessions}
                  </span>
                </div>
              </div>

              {importPreview.warnings.length > 0 && (
                <Alert variant="warning" title="Import Considerations">
                  <ul className="list-disc list-inside space-y-1">
                    {importPreview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <p className="text-slate-500">
                Backup exported on:{' '}
                <strong>{new Date(importPreview.exportedAt).toLocaleString()}</strong> (Schema v
                {importPreview.schemaVersion}). Choose <strong>Merge</strong> to keep existing records or <strong>Replace</strong> to restore clean state.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert variant="danger" title="Malformed or Incompatible Backup File">
                <p>The selected JSON file could not be parsed as a valid ScholarSync backup:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {importPreview.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}
        </Modal>
      )}

      {/* Database Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Confirm Database Reset"
        description="Are you absolutely sure you want to clear your local database?"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleResetDatabase} isLoading={isResetting}>
              Yes, Clear Everything
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          This operation will permanently delete all stored subjects, attendance logs, tasks, timetable slots, and study plans from this browser's IndexedDB. We suggest exporting a JSON backup first if you want to keep your data.
        </p>
      </Modal>
    </div>
  );
}
