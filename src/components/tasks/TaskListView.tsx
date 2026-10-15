import React, { useState } from 'react';
import { Task, Subject, TaskStatus, Priority } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  ListTodo,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
} from 'lucide-react';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';

interface TaskListViewProps {
  tasks: Task[];
  subjects: Subject[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (task: Task) => Promise<void>;
}

export function TaskListView({
  tasks,
  subjects,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTaskStatus,
}: TaskListViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'time'>('dueDate');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());

    const matchesSubject = subjectFilter === 'all' || t.subjectId === subjectFilter;

    const dueDate = parseISO(t.dueDate);
    const isOverdue = isPast(dueDate) && !isToday(dueDate) && t.status !== 'completed';

    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = t.status === 'pending';
    else if (statusFilter === 'in_progress') matchesStatus = t.status === 'in_progress';
    else if (statusFilter === 'completed') matchesStatus = t.status === 'completed';
    else if (statusFilter === 'overdue') matchesStatus = isOverdue;

    return matchesSearch && matchesSubject && matchesStatus;
  });

  // Sorting
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'dueDate') {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sortBy === 'priority') {
      const pWeights: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
      return pWeights[b.priority] - pWeights[a.priority];
    }
    if (sortBy === 'time') {
      return b.estimatedMinutes - a.estimatedMinutes;
    }
    return 0;
  });

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'high':
        return <Badge variant="danger" size="sm">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning" size="sm">Med Priority</Badge>;
      case 'low':
        return <Badge variant="neutral" size="sm">Low Priority</Badge>;
    }
  };

  const getDueBadge = (dueDateStr: string, status: TaskStatus) => {
    if (status === 'completed') {
      return <Badge variant="success" size="sm">Done</Badge>;
    }
    const date = parseISO(dueDateStr);
    const diff = differenceInDays(date, new Date());

    if (isToday(date)) {
      return <Badge variant="warning" size="sm">Due Today</Badge>;
    }
    if (isPast(date)) {
      return <Badge variant="danger" size="sm">Overdue</Badge>;
    }
    if (diff === 1) {
      return <Badge variant="warning" size="sm">Due Tomorrow</Badge>;
    }
    if (diff <= 7) {
      return <Badge variant="primary" size="sm">{diff}d left</Badge>;
    }
    return <span className="text-xs text-slate-500">{dueDateStr}</span>;
  };

  return (
    <div className="space-y-5">
      {/* Search, Filter, Sort Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code || s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-900 text-xs">
            {(['all', 'pending', 'in_progress', 'completed', 'overdue'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setStatusFilter(mode)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-all ${
                  statusFilter === mode
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="time">Sort by Duration</option>
          </select>

          <Button variant="primary" size="sm" onClick={onAddTask}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Task List Content */}
      {sortedTasks.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <ListTodo className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            {tasks.length === 0 ? 'No Tasks Created Yet' : 'No Tasks Matching Criteria'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {tasks.length === 0
              ? 'Stay ahead of your semester by adding assignments, project deadlines, and quiz prep.'
              : 'Try clearing your search query or switching filters.'}
          </p>
          {tasks.length === 0 && (
            <Button variant="primary" className="mt-4" onClick={onAddTask}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Task
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const subject = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
            const completedSubtasks = task.subtasks?.filter((s) => s.isCompleted).length || 0;
            const totalSubtasks = task.subtasks?.length || 0;

            return (
              <Card
                key={task.id}
                hoverable
                className={`p-4 transition-all border-l-4 ${
                  task.status === 'completed'
                    ? 'border-l-emerald-500 opacity-75'
                    : task.priority === 'high'
                    ? 'border-l-rose-500'
                    : 'border-l-indigo-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Quick Complete Toggle Button */}
                    <button
                      onClick={() => onToggleTaskStatus(task)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      aria-label="Toggle task completion"
                    >
                      {task.status === 'completed' ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`font-semibold text-sm ${
                            task.status === 'completed'
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </h4>
                        {subject && (
                          <Badge
                            variant="neutral"
                            size="sm"
                            className="text-[10px]"
                            style={{ borderLeftColor: subject.color, borderLeftWidth: '3px' }}
                          >
                            {subject.code || subject.name}
                          </Badge>
                        )}
                        {getPriorityBadge(task.priority)}
                        {getDueBadge(task.dueDate, task.status)}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Est: {task.estimatedMinutes}m
                        </span>
                        {totalSubtasks > 0 && (
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            {completedSubtasks}/{totalSubtasks} subtasks
                          </span>
                        )}
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {task.completionPercentage}% Done
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditTask(task)}
                      title="Edit Task"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteTask(task.id)}
                      title="Delete Task"
                      className="hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
