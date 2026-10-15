export type Priority = 'low' | 'medium' | 'high';
export * from './calendar';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type AssessmentType = 'internal' | 'assignment' | 'quiz' | 'lab' | 'project' | 'final' | 'other';
export type AttendanceStatus = 'present' | 'absent' | 'cancelled';
export type SessionType = 'lecture' | 'lab' | 'tutorial' | 'study' | 'break' | 'free_period';

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface AssessmentComponent {
  id: string;
  name: string;
  type: AssessmentType;
  weight: number; // Percentage contribution towards final score (e.g. 20 for 20%)
  maxMarks: number; // e.g. 50, 100
  marksObtained?: number | null; // null or undefined if not yet conducted/entered
  dueDate?: string | null; // ISO YYYY-MM-DD
  isCompleted: boolean;
  isFinalExam: boolean;
  notes?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  semester: string;
  academicYear: string;
  credits: number;
  instructor?: string;
  color: string; // Tailwind color token or hex
  attendanceThreshold: number; // e.g., 75
  targetScore: number; // e.g., 85
  difficulty: 1 | 2 | 3 | 4 | 5; // 1: Very Easy, 5: Very Hard
  assessmentComponents: AssessmentComponent[];
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  sessionType: SessionType;
  notes?: string;
  createdAt: string;
}

export interface AttendanceSummary {
  subjectId: string;
  subjectName: string;
  totalConducted: number;
  attended: number;
  missed: number;
  percentage: number | null; // null if 0 conducted
  threshold: number;
  status: 'safe' | 'warning' | 'critical' | 'no_data';
  classesNeededToTarget: number;
  maxClassesCanMiss: number;
  isRecoveryPossible: boolean;
}

export interface Task {
  id: string;
  subjectId?: string | null;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string | null; // HH:mm
  priority: Priority;
  status: TaskStatus;
  estimatedMinutes: number;
  completionPercentage: number;
  subtasks: SubTask[];
  category: 'assignment' | 'exam_prep' | 'project' | 'reading' | 'other';
  notes?: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableSession {
  id: string;
  subjectId: string;
  customTitle?: string;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday, 7 = Sunday
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  type: SessionType;
  room?: string;
  notes?: string;
}

export interface TimetableConflict {
  session1: TimetableSession;
  session2: TimetableSession;
  reason: string;
  type: 'overlap' | 'lecture_study_clash' | 'invalid_time';
}

export interface StudySessionPlan {
  id: string;
  taskId?: string | null;
  subjectId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  title: string;
  reason: string;
  priority: Priority;
  isCompleted: boolean;
  createdAt: string;
}

export interface StudyPreferences {
  dailyBudgetMinutes: number; // e.g. 180 min (3 hrs)
  preferredTimeSlots: Array<{ start: string; end: string }>;
  availableDays: number[]; // [1, 2, 3, 4, 5, 6, 7]
  focusPriority: 'deadlines_first' | 'difficulty_first' | 'balanced';
}

export interface UserSettings {
  semester: string;
  academicYear: string;
  defaultAttendanceThreshold: number;
  defaultTargetScore: number;
  studyBudgetHoursPerDay: number;
  isOnboarded: boolean;
  theme: 'light' | 'dark' | 'system';
  browserNotificationsEnabled: boolean;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'alert';
  category: 'attendance' | 'deadline' | 'conflict' | 'system';
  isRead: boolean;
  createdAt: string;
  linkTab?: string;
}

// Marks calculation calculation results
export interface ComponentCalculation {
  componentId: string;
  name: string;
  type: AssessmentType;
  rawMarks: number | null | undefined;
  maxMarks: number;
  normalizedPercentage: number | null;
  weight: number;
  contribution: number | null; // (normalizedPercentage * weight) / 100
  isCompleted: boolean;
  isFinalExam: boolean;
}

export interface SubjectMarksAnalysis {
  subjectId: string;
  subjectName: string;
  targetScore: number;
  totalConfiguredWeight: number; // e.g. 100
  completedWeight: number;
  remainingWeight: number;
  currentWeightedScore: number; // Actual score earned so far (scaled to total weight)
  currentAveragePercentage: number | null; // % achieved among completed assessments
  maxAchievableScore: number; // Assuming 100% in all remaining assessments
  targetAchievableStatus: 'already_achieved' | 'achievable' | 'requires_100_percent' | 'impossible' | 'no_remaining' | 'invalid_configuration';
  requiredScoreInRemaining: number | null; // Required weighted average in remaining assessments to reach target
  components: ComponentCalculation[];
  warnings: string[];
  assumptions: string[];
  formulaDescription: string;
}
