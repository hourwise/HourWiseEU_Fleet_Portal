import { supabase } from './supabase';

export type PodReconciliationRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'partial' | 'failure';
  intents_scanned: number;
  intents_expired: number;
  storage_objects_removed: number;
  mismatch_count: number;
  failure_count: number;
  consecutive_failures: number;
};

export type PodReconciliationHealth = {
  lastAttemptedRun: PodReconciliationRun | null;
  lastSuccessfulRun: PodReconciliationRun | null;
  consecutiveFailures: number;
  maintenanceWarning: boolean;
  recentRuns: readonly PodReconciliationRun[];
};

export async function fetchPodReconciliationHealth(): Promise<PodReconciliationHealth> {
  const { data, error } = await supabase.rpc('get_pod_reconciliation_health');
  if (error || !data) throw new Error(error?.message || 'Unable to load POD reconciliation health.');
  const result = data as unknown as {
    last_attempted_run?: PodReconciliationRun | null;
    last_successful_run?: PodReconciliationRun | null;
    consecutive_failures?: number;
    maintenance_warning?: boolean;
    recent_runs?: readonly PodReconciliationRun[];
  };
  return {
    lastAttemptedRun: result.last_attempted_run ?? null,
    lastSuccessfulRun: result.last_successful_run ?? null,
    consecutiveFailures: result.consecutive_failures ?? 0,
    maintenanceWarning: result.maintenance_warning ?? false,
    recentRuns: result.recent_runs ?? [],
  };
}
