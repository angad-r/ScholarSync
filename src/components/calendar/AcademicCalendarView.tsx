import React, { useState } from 'react';
import {
  AcademicEvent,
  AcademicEventType,
  Subject,
  CalendarSource,
  ScheduleChangeLog,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  Globe,
  Search,
  Filter,
  Trash2,
  Edit2,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  History,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';

interface AcademicCalendarViewProps {
  events: AcademicEvent[];
  subjects: Subject[];
  calendarSources: CalendarSource[];
  changeLogs: ScheduleChangeLog[];
  onAddOrEditEvent: (event: Partial<AcademicEvent>) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onOpenUploadModal: () => void;
  onOpenManageHolidaysModal: () => void;
  onOpenWebsiteSyncModal: () => void;
}

export function AcademicCalendarView({
  events,
  subjects,
  calendarSources,
  changeLogs,
  onAddOrEditEvent,
  onDeleteEvent,
  onOpenUploadModal,
  onOpenManageHolidaysModal,
  onOpenWebsiteSyncModal,
}: AcademicCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: Date; events: AcademicEvent[] } | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate });

  const filteredEvents = events
    .filter((ev) => {
      const matchesSearch =
        ev.title.toLowerCase().includes(search.toLowerCase()) ||
        (ev.description && ev.description.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (filterType === 'all') return true;
      if (filterType === 'holidays') return ev.eventType === 'official_holiday' || ev.eventType === 'user_holiday';
      if (filterType === 'exams') return ev.eventType === 'rescheduled_exam' || ev.eventType === 'postponed_exam';
      if (filterType === 'closures') return ev.eventType === 'college_closure' || ev.eventType === 'cancelled_lecture' || ev.eventType === 'cancelled_lab';
      if (filterType === 'deadlines') return ev.eventType === 'assignment_deadline' || ev.eventType === 'registration_deadline';
      if (filterType === 'overrides') return ev.isUserOverride;
      return true;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Distinct months containing academic events for quick navigation pills
  const monthsWithEvents = React.useMemo(() => {
    const map = new Map<string, { label: string; date: Date; count: number }>();
    for (const ev of events) {
      if (!ev.startDate) continue;
      const parts = ev.startDate.split('-').map(Number);
      if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;
      const key = `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        const d = new Date(parts[0], parts[1] - 1, 1);
        map.set(key, { label: format(d, 'MMM yyyy'), date: d, count: 1 });
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [events]);

  const getEventBadgeVariant = (type: AcademicEventType) => {
    switch (type) {
      case 'official_holiday':
      case 'user_holiday':
        return 'success';
      case 'rescheduled_exam':
      case 'postponed_exam':
        return 'danger';
      case 'college_closure':
      case 'cancelled_lecture':
      case 'cancelled_lab':
        return 'warning';
      case 'assignment_deadline':
      case 'registration_deadline':
        return 'warning';
      case 'college_event':
      case 'vacation_break':
        return 'purple';
      default:
        return 'neutral';
    }
  };

  const getEventBadgeColor = (type: AcademicEventType) => {
    switch (type) {
      case 'official_holiday':
      case 'user_holiday':
        return '#10b981'; // emerald
      case 'rescheduled_exam':
      case 'postponed_exam':
        return '#ef4444'; // red
      case 'college_closure':
      case 'cancelled_lecture':
      case 'cancelled_lab':
        return '#f59e0b'; // amber
      case 'college_event':
      case 'vacation_break':
        return '#8b5cf6'; // purple
      default:
        return '#6366f1'; // indigo
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Navigation & Month Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-900 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'agenda'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Agenda List
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={onOpenUploadModal} className="text-xs">
            <Upload className="w-3.5 h-3.5 mr-1 text-indigo-500" />
            Upload Calendar
          </Button>

          <Button variant="outline" size="sm" onClick={onOpenWebsiteSyncModal} className="text-xs">
            <Globe className="w-3.5 h-3.5 mr-1 text-indigo-500" />
            College Sync
          </Button>

          <Button variant="primary" size="sm" onClick={onOpenManageHolidaysModal} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Holiday / Change
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search calendar events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { label: 'All Events', id: 'all' },
            { label: 'Holidays', id: 'holidays' },
            { label: 'Examinations', id: 'exams' },
            { label: 'Closures / Changes', id: 'closures' },
            { label: 'Deadlines', id: 'deadlines' },
            { label: 'User Overrides', id: 'overrides' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterType === f.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Month Jumper (If academic events span across multiple months) */}
      {monthsWithEvents.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
            Months:
          </span>
          {monthsWithEvents.map((m) => {
            const isCurrentActive = isSameMonth(currentDate, m.date);
            return (
              <button
                key={m.label}
                onClick={() => setCurrentDate(m.date)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  isCurrentActive
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                }`}
              >
                <span>{m.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isCurrentActive
                      ? 'bg-indigo-700/80 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Calendar Views */}
      {viewMode === 'month' ? (
        <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 text-center font-bold text-xs uppercase tracking-wider py-2.5 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-rose-500">Sat</span>
            <span className="text-rose-500">Sun</span>
          </div>

          {/* Month Day Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 border-b border-slate-100 dark:border-slate-800">
            {daysInGrid.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDate = isToday(day);

              // Events occurring on this day
              const dayEvents = filteredEvents.filter(
                (e) => dayStr >= e.startDate && dayStr <= e.endDate
              );

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayEvents({ date: day, events: dayEvents })}
                  className={`min-h-[90px] sm:min-h-[110px] p-1.5 flex flex-col justify-between transition-colors cursor-pointer group ${
                    !isCurrentMonth
                      ? 'bg-slate-50/40 dark:bg-slate-950/40 text-slate-400'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  } ${isTodayDate ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                        isTodayDate
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Badges inside Day Cell */}
                  <div className="space-y-1 mt-1 overflow-hidden flex-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className="text-[10px] font-medium px-1 py-0.5 rounded truncate flex items-center gap-1"
                        style={{
                          backgroundColor: `${getEventBadgeColor(e.eventType)}18`,
                          color: getEventBadgeColor(e.eventType),
                        }}
                        title={e.title}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getEventBadgeColor(e.eventType) }}
                        />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-slate-400 font-semibold pl-1">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        /* Agenda / List View */
        <Card className="p-0 overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              Academic Calendar Agenda ({filteredEvents.length} Events)
            </CardTitle>
            <CardDescription>Chronological schedule of events, exams, closures, and holidays.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No events found matching your filter criteria.
              </div>
            ) : (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {ev.title}
                      </h4>
                      <Badge variant={getEventBadgeVariant(ev.eventType)} size="sm">
                        {ev.eventType.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {ev.isUserOverride && (
                        <Badge variant="neutral" size="sm" className="bg-sky-50 text-sky-700 border-sky-200">
                          User Override
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      <strong>Dates:</strong> {ev.startDate}
                      {ev.endDate !== ev.startDate && ` to ${ev.endDate}`}
                      {ev.startTime ? ` • ${ev.startTime} - ${ev.endTime}` : ''}
                      {ev.sourceName ? ` • Source: ${ev.sourceName}` : ''}
                    </p>

                    {ev.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteEvent(ev.id)}
                      title="Delete Event"
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Day Events Detail Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSelectedDayEvents(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl z-10 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {format(selectedDayEvents.date, 'EEEE, MMMM d, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5">
              {selectedDayEvents.events.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No academic calendar events or closures on this day.
                </p>
              ) : (
                selectedDayEvents.events.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {e.title}
                      </span>
                      <Badge variant={getEventBadgeVariant(e.eventType)} size="sm">
                        {e.eventType.replace('_', ' ')}
                      </Badge>
                    </div>
                    {e.description && <p className="text-slate-500">{e.description}</p>}
                    <p className="text-[11px] text-slate-400">
                      Source: {e.sourceName || 'Manual Entry'}
                      {e.isUserOverride && ' • User Override'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
