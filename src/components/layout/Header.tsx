import React, { useState } from 'react';
import {
  Bell,
  Sun,
  Moon,
  Menu,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Github,
  Linkedin,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { NavigationTab } from './Sidebar';
import { InAppNotification } from '../../types';
import { cn } from '../../lib/utils';

interface HeaderProps {
  currentTab: NavigationTab;
  onOpenMobileMenu: () => void;
  onQuickAction: (action: 'add_task' | 'add_subject' | 'load_demo') => void;
  notifications: InAppNotification[];
  onNotificationClick: (tab: NavigationTab) => void;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  hasSubjects: boolean;
  creatorName?: string;
  creatorGithubUrl?: string;
  creatorLinkedinUrl?: string;
}

const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Academic Dashboard',
    subtitle: 'Overview of attendance, weighted performance, upcoming deadlines & schedule',
  },
  subjects: {
    title: 'Subjects & Syllabus Structure',
    subtitle: 'Manage semester courses, credit weights, and evaluation schemes',
  },
  marks: {
    title: 'Academic Marks Calculator',
    subtitle: 'Transparent weighted scores, required grade simulator, and target projections',
  },
  attendance: {
    title: 'Attendance Tracker & Bunk Calculator',
    subtitle: 'Monitor attendance thresholds, calculate safe absences and recovery classes',
  },
  tasks: {
    title: 'Tasks & Assignment Manager',
    subtitle: 'Track assignments, lab reports, exams, priorities, and deadlines',
  },
  studyPlanner: {
    title: 'Smart Study Planner',
    subtitle: 'Deterministic workload scheduling respecting your daily time budget',
  },
  timetable: {
    title: 'Weekly Timetable & Conflict Detector',
    subtitle: 'Weekly lecture schedule with automatic time clash detection',
  },
  calendar: {
    title: 'Academic Calendar & Holidays',
    subtitle: 'Import calendars, track official holidays, exam dates & college website updates',
  },
  analytics: {
    title: 'Performance Analytics',
    subtitle: 'Visual data trends on marks, attendance, and study hours',
  },
  settings: {
    title: 'Settings & Data Backup',
    subtitle: 'Local data persistence, JSON export/import, CSV reports, and demo data',
  },
};

export function Header({
  currentTab,
  onOpenMobileMenu,
  onQuickAction,
  notifications,
  onNotificationClick,
  theme,
  onToggleTheme,
  hasSubjects,
  creatorName = 'Angad Ranjan',
  creatorGithubUrl = 'https://github.com/angad-r',
  creatorLinkedinUrl = 'https://in.linkedin.com/in/angad-ranjan-057616380',
}: HeaderProps) {
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const info = TAB_TITLES[currentTab];
  const unreadCount = notifications.length;

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {info.title}
          </h1>
          <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
            {info.subtitle}
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {!hasSubjects && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onQuickAction('load_demo')}
            className="hidden sm:inline-flex text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-500" />
            Load Demo Data
          </Button>
        )}

        {hasSubjects && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onQuickAction('add_task')}
            className="hidden sm:inline-flex"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationPanel(!showNotificationPanel)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotificationPanel && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotificationPanel(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200 p-4 dark:bg-slate-900 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      Alerts & Reminders
                    </h3>
                    <Badge variant={unreadCount > 0 ? 'warning' : 'neutral'} size="sm">
                      {unreadCount} active
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-400">In-App Engine</span>
                </div>

                <div className="py-2 max-h-80 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/70 mb-2" />
                      All clear! No overdue tasks or critical attendance alerts.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const icon =
                        n.type === 'alert' ? (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        ) : n.type === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        );

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            setShowNotificationPanel(false);
                            if (n.linkTab) onNotificationClick(n.linkTab as NavigationTab);
                          }}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                          {icon}
                          <div className="flex-1 text-left">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {n.message}
                            </p>
                          </div>
                          {n.linkTab && <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle dark/light theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Creator Profile Links */}
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2 ml-1">
          <a
            href={creatorGithubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            title={`${creatorName}'s GitHub Profile`}
            aria-label={`${creatorName}'s GitHub Profile`}
          >
            <Github className="w-4 h-4" />
          </a>
          <a
            href={creatorLinkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-slate-500 hover:text-[#0a66c2] hover:bg-sky-50 dark:text-slate-400 dark:hover:text-[#0a66c2] dark:hover:bg-sky-950/40 transition-colors"
            title={`${creatorName}'s LinkedIn Profile`}
            aria-label={`${creatorName}'s LinkedIn Profile`}
          >
            <Linkedin className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
