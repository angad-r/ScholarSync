import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Calculator,
  CheckSquare,
  ListTodo,
  CalendarClock,
  Clock,
  Calendar,
  BarChart3,
  Settings,
  GraduationCap,
  Sparkles,
  Github,
  Linkedin,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../common/Badge';

export type NavigationTab =
  | 'dashboard'
  | 'subjects'
  | 'marks'
  | 'attendance'
  | 'tasks'
  | 'studyPlanner'
  | 'timetable'
  | 'calendar'
  | 'analytics'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  semesterText: string;
  isDemoActive?: boolean;
  creatorName?: string;
  creatorGithubUrl?: string;
  creatorLinkedinUrl?: string;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  semesterText,
  isDemoActive = false,
  creatorName = 'Angad Ranjan',
  creatorGithubUrl = 'https://github.com/angad-r',
  creatorLinkedinUrl = 'https://in.linkedin.com/in/angad-ranjan-057616380',
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'marks', label: 'Marks Calculator', icon: Calculator },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'tasks', label: 'Tasks & Deadlines', icon: ListTodo },
    { id: 'studyPlanner', label: 'Study Planner', icon: CalendarClock },
    { id: 'timetable', label: 'Weekly Timetable', icon: Clock },
    { id: 'calendar', label: 'Academic Calendar', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings & Backup', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">ScholarSync</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              CSE
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Academic Planner</p>
        </div>
      </div>

      {/* Semester Context Badge */}
      <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Active Term:</span>
        <Badge variant="primary" size="sm">
          {semesterText}
        </Badge>
      </div>

      {isDemoActive && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Demo Mode Active</span>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left group',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 transition-transform group-hover:scale-110',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Creator & Links */}
      <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Creator</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{creatorName}</span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={creatorGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              title={`${creatorName}'s GitHub Profile`}
              aria-label="GitHub Profile"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href={creatorLinkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#0a66c2] hover:bg-sky-50 dark:text-slate-400 dark:hover:text-[#0a66c2] dark:hover:bg-sky-950/40 transition-colors"
              title={`${creatorName}'s LinkedIn Profile`}
              aria-label="LinkedIn Profile"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
          <span>100% Local-First</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Private DB
          </span>
        </div>
      </div>
    </aside>
  );
}
