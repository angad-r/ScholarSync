import React, { useState, useEffect } from 'react';
import {
  useSubjects,
  useAllSubjects,
  useAttendanceRecords,
  useTasks,
  useTimetableSessions,
  useStudyPlans,
  useUserSettings,
  useAcademicEvents,
  useCalendarSources,
  useScheduleChangeLogs,
} from './db/hooks';
import { isDemoId } from './db/demoData';
import { generateSystemAlerts } from './lib/notificationService';
import { summarizeRecords } from './lib/attendanceCalculator';
import { useAcademicActions } from './hooks/useAcademicActions';
import {
  Subject,
  Task,
  TimetableSession,
  AcademicEvent,
} from './types';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { SubjectList } from './components/subjects/SubjectList';
import { SubjectModal } from './components/subjects/SubjectModal';
import { MarksCalculatorView } from './components/marks/MarksCalculatorView';
import { AttendanceView } from './components/attendance/AttendanceView';
import { TaskListView } from './components/tasks/TaskListView';
import { TaskModal } from './components/tasks/TaskModal';
import { StudyPlannerView } from './components/studyPlanner/StudyPlannerView';
import { TimetableGrid } from './components/timetable/TimetableGrid';
import { TimetableModal } from './components/timetable/TimetableModal';
import { TimetableUploadModal } from './components/timetable/TimetableUploadModal';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { AcademicCalendarView } from './components/calendar/AcademicCalendarView';
import { CalendarUploadModal } from './components/calendar/CalendarUploadModal';
import { ManageHolidaysModal } from './components/calendar/ManageHolidaysModal';
import { WebsiteSyncModal } from './components/calendar/WebsiteSyncModal';
import { ToastProvider, useToast } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export function ScholarSyncApp() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedSubjectIdForMarks, setSelectedSubjectIdForMarks] = useState<string | undefined>();

  // Database Live Queries
  const subjects = useSubjects(false); // active only
  const allSubjects = useAllSubjects(); // active + archived
  const attendanceRecords = useAttendanceRecords();
  const tasks = useTasks();
  const timetableSessions = useTimetableSessions();
  const studyPlans = useStudyPlans();
  const userSettings = useUserSettings();
  const academicEvents = useAcademicEvents();
  const calendarSources = useCalendarSources();
  const changeLogs = useScheduleChangeLogs();

  const { success, error: toastError, info } = useToast();

  // Modals state
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [editingTimetableSession, setEditingTimetableSession] = useState<TimetableSession | null>(null);
  const [initialTimetableDay, setInitialTimetableDay] = useState<number>(1);
  const [isTimetableUploadModalOpen, setIsTimetableUploadModalOpen] = useState(false);

  // Calendar Modals state
  const [isCalendarUploadModalOpen, setIsCalendarUploadModalOpen] = useState(false);
  const [isManageHolidaysModalOpen, setIsManageHolidaysModalOpen] = useState(false);
  const [isWebsiteSyncModalOpen, setIsWebsiteSyncModalOpen] = useState(false);
  const [editingAcademicEvent, setEditingAcademicEvent] = useState<AcademicEvent | null>(null);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    const theme = userSettings.theme;

    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [userSettings.theme]);

  // Generate In-App Alerts
  const attendanceSummaries = subjects.map((sub) => {
    const subRecs = attendanceRecords.filter((r) => r.subjectId === sub.id);
    return summarizeRecords(sub.id, sub.name, subRecs, sub.attendanceThreshold);
  });
  const systemAlerts = generateSystemAlerts(tasks, attendanceSummaries);

  const hasDemoData = allSubjects.some((s) => isDemoId(s.id));

  // Academic Domain Actions (encapsulated database mutations & business logic)
  const {
    handleSaveSubject,
    handleDeleteSubject,
    handleToggleArchiveSubject,
    handleUpdateSubjectComponents,
    handleAddAttendanceRecord,
    handleDeleteAttendanceRecord,
    handleSaveTask,
    handleDeleteTask,
    handleToggleTaskStatus,
    handleSaveTimetableSession,
    handleDeleteTimetableSession,
    handleConfirmTimetableImport,
    handleSaveStudyPlans,
    handleTogglePlanCompletion,
    handleDeletePlan,
    handleSaveAcademicEvent,
    handleDeleteAcademicEvent,
    handleUndoChange,
    handleConfirmCalendarImport,
    handleApplyWebsiteSync,
    handleLoadDemoData,
    handleRemoveDemoData,
    handleUpdateSettings,
    toggleTheme,
  } = useAcademicActions({
    userSettings,
    subjects,
    tasks,
    timetableSessions,
    studyPlans,
    toast: { success, error: toastError, info },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          semesterText={userSettings.semester}
          isDemoActive={hasDemoData}
        />
      </div>

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        semesterText={userSettings.semester}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          onQuickAction={(action) => {
            if (action === 'add_task') {
              setEditingTask(null);
              setIsTaskModalOpen(true);
            } else if (action === 'add_subject') {
              setEditingSubject(null);
              setIsSubjectModalOpen(true);
            } else if (action === 'load_demo') {
              handleLoadDemoData();
            }
          }}
          notifications={systemAlerts}
          onNotificationClick={(tab) => setCurrentTab(tab)}
          theme={userSettings.theme}
          onToggleTheme={toggleTheme}
          hasSubjects={subjects.length > 0}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              subjects={subjects}
              attendanceRecords={attendanceRecords}
              tasks={tasks}
              timetableSessions={timetableSessions}
              studyPlans={studyPlans}
              userSettings={userSettings}
              academicEvents={academicEvents}
              calendarSources={calendarSources}
              onNavigate={setCurrentTab}
              onLoadDemoData={handleLoadDemoData}
            />
          )}

          {currentTab === 'subjects' && (
            <SubjectList
              subjects={allSubjects}
              onAddSubject={() => {
                setEditingSubject(null);
                setIsSubjectModalOpen(true);
              }}
              onEditSubject={(subject) => {
                setEditingSubject(subject);
                setIsSubjectModalOpen(true);
              }}
              onDeleteSubject={handleDeleteSubject}
              onToggleArchive={handleToggleArchiveSubject}
              onNavigateToMarks={(subId) => {
                setSelectedSubjectIdForMarks(subId);
                setCurrentTab('marks');
              }}
              onLoadDemoData={handleLoadDemoData}
            />
          )}

          {currentTab === 'marks' && (
            <MarksCalculatorView
              subjects={subjects}
              selectedSubjectId={selectedSubjectIdForMarks}
              onUpdateSubjectComponents={handleUpdateSubjectComponents}
              onNavigateToSubjects={() => setCurrentTab('subjects')}
            />
          )}

          {currentTab === 'attendance' && (
            <AttendanceView
              subjects={subjects}
              attendanceRecords={attendanceRecords}
              onAddRecord={handleAddAttendanceRecord}
              onDeleteRecord={handleDeleteAttendanceRecord}
              onNavigateToSubjects={() => setCurrentTab('subjects')}
            />
          )}

          {currentTab === 'tasks' && (
            <TaskListView
              tasks={tasks}
              subjects={subjects}
              onAddTask={() => {
                setEditingTask(null);
                setIsTaskModalOpen(true);
              }}
              onEditTask={(task) => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
              onToggleTaskStatus={handleToggleTaskStatus}
            />
          )}

          {currentTab === 'studyPlanner' && (
            <StudyPlannerView
              tasks={tasks}
              subjects={subjects}
              timetableSessions={timetableSessions}
              studyPlans={studyPlans}
              onSaveStudyPlans={handleSaveStudyPlans}
              onTogglePlanCompletion={handleTogglePlanCompletion}
              onDeletePlan={handleDeletePlan}
            />
          )}

          {currentTab === 'timetable' && (
            <TimetableGrid
              sessions={timetableSessions}
              subjects={subjects}
              onAddSession={(day) => {
                setEditingTimetableSession(null);
                setInitialTimetableDay(day || 1);
                setIsTimetableModalOpen(true);
              }}
              onEditSession={(session) => {
                setEditingTimetableSession(session);
                setIsTimetableModalOpen(true);
              }}
              onDeleteSession={handleDeleteTimetableSession}
              onOpenUploadModal={() => setIsTimetableUploadModalOpen(true)}
            />
          )}

          {currentTab === 'calendar' && (
            <AcademicCalendarView
              events={academicEvents}
              subjects={subjects}
              calendarSources={calendarSources}
              changeLogs={changeLogs}
              onAddOrEditEvent={handleSaveAcademicEvent}
              onDeleteEvent={handleDeleteAcademicEvent}
              onOpenUploadModal={() => setIsCalendarUploadModalOpen(true)}
              onOpenManageHolidaysModal={() => {
                setEditingAcademicEvent(null);
                setIsManageHolidaysModalOpen(true);
              }}
              onOpenWebsiteSyncModal={() => setIsWebsiteSyncModalOpen(true)}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              subjects={subjects}
              attendanceRecords={attendanceRecords}
              tasks={tasks}
              studyPlans={studyPlans}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              userSettings={userSettings}
              onUpdateSettings={handleUpdateSettings}
              subjects={subjects}
              attendanceRecords={attendanceRecords}
              tasks={tasks}
              onLoadDemoData={handleLoadDemoData}
              onRemoveDemoData={handleRemoveDemoData}
              hasDemoData={hasDemoData}
              theme={userSettings.theme}
              onSetTheme={(t) => handleUpdateSettings({ theme: t })}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSave={handleSaveSubject}
        initialSubject={editingSubject}
        defaultSemester={userSettings.semester}
        defaultAcademicYear={userSettings.academicYear}
        defaultThreshold={userSettings.defaultAttendanceThreshold}
        defaultTargetScore={userSettings.defaultTargetScore}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        initialTask={editingTask}
        subjects={subjects}
      />

      <TimetableModal
        isOpen={isTimetableModalOpen}
        onClose={() => setIsTimetableModalOpen(false)}
        onSave={handleSaveTimetableSession}
        initialSession={editingTimetableSession}
        subjects={subjects}
        initialDay={initialTimetableDay}
      />

      <TimetableUploadModal
        isOpen={isTimetableUploadModalOpen}
        onClose={() => setIsTimetableUploadModalOpen(false)}
        subjects={subjects}
        onConfirmImport={handleConfirmTimetableImport}
      />

      {/* Calendar Extension Modals */}
      <CalendarUploadModal
        isOpen={isCalendarUploadModalOpen}
        onClose={() => setIsCalendarUploadModalOpen(false)}
        onConfirmImport={handleConfirmCalendarImport}
        existingEvents={academicEvents}
      />

      <ManageHolidaysModal
        isOpen={isManageHolidaysModalOpen}
        onClose={() => setIsManageHolidaysModalOpen(false)}
        onSaveEvent={handleSaveAcademicEvent}
        initialEvent={editingAcademicEvent}
        subjects={subjects}
        changeLogs={changeLogs}
        onUndoChange={handleUndoChange}
      />

      <WebsiteSyncModal
        isOpen={isWebsiteSyncModalOpen}
        onClose={() => setIsWebsiteSyncModalOpen(false)}
        onApplySync={handleApplyWebsiteSync}
        existingEvents={academicEvents}
        currentSource={calendarSources.find((s) => s.sourceType === 'college_website')}
      />

      {/* Onboarding Wizard on First Launch */}
      {!userSettings.isOnboarded && allSubjects.length === 0 && (
        <OnboardingModal
          isOpen={!userSettings.isOnboarded}
          onComplete={async (conf) => {
            await handleUpdateSettings({ ...conf, isOnboarded: true });
          }}
          onLoadDemoData={async () => {
            await handleLoadDemoData();
          }}
          onSkip={async () => {
            await handleUpdateSettings({ isOnboarded: true });
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ScholarSyncApp />
      </ToastProvider>
    </ErrorBoundary>
  );
}
