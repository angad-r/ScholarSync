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
  X,
  GraduationCap,
  Github,
  Linkedin,
} from 'lucide-react';
import { NavigationTab } from './Sidebar';
import { cn } from '../../lib/utils';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  semesterText: string;
  creatorName?: string;
  creatorGithubUrl?: string;
  creatorLinkedinUrl?: string;
}

export function MobileNav({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  semesterText,
  creatorName = 'Angad Ranjan',
  creatorGithubUrl = 'https://github.com/angad-r',
  creatorLinkedinUrl = 'https://in.linkedin.com/in/angad-ranjan-057616380',
}: MobileNavProps) {
  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">ScholarSync</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{semesterText}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Creator Links Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Creator</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{creatorName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={creatorGithubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                title={`${creatorName}'s GitHub Profile`}
                aria-label="GitHub Profile"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href={creatorLinkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-slate-500 hover:text-[#0a66c2] hover:bg-sky-50 dark:text-slate-400 dark:hover:text-[#0a66c2] dark:hover:bg-sky-950/40 transition-colors"
                title={`${creatorName}'s LinkedIn Profile`}
                aria-label="LinkedIn Profile"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
            <span>100% Local-First</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">IndexedDB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
