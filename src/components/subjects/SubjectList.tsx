import React, { useState } from 'react';
import { Subject } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  Calculator,
  User,
  Award,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { calculateSubjectMarks } from '../../lib/marksCalculator';

interface SubjectListProps {
  subjects: Subject[];
  onAddSubject: () => void;
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string) => Promise<void>;
  onToggleArchive: (subject: Subject) => Promise<void>;
  onNavigateToMarks: (subjectId: string) => void;
  onLoadDemoData: () => void;
}

export function SubjectList({
  subjects,
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
  onToggleArchive,
  onNavigateToMarks,
  onLoadDemoData,
}: SubjectListProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'active' | 'archived' | 'all'>('active');
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const filtered = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      (s.instructor && s.instructor.toLowerCase().includes(search.toLowerCase()));

    if (filterMode === 'active') return matchesSearch && !s.isArchived;
    if (filterMode === 'archived') return matchesSearch && s.isArchived;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search subjects by name, code, instructor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-900 text-xs">
            <button
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterMode('archived')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                filterMode === 'archived'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Archived
            </button>
          </div>

          <Button variant="primary" size="sm" onClick={onAddSubject}>
            <Plus className="w-4 h-4 mr-1" />
            Add Subject
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {subjects.length === 0 ? 'No Subjects Added Yet' : 'No Matching Subjects'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {subjects.length === 0
                  ? 'Get started by creating your semester courses or load sample data for an instant demonstration.'
                  : 'Try adjusting your search query or switching between active and archived filters.'}
              </p>
            </div>
            {subjects.length === 0 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="primary" onClick={onAddSubject}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Your First Subject
                </Button>
                <Button variant="outline" onClick={onLoadDemoData}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-indigo-500" />
                  Load Demo Data
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* Subject Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((subject) => {
            const analysis = calculateSubjectMarks(
              subject.id,
              subject.name,
              subject.targetScore,
              subject.assessmentComponents || []
            );

            const difficultyLabels = ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

            return (
              <Card
                key={subject.id}
                hoverable
                className="flex flex-col justify-between overflow-hidden border-t-4"
                style={{ borderTopColor: subject.color }}
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {subject.code && (
                          <span className="text-xs font-mono font-semibold tracking-wider text-indigo-600 dark:text-indigo-400">
                            {subject.code}
                          </span>
                        )}
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-1">
                          {subject.name}
                        </CardTitle>
                      </div>
                      <Badge
                        variant={subject.difficulty >= 4 ? 'danger' : 'neutral'}
                        size="sm"
                      >
                        {difficultyLabels[subject.difficulty - 1]}
                      </Badge>
                    </div>

                    <CardDescription className="flex items-center gap-3 pt-1 text-xs">
                      {subject.instructor && (
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <User className="w-3.5 h-3.5" />
                          {subject.instructor}
                        </span>
                      )}
                      <span>{subject.credits} Credits</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-1 text-xs">
                    {/* Performance Metrics preview */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Target Score:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {subject.targetScore}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Current Score:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {analysis.currentWeightedScore}% / 100%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Max Achievable:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {analysis.maxAchievableScore}%
                        </span>
                      </div>
                    </div>

                    {/* Assessment Components Count */}
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        {subject.assessmentComponents?.length || 0} Assessments
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" />
                        Min. {subject.attendanceThreshold}% Attendance
                      </span>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToMarks(subject.id)}
                    className="text-xs"
                  >
                    <Calculator className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                    Calculator
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onToggleArchive(subject)}
                      title={subject.isArchived ? 'Restore Subject' : 'Archive Subject'}
                    >
                      {subject.isArchived ? (
                        <ArchiveRestore className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Archive className="w-4 h-4 text-slate-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditSubject(subject)}
                      title="Edit Subject"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSubjectToDelete(subject)}
                      title="Delete Subject"
                      className="hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSubjectToDelete(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl z-10 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Delete Subject?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">"{subjectToDelete.name}"</span>?
              This will remove associated attendance records, tasks, and marks from your local database.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSubjectToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await onDeleteSubject(subjectToDelete.id);
                  setSubjectToDelete(null);
                }}
              >
                Delete Subject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
