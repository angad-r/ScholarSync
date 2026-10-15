import { db, updateUserSettings } from '../db';
import { generateDemoData, isDemoId } from '../db/demoData';
import { generateStudySchedule } from '../lib/studyPlanner';
import {
  Subject,
  Task,
  AttendanceRecord,
  TimetableSession,
  StudySessionPlan,
  UserSettings,
  AssessmentComponent,
  AcademicEvent,
  CalendarSource,
} from '../types';

interface ToastNotifier {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

interface UseAcademicActionsProps {
  userSettings: UserSettings;
  subjects: Subject[];
  tasks: Task[];
  timetableSessions: TimetableSession[];
  studyPlans: StudySessionPlan[];
  toast: ToastNotifier;
}

export function useAcademicActions({
  userSettings,
  subjects,
  tasks,
  timetableSessions,
  studyPlans,
  toast,
}: UseAcademicActionsProps) {
  const { success, error: toastError, info } = toast;

  // Handlers for Subjects
  const handleSaveSubject = async (subjectData: Partial<Subject>) => {
    try {
      const now = new Date().toISOString();
      if (subjectData.id) {
        // Edit existing subject
        await db.subjects.update(subjectData.id, {
          ...subjectData,
          updatedAt: now,
        } as any);
        success('Subject Updated', `Updated "${subjectData.name}" successfully.`);
      } else {
        // Create new subject
        const newSubject: Subject = {
          id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: subjectData.name!,
          code: subjectData.code,
          semester: subjectData.semester || userSettings.semester,
          academicYear: subjectData.academicYear || userSettings.academicYear,
          credits: subjectData.credits ?? 4,
          instructor: subjectData.instructor,
          color: subjectData.color || '#4f46e5',
          attendanceThreshold: subjectData.attendanceThreshold ?? userSettings.defaultAttendanceThreshold,
          targetScore: subjectData.targetScore ?? userSettings.defaultTargetScore,
          difficulty: subjectData.difficulty ?? 3,
          assessmentComponents: subjectData.assessmentComponents || [],
          notes: subjectData.notes,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.subjects.add(newSubject);
        success('Subject Created', `Added "${newSubject.name}" to your semester.`);
      }
    } catch (err: any) {
      toastError('Failed to save subject', err.message);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      await db.transaction('rw', [db.subjects, db.attendanceRecords, db.tasks, db.timetableSessions, db.studyPlans], async () => {
        await db.subjects.delete(subjectId);
        await db.attendanceRecords.where('subjectId').equals(subjectId).delete();
        await db.tasks.where('subjectId').equals(subjectId).delete();
        await db.timetableSessions.where('subjectId').equals(subjectId).delete();
        await db.studyPlans.where('subjectId').equals(subjectId).delete();
      });
      success('Subject Deleted', 'Removed subject and linked records.');
    } catch (err: any) {
      toastError('Delete Failed', err.message);
    }
  };

  const handleToggleArchiveSubject = async (subject: Subject) => {
    await db.subjects.update(subject.id, { isArchived: !subject.isArchived });
    info(subject.isArchived ? 'Subject Restored' : 'Subject Archived');
  };

  const handleUpdateSubjectComponents = async (
    subjectId: string,
    components: AssessmentComponent[],
    targetScore: number
  ) => {
    await db.subjects.update(subjectId, {
      assessmentComponents: components,
      targetScore,
      updatedAt: new Date().toISOString(),
    });
  };

  // Handlers for Attendance
  const handleAddAttendanceRecord = async (
    record: Omit<AttendanceRecord, 'id' | 'createdAt'>
  ) => {
    try {
      const newRec: AttendanceRecord = {
        ...record,
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString(),
      };
      await db.attendanceRecords.add(newRec);
      success(
        record.status === 'present' ? 'Marked Present' : 'Marked Absent',
        `Recorded for ${record.date}`
      );
    } catch (err: any) {
      toastError('Failed to record attendance', err.message);
    }
  };

  const handleDeleteAttendanceRecord = async (id: string) => {
    await db.attendanceRecords.delete(id);
    info('Attendance Entry Removed');
  };

  // Handlers for Tasks
  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      const now = new Date().toISOString();
      if (taskData.id) {
        await db.tasks.update(taskData.id, {
          ...taskData,
          updatedAt: now,
        } as any);
        success('Task Updated', `"${taskData.title}" saved.`);
      } else {
        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: taskData.title!,
          description: taskData.description || '',
          subjectId: taskData.subjectId || null,
          dueDate: taskData.dueDate!,
          dueTime: taskData.dueTime || null,
          priority: taskData.priority || 'medium',
          status: taskData.status || 'pending',
          estimatedMinutes: taskData.estimatedMinutes || 60,
          completionPercentage: taskData.completionPercentage || 0,
          subtasks: taskData.subtasks || [],
          category: taskData.category || 'assignment',
          notes: taskData.notes,
          completedAt: taskData.completedAt || null,
          createdAt: now,
          updatedAt: now,
        };
        await db.tasks.add(newTask);
        success('Task Created', `Added "${newTask.title}".`);
      }
    } catch (err: any) {
      toastError('Failed to save task', err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await db.tasks.delete(taskId);
    info('Task Deleted');
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const isNowCompleted = task.status !== 'completed';
    await db.tasks.update(task.id, {
      status: isNowCompleted ? 'completed' : 'pending',
      completionPercentage: isNowCompleted ? 100 : 0,
      completedAt: isNowCompleted ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
    if (isNowCompleted) {
      success('Task Completed! 🎉', `Completed "${task.title}".`);
    } else {
      info('Task Reopened', `"${task.title}" marked pending.`);
    }
  };

  // Handlers for Timetable
  const handleSaveTimetableSession = async (sessionData: Partial<TimetableSession>) => {
    try {
      if (sessionData.id) {
        await db.timetableSessions.update(sessionData.id, sessionData as any);
        success('Schedule Updated');
      } else {
        const newSession: TimetableSession = {
          id: `tt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          subjectId: sessionData.subjectId || '',
          customTitle: sessionData.customTitle,
          dayOfWeek: sessionData.dayOfWeek || 1,
          startTime: sessionData.startTime!,
          endTime: sessionData.endTime!,
          type: sessionData.type || 'lecture',
          room: sessionData.room,
          notes: sessionData.notes,
        };
        await db.timetableSessions.add(newSession);
        success('Slot Added', `Added session for ${newSession.startTime}`);
      }
    } catch (err: any) {
      toastError('Failed to save timetable slot', err.message);
    }
  };

  const handleDeleteTimetableSession = async (sessionId: string) => {
    await db.timetableSessions.delete(sessionId);
    info('Schedule Slot Removed');
  };

  const handleConfirmTimetableImport = async (
    sessionsToImport: TimetableSession[],
    newSubjects: Subject[],
    replaceExisting: boolean
  ) => {
    try {
      if (newSubjects.length > 0) {
        await db.subjects.bulkAdd(newSubjects);
      }
      if (replaceExisting) {
        await db.timetableSessions.clear();
      }
      await db.timetableSessions.bulkPut(sessionsToImport);

      const breakCount = sessionsToImport.filter((s) => s.type === 'break').length;
      const freeCount = sessionsToImport.filter((s) => s.type === 'free_period').length;
      const classCount = sessionsToImport.length - breakCount - freeCount;

      let msg = `Imported ${sessionsToImport.length} slots (${classCount} classes/labs`;
      if (breakCount > 0) msg += `, ${breakCount} breaks`;
      if (freeCount > 0) msg += `, ${freeCount} free periods`;
      msg += `).`;

      if (newSubjects.length > 0) {
        msg += ` Added ${newSubjects.length} new course${newSubjects.length === 1 ? '' : 's'}.`;
      }

      success('Timetable Imported! 📅', msg);
    } catch (err: any) {
      toastError('Failed to import timetable', err.message);
    }
  };

  // Handlers for Study Plans
  const handleSaveStudyPlans = async (plans: StudySessionPlan[]) => {
    await db.studyPlans.clear();
    await db.studyPlans.bulkPut(plans);
    success('Study Plan Generated', `Scheduled ${plans.length} sessions over the next 7 days.`);
  };

  const handleTogglePlanCompletion = async (planId: string) => {
    const plan = await db.studyPlans.get(planId);
    if (plan) {
      await db.studyPlans.update(planId, { isCompleted: !plan.isCompleted });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    await db.studyPlans.delete(planId);
    info('Study Session Removed');
  };

  // Handlers for Academic Calendar & Holidays Extension
  const handleSaveAcademicEvent = async (eventData: Partial<AcademicEvent>) => {
    try {
      const now = new Date().toISOString();
      if (eventData.id) {
        const existing = await db.academicEvents.get(eventData.id);
        await db.academicEvents.update(eventData.id, {
          ...eventData,
          updatedAt: now,
        } as any);

        // Record Change Log
        await db.scheduleChangeLogs.add({
          id: `log-${Date.now()}`,
          eventId: eventData.id,
          eventTitle: eventData.title || existing?.title || 'Event',
          action: 'update',
          previousState: existing,
          newState: { ...existing, ...eventData } as AcademicEvent,
          description: `Updated event "${eventData.title || existing?.title}"`,
          timestamp: now,
          source: eventData.sourceName || 'Manual Entry',
        });
        success('Event Updated', `"${eventData.title}" updated.`);
      } else {
        const newId = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newEv: AcademicEvent = {
          id: newId,
          title: eventData.title!,
          eventType: eventData.eventType || 'user_holiday',
          startDate: eventData.startDate!,
          endDate: eventData.endDate || eventData.startDate!,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          allDay: eventData.allDay ?? true,
          affectedSubjectIds: eventData.affectedSubjectIds,
          description: eventData.description,
          sourceType: eventData.sourceType || 'manual_entry',
          sourceName: eventData.sourceName || 'Manual Entry',
          isUserOverride: eventData.isUserOverride ?? true,
          confidence: eventData.confidence || 100,
          reviewStatus: 'accepted',
          recurrence: eventData.recurrence || 'none',
          notes: eventData.notes,
          createdAt: now,
          updatedAt: now,
        };
        await db.academicEvents.add(newEv);

        await db.scheduleChangeLogs.add({
          id: `log-${Date.now()}`,
          eventId: newId,
          eventTitle: newEv.title,
          action: 'create',
          previousState: null,
          newState: newEv,
          description: `Created new ${newEv.eventType.replace('_', ' ')}: "${newEv.title}"`,
          timestamp: now,
          source: newEv.sourceName || 'Manual Entry',
        });
        success('Event Saved', `Added "${newEv.title}" to calendar.`);
      }

      // Check if holiday was added; if so, trigger deterministic study plan rebalance avoiding this date
      if (
        eventData.eventType === 'official_holiday' ||
        eventData.eventType === 'user_holiday' ||
        eventData.eventType === 'college_closure'
      ) {
        const updatedEvents = await db.academicEvents.toArray();
        const rebalanceResult = generateStudySchedule(
          tasks,
          subjects,
          timetableSessions,
          {
            dailyBudgetMinutes: userSettings.studyBudgetHoursPerDay * 60,
            preferredTimeSlots: [{ start: '18:00', end: '22:00' }],
            availableDays: [1, 2, 3, 4, 5, 6, 7],
            focusPriority: 'deadlines_first',
          },
          studyPlans,
          7,
          updatedEvents
        );
        await db.studyPlans.clear();
        await db.studyPlans.bulkPut(rebalanceResult.plans);
        info('Study Plan Rebalanced', 'Study schedule automatically updated to avoid holiday.');
      }
    } catch (err: any) {
      toastError('Failed to save calendar event', err.message);
    }
  };

  const handleDeleteAcademicEvent = async (eventId: string) => {
    try {
      const existing = await db.academicEvents.get(eventId);
      if (existing) {
        await db.academicEvents.delete(eventId);
        await db.scheduleChangeLogs.add({
          id: `log-${Date.now()}`,
          eventId,
          eventTitle: existing.title,
          action: 'delete',
          previousState: existing,
          newState: null,
          description: `Deleted event "${existing.title}"`,
          timestamp: new Date().toISOString(),
          source: 'User Action',
        });
        info('Event Removed', `Deleted "${existing.title}".`);
      }
    } catch (err: any) {
      toastError('Failed to delete event', err.message);
    }
  };

  const handleUndoChange = async (logId: string) => {
    try {
      const log = await db.scheduleChangeLogs.get(logId);
      if (!log) return;

      if (log.action === 'create' && log.eventId) {
        await db.academicEvents.delete(log.eventId);
        success('Undo Successful', `Reverted creation of "${log.eventTitle}".`);
      } else if (log.action === 'update' && log.previousState) {
        await db.academicEvents.put(log.previousState);
        success('Undo Successful', `Restored previous state of "${log.eventTitle}".`);
      } else if (log.action === 'delete' && log.previousState) {
        await db.academicEvents.put(log.previousState);
        success('Undo Successful', `Restored deleted event "${log.eventTitle}".`);
      }
      await db.scheduleChangeLogs.delete(logId);
    } catch (err: any) {
      toastError('Undo failed', err.message);
    }
  };

  const handleConfirmCalendarImport = async (
    eventsToImport: AcademicEvent[],
    filename: string
  ) => {
    try {
      await db.academicEvents.bulkPut(eventsToImport);
      await db.calendarImports.add({
        id: `import-${Date.now()}`,
        filename,
        importTimestamp: new Date().toISOString(),
        status: 'imported',
        eventsDetected: eventsToImport.length,
        eventsAccepted: eventsToImport.length,
        eventsSkipped: 0,
        extractedEvents: eventsToImport,
      });

      await db.calendarSources.put({
        id: `src-${filename.replace(/\s+/g, '_')}`,
        sourceType: 'uploaded_calendar',
        institutionName: filename,
        lastCheckedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'success',
        detectedEventsCount: eventsToImport.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      success('Calendar Imported! 📅', `Added ${eventsToImport.length} verified events from "${filename}".`);
    } catch (err: any) {
      toastError('Calendar Import Failed', err.message);
    }
  };

  const handleApplyWebsiteSync = async (
    newEvents: AcademicEvent[],
    sourceInfo: Partial<CalendarSource>
  ) => {
    try {
      await db.academicEvents.bulkPut(newEvents);
      const sourceId = `src-website-${Date.now()}`;
      await db.calendarSources.put({
        id: sourceId,
        sourceType: 'college_website',
        sourceUrl: sourceInfo.sourceUrl,
        institutionName: sourceInfo.institutionName,
        lastCheckedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'success',
        detectedEventsCount: newEvents.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      success('College Sync Completed! 🌐', `Imported ${newEvents.length} official updates. User overrides protected.`);
    } catch (err: any) {
      toastError('Website Sync Failed', err.message);
    }
  };

  // Demo Data Handlers
  const handleLoadDemoData = async () => {
    try {
      const demo = generateDemoData();
      await db.transaction(
        'rw',
        [db.subjects, db.attendanceRecords, db.tasks, db.timetableSessions, db.studyPlans, db.userSettings],
        async () => {
          await Promise.all([
            db.subjects.bulkPut(demo.subjects),
            db.attendanceRecords.bulkPut(demo.attendanceRecords),
            db.tasks.bulkPut(demo.tasks),
            db.timetableSessions.bulkPut(demo.timetableSessions),
            db.studyPlans.bulkPut(demo.studyPlans),
            updateUserSettings({ ...demo.userSettings, isOnboarded: true }),
          ]);
        }
      );
      success('B.Tech CSE Demo Data Loaded! 🚀', 'Complete sample semester ready for testing.');
    } catch (err: any) {
      toastError('Failed to load demo data', err.message);
    }
  };

  const handleRemoveDemoData = async () => {
    try {
      await db.transaction(
        'rw',
        [db.subjects, db.attendanceRecords, db.tasks, db.timetableSessions, db.studyPlans],
        async () => {
          const [subs, atts, ts, tts, plans] = await Promise.all([
            db.subjects.toArray(),
            db.attendanceRecords.toArray(),
            db.tasks.toArray(),
            db.timetableSessions.toArray(),
            db.studyPlans.toArray(),
          ]);

          const demoSubIds = subs.filter((s) => isDemoId(s.id)).map((s) => s.id);
          const demoAttIds = atts.filter((a) => isDemoId(a.id)).map((a) => a.id);
          const demoTaskIds = ts.filter((t) => isDemoId(t.id)).map((t) => t.id);
          const demoTtIds = tts.filter((tt) => isDemoId(tt.id)).map((tt) => tt.id);
          const demoPlanIds = plans.filter((p) => isDemoId(p.id)).map((p) => p.id);

          await Promise.all([
            db.subjects.bulkDelete(demoSubIds),
            db.attendanceRecords.bulkDelete(demoAttIds),
            db.tasks.bulkDelete(demoTaskIds),
            db.timetableSessions.bulkDelete(demoTtIds),
            db.studyPlans.bulkDelete(demoPlanIds),
          ]);
        }
      );
      info('Demo Records Removed', 'Cleaned up sample demonstration data.');
    } catch (err: any) {
      toastError('Failed to remove demo data', err.message);
    }
  };

  // User Settings Handler
  const handleUpdateSettings = async (settings: Partial<UserSettings>) => {
    await updateUserSettings(settings);
    success('Settings Saved');
  };

  const toggleTheme = () => {
    const next = userSettings.theme === 'dark' ? 'light' : 'dark';
    handleUpdateSettings({ theme: next });
  };

  return {
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
  };
}
