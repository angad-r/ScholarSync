export type AcademicEventType =
  | 'official_holiday'
  | 'user_holiday'
  | 'college_closure'
  | 'cancelled_lecture'
  | 'cancelled_lab'
  | 'additional_working_day'
  | 'extra_lecture'
  | 'rescheduled_exam'
  | 'postponed_exam'
  | 'assignment_deadline'
  | 'college_event'
  | 'vacation_break'
  | 'registration_deadline'
  | 'other';

export type EventSourceType = 'uploaded_calendar' | 'college_website' | 'manual_entry';

export type EventReviewStatus = 'new' | 'duplicate' | 'conflicting' | 'needs_review' | 'accepted';

export interface AcademicEvent {
  id: string;
  title: string;
  eventType: AcademicEventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm
  allDay: boolean;
  affectedSubjectIds?: string[];
  description?: string;
  sourceId?: string;
  sourceType: EventSourceType;
  sourceName?: string;
  sourceEventIdentifier?: string; // Stable signature for duplicate detection
  isUserOverride: boolean; // Precedence: User override > Newer official update > Imported calendar > Study plan
  confidence?: number; // 0-100 extraction confidence
  reviewStatus?: EventReviewStatus;
  importBatchId?: string;
  recurrence?: 'none' | 'weekly';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarSource {
  id: string;
  sourceType: EventSourceType;
  institutionName?: string;
  sourceUrl?: string;
  lastCheckedAt?: string | null;
  lastSyncAt?: string | null;
  syncStatus: 'idle' | 'success' | 'error' | 'syncing';
  lastErrorMessage?: string | null;
  syncIntervalHours?: number;
  detectedEventsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarImport {
  id: string;
  filename: string;
  importTimestamp: string;
  status: 'pending_review' | 'imported' | 'cancelled';
  eventsDetected: number;
  eventsAccepted: number;
  eventsSkipped: number;
  extractedEvents: AcademicEvent[];
  validationErrors?: string[];
}

export interface ScheduleChangeLog {
  id: string;
  eventId: string;
  eventTitle: string;
  action: 'create' | 'update' | 'delete' | 'override' | 'sync';
  previousState?: AcademicEvent | null;
  newState?: AcademicEvent | null;
  description: string;
  timestamp: string;
  source: string;
}

export interface CalendarDiffItem {
  type: 'new' | 'changed' | 'omitted' | 'conflict';
  event: AcademicEvent;
  existingEvent?: AcademicEvent;
  changeDescription?: string;
  requiresReview: boolean;
}
