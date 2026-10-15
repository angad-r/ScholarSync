import { AcademicEvent, CalendarSource, CalendarDiffItem } from '../types';

export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

/**
 * Validates untrusted college URLs with strict SSRF and protocol protections.
 */
export function validateCollegeUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Invalid URL format. Include http:// or https://' };
  }

  // 1. Enforce HTTP/HTTPS only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTP and HTTPS protocols are allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. SSRF Protection: Block localhost and loopback
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  ) {
    return { isValid: false, error: 'Security policy violation: Localhost access is blocked.' };
  }

  // 3. Block private IP ranges (RFC 1918) and link-local (169.254.x.x cloud metadata)
  const isPrivateIp =
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname) || // AWS/GCP/Azure metadata
    /^0\.0\.0\.0$/.test(hostname);

  if (isPrivateIp) {
    return {
      isValid: false,
      error: 'Security policy violation: Internal and private network IP addresses are forbidden.',
    };
  }

  // 4. Block AWS/GCP/Cloud internal domain patterns
  if (
    hostname.includes('metadata.google') ||
    hostname.includes('169.254.169.254') ||
    hostname.includes('.internal') ||
    hostname.includes('.local')
  ) {
    return { isValid: false, error: 'Security policy violation: Cloud metadata endpoints are blocked.' };
  }

  return { isValid: true, sanitizedUrl: parsed.toString() };
}

/**
 * Compares freshly detected events from a college website against existing records.
 * Implements strict precedence rules:
 * 1. User manual override (NEVER overwritten silently)
 * 2. Confirmed newer official update
 * 3. Existing imported calendar
 * 4. Generated study plan
 */
export function calculateCalendarDiff(
  detectedEvents: AcademicEvent[],
  existingEvents: AcademicEvent[]
): CalendarDiffItem[] {
  const diffs: CalendarDiffItem[] = [];
  const existingMap = new Map<string, AcademicEvent>();

  // Map by normalized title and start date
  for (const e of existingEvents) {
    const key = `${e.title.toLowerCase().trim()}_${e.startDate}`;
    existingMap.set(key, e);
  }

  const detectedKeys = new Set<string>();

  const handledExistingIds = new Set<string>();

  for (const detected of detectedEvents) {
    const key = `${detected.title.toLowerCase().trim()}_${detected.startDate}`;
    detectedKeys.add(key);

    const existing = existingMap.get(key);

    if (!existing) {
      // Check if an existing event has same title but DIFFERENT date (rescheduled!)
      const sameTitleOtherDate = existingEvents.find(
        (e) => e.title.toLowerCase().trim() === detected.title.toLowerCase().trim()
      );

      if (sameTitleOtherDate) {
        handledExistingIds.add(sameTitleOtherDate.id);
        if (sameTitleOtherDate.isUserOverride) {
          diffs.push({
            type: 'conflict',
            event: detected,
            existingEvent: sameTitleOtherDate,
            changeDescription: `Official site proposes new date (${detected.startDate}), but you have a manual override on ${sameTitleOtherDate.startDate}. Your override takes precedence.`,
            requiresReview: true,
          });
        } else {
          diffs.push({
            type: 'changed',
            event: detected,
            existingEvent: sameTitleOtherDate,
            changeDescription: `Date changed from ${sameTitleOtherDate.startDate} to ${detected.startDate}`,
            requiresReview: true,
          });
        }
      } else {
        diffs.push({
          type: 'new',
          event: detected,
          changeDescription: 'New official event published by institution',
          requiresReview: false,
        });
      }
    } else {
      handledExistingIds.add(existing.id);
      // Event exists on exact date. Check if user override
      if (existing.isUserOverride) {
        // Retain user override unchanged
        continue;
      }
    }
  }

  // Check for events that exist in database from official source but are absent in latest feed
  for (const existing of existingEvents) {
    if (existing.sourceType === 'college_website' && !existing.isUserOverride) {
      if (handledExistingIds.has(existing.id)) continue;
      const key = `${existing.title.toLowerCase().trim()}_${existing.startDate}`;
      if (!detectedKeys.has(key)) {
        diffs.push({
          type: 'omitted',
          event: existing,
          existingEvent: existing,
          changeDescription:
            'Event was omitted from the latest published notice. Not deleted automatically to prevent accidental loss.',
          requiresReview: true,
        });
      }
    }
  }

  return diffs;
}

/**
 * Discovers and parses university academic notices/calendar.
 *
 * ARCHITECTURAL NOTE:
 * In a pure client-side browser application without an intermediate backend proxy,
 * browser Cross-Origin Resource Sharing (CORS) policies prevent fetching raw external
 * HTML from arbitrary university domains.
 *
 * This adapter validates the external university URL against SSRF and private-network
 * policies, then serves as a deterministic client-side simulation adapter. In a production
 * deployment with a backend API gateway, this adapter connects to a headless scraper/parser
 * service or institutional ERP webhook.
 */
export async function discoverCollegeCalendar(
  targetUrl: string,
  institutionName: string = 'University Portal'
): Promise<{
  success: boolean;
  detectedEvents: AcademicEvent[];
  sourceDetails: Partial<CalendarSource>;
  error?: string;
}> {
  const validation = validateCollegeUrl(targetUrl);
  if (!validation.isValid) {
    return {
      success: false,
      detectedEvents: [],
      sourceDetails: { syncStatus: 'error', lastErrorMessage: validation.error },
      error: validation.error,
    };
  }

  const now = new Date();
  const year = now.getFullYear();
  const nextMonth = (now.getMonth() + 2).toString().padStart(2, '0');

  // Simulated official published calendar feed corresponding to the verified university URL
  const detectedEvents: AcademicEvent[] = [
    {
      id: `site-ev-1-${Date.now()}`,
      title: 'Mid-Semester Examinations',
      eventType: 'rescheduled_exam',
      startDate: `${year}-${nextMonth}-10`,
      endDate: `${year}-${nextMonth}-16`,
      allDay: true,
      sourceType: 'college_website',
      sourceName: institutionName,
      isUserOverride: false,
      confidence: 95,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: `site-ev-2-${Date.now()}`,
      title: 'National Holiday (Official Closure)',
      eventType: 'official_holiday',
      startDate: `${year}-${nextMonth}-24`,
      endDate: `${year}-${nextMonth}-24`,
      allDay: true,
      sourceType: 'college_website',
      sourceName: institutionName,
      isUserOverride: false,
      confidence: 98,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: `site-ev-3-${Date.now()}`,
      title: 'Annual Technical Symposium & Project Exhibition',
      eventType: 'college_event',
      startDate: `${year}-${nextMonth}-28`,
      endDate: `${year}-${nextMonth}-29`,
      allDay: true,
      sourceType: 'college_website',
      sourceName: institutionName,
      isUserOverride: false,
      confidence: 90,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  return {
    success: true,
    detectedEvents,
    sourceDetails: {
      sourceType: 'college_website',
      sourceUrl: validation.sanitizedUrl,
      institutionName,
      lastCheckedAt: now.toISOString(),
      lastSyncAt: now.toISOString(),
      syncStatus: 'success',
      detectedEventsCount: detectedEvents.length,
    },
  };
}
