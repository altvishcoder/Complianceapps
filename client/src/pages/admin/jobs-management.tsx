import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  RefreshCw, Clock, Play, CheckCircle, XCircle, 
  Pause, AlertTriangle, Calendar, Timer, Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScheduledJobInfo {
  name: string;
  cron: string;
  timezone: string;
  lastRun: string | null;
  nextRun: string | null;
  isActive: boolean;
  scheduleType: 'scheduled' | 'on-demand';
  description?: string;
  stateCounts: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
    retry: number;
    expired: number;
    cancelled: number;
  };
  recentJobs: Array<{
    id: string;
    state: string;
    createdOn: string;
    completedOn: string | null;
    startedOn?: string | null;
  }>;
}

function JobCard({ job, isSelected, onClick }: { job: ScheduledJobInfo; isSelected: boolean; onClick: () => void }) {
  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed': return <XCircle className="w-3 h-3 text-red-500" />;
      case 'active': return <Play className="w-3 h-3 text-blue-500" />;
      default: return <Pause className="w-3 h-3 text-gray-500" />;
    }
  };

  const recentStates = job.recentJobs.slice(0, 5);
  const { stateCounts } = job;

  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:bg-muted/50 hover:shadow-sm'}`}
      onClick={onClick}
      data-testid={`card-job-${job.name}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm">{job.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              {job.scheduleType === 'on-demand' ? (
                <Badge variant="outline" className="text-xs"><Zap className="w-3 h-3 mr-1" />On-Demand</Badge>
              ) : job.isActive ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">
                  <Calendar className="w-3 h-3 mr-1" />Scheduled
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Inactive</Badge>
              )}
            </div>
            
            {job.description && (
              <p className="text-xs text-muted-foreground mb-2">{job.description}</p>
            )}
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {job.scheduleType === 'scheduled' && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{job.cron}</span>
                </div>
              )}
              {job.lastRun && (
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  <span>Last: {new Date(job.lastRun).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              {recentStates.map((run) => (
                <div key={run.id} title={`${run.state} - ${new Date(run.createdOn).toLocaleString()}`}>
                  {getStateIcon(run.state)}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs justify-end">
              {stateCounts.pending > 0 && <span className="text-yellow-600">{stateCounts.pending} pending</span>}
              {stateCounts.active > 0 && <span className="text-blue-600">{stateCounts.active} active</span>}
              <span className="text-green-600">{stateCounts.completed} done</span>
              {stateCounts.failed > 0 && <span className="text-red-600">{stateCounts.failed} failed</span>}
              {stateCounts.retry > 0 && <span className="text-orange-600">{stateCounts.retry} retry</span>}
              {stateCounts.expired > 0 && <span className="text-gray-500">{stateCounts.expired} expired</span>}
              {stateCounts.cancelled > 0 && <span className="text-gray-500">{stateCounts.cancelled} cancelled</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobsManagement() {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: jobs = [], isLoading, refetch, isRefetching } = useQuery<ScheduledJobInfo[]>({
    queryKey: ['admin-scheduled-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/scheduled-jobs', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const scheduledJobs = jobs.filter(j => j.scheduleType === 'scheduled');
  const onDemandJobs = jobs.filter(j => j.scheduleType === 'on-demand');
  const selectedJobData = jobs.find(j => j.name === selectedJob);

  const totalPending = jobs.reduce((acc, j) => acc + (j.stateCounts?.pending || 0), 0);
  const totalActive = jobs.reduce((acc, j) => acc + (j.stateCounts?.active || 0), 0);
  const totalCompleted = jobs.reduce((acc, j) => acc + (j.stateCounts?.completed || 0), 0);
  const totalFailed = jobs.reduce((acc, j) => acc + (j.stateCounts?.failed || 0), 0);
  const totalRetry = jobs.reduce((acc, j) => acc + (j.stateCounts?.retry || 0), 0);

  const handleTriggerPatternAnalysis = async () => {
    try {
      const res = await fetch('/api/ml/pattern-analysis/trigger', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to trigger');
      toast({ title: 'Pattern Analysis Triggered', description: 'Job has been queued for execution' });
      refetch();
    } catch {
      toast({ title: 'Error', description: 'Failed to trigger pattern analysis', variant: 'destructive' });
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">
                Jobs Management
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Monitor and manage all background jobs powered by pg-boss
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isRefetching}
              data-testid="button-refresh-jobs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-queues">{jobs.length}</p>
                    <p className="text-xs text-muted-foreground">Total Queues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${totalPending > 0 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Pause className={`w-5 h-5 ${totalPending > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-pending-jobs">{totalPending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${totalActive > 0 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Play className={`w-5 h-5 ${totalActive > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-active-jobs">{totalActive}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-completed-jobs">{totalCompleted}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${totalFailed > 0 || totalRetry > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <AlertTriangle className={`w-5 h-5 ${totalFailed > 0 || totalRetry > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-failed-jobs">{totalFailed + totalRetry}</p>
                    <p className="text-xs text-muted-foreground">Failed/Retry</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Scheduled Jobs
                  </CardTitle>
                  <CardDescription>
                    Jobs that run on a cron schedule
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : scheduledJobs.length > 0 ? (
                    scheduledJobs.map(job => (
                      <JobCard 
                        key={job.name} 
                        job={job} 
                        isSelected={selectedJob === job.name}
                        onClick={() => setSelectedJob(selectedJob === job.name ? null : job.name)}
                      />
                    ))
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground">
                      No scheduled jobs found
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    On-Demand Jobs
                  </CardTitle>
                  <CardDescription>
                    Jobs triggered by user actions or system events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : onDemandJobs.length > 0 ? (
                    onDemandJobs.map(job => (
                      <JobCard 
                        key={job.name} 
                        job={job} 
                        isSelected={selectedJob === job.name}
                        onClick={() => setSelectedJob(selectedJob === job.name ? null : job.name)}
                      />
                    ))
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground">
                      No on-demand jobs found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Job Details</CardTitle>
                  <CardDescription>
                    {selectedJobData ? `Run history for ${selectedJobData.name}` : 'Select a job to view details'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedJobData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Schedule Type</p>
                          <p className="font-medium capitalize">{selectedJobData.scheduleType}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium">{selectedJobData.isActive ? 'Active' : 'Inactive'}</p>
                        </div>
                        {selectedJobData.scheduleType === 'scheduled' && (
                          <>
                            <div>
                              <p className="text-muted-foreground">Cron Expression</p>
                              <p className="font-mono text-xs">{selectedJobData.cron}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Timezone</p>
                              <p className="font-medium">{selectedJobData.timezone}</p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {selectedJobData.name === 'pattern-analysis' && (
                        <Button 
                          onClick={handleTriggerPatternAnalysis} 
                          size="sm" 
                          className="w-full"
                          data-testid="button-trigger-pattern-analysis"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Trigger Now
                        </Button>
                      )}
                      
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-3">Recent Runs ({selectedJobData.recentJobs.length})</p>
                        {selectedJobData.recentJobs.length > 0 ? (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {selectedJobData.recentJobs.map((run) => (
                              <div key={run.id} className="flex items-center justify-between text-sm border rounded-lg p-2">
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-muted-foreground">{run.id.slice(0, 8)}...</span>
                                  <span className="text-xs">
                                    {new Date(run.createdOn).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={run.state === 'completed' ? 'default' : run.state === 'failed' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {run.state}
                                  </Badge>
                                  {run.completedOn && run.startedOn && (
                                    <span className="text-xs text-muted-foreground">
                                      {((new Date(run.completedOn).getTime() - new Date(run.startedOn).getTime()) / 1000).toFixed(1)}s
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            No runs recorded yet
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      <div className="text-center">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Select a job to view its run history</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
