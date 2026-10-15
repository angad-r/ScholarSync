import { Task, AttendanceSummary, InAppNotification } from '../types';
import { differenceInDays, parseISO, isPast, isToday } from 'date-fns';

export interface NotificationPermissionState {
  isSupported: boolean;
  permission: NotificationPermission;
}

/**
 * Checks browser notification capability and current status.
 */
export function getBrowserNotificationState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { isSupported: false, permission: 'denied' };
  }
  return { isSupported: true, permission: Notification.permission };
}

/**
 * Requests browser notification permission with honest error handling.
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn('Failed to request notification permission:', error);
    return 'denied';
  }
}

/**
 * Triggers a browser desktop notification if permission was explicitly granted.
 */
export function showBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
    return true;
  } catch (err) {
    console.warn('Error showing browser notification:', err);
    return false;
  }
}

/**
 * Scans tasks and attendance summaries to generate active in-app notifications.
 */
export function generateSystemAlerts(
  tasks: Task[],
  attendanceSummaries: AttendanceSummary[]
): InAppNotification[] {
  const alerts: InAppNotification[] = [];
  const now = new Date();

  // 1. Task Overdue & Upcoming Deadline checks
  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'cancelled') continue;

    const dueDate = parseISO(task.dueDate);
    const daysUntilDue = differenceInDays(dueDate, now);

    if (isPast(dueDate) && !isToday(dueDate)) {
      alerts.push({
        id: `alert-overdue-${task.id}`,
        title: `Task Overdue: ${task.title}`,
        message: `Deadline was ${task.dueDate}. Priority: ${task.priority.toUpperCase()}. Update status or reschedule.`,
        type: 'alert',
        category: 'deadline',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTab: 'tasks',
      });
    } else if (isToday(dueDate)) {
      alerts.push({
        id: `alert-today-${task.id}`,
        title: `Due Today: ${task.title}`,
        message: `Task is due today${task.dueTime ? ` at ${task.dueTime}` : ''}. Estimated duration: ${task.estimatedMinutes} mins.`,
        type: 'warning',
        category: 'deadline',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTab: 'tasks',
      });
    } else if (daysUntilDue > 0 && daysUntilDue <= 2) {
      alerts.push({
        id: `alert-soon-${task.id}`,
        title: `Upcoming Deadline (${daysUntilDue}d left): ${task.title}`,
        message: `Due on ${task.dueDate}. Plan study time in the Study Planner.`,
        type: 'info',
        category: 'deadline',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTab: 'tasks',
      });
    }
  }

  // 2. Attendance warning alerts
  for (const summary of attendanceSummaries) {
    if (summary.status === 'critical') {
      alerts.push({
        id: `alert-att-crit-${summary.subjectId}`,
        title: `Critical Attendance: ${summary.subjectName}`,
        message: `Attendance is ${summary.percentage}%, well below threshold of ${summary.threshold}%. Must attend ${summary.classesNeededToTarget} consecutive classes.`,
        type: 'alert',
        category: 'attendance',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTab: 'attendance',
      });
    } else if (summary.status === 'warning') {
      alerts.push({
        id: `alert-att-warn-${summary.subjectId}`,
        title: `Low Attendance Warning: ${summary.subjectName}`,
        message: `Attendance is ${summary.percentage}% (Threshold: ${summary.threshold}%). Attend the next ${summary.classesNeededToTarget} class(es).`,
        type: 'warning',
        category: 'attendance',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTab: 'attendance',
      });
    }
  }

  return alerts;
}
