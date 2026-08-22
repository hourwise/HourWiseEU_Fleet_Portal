import { supabase } from './supabase';

export type JobEvidenceType = 'pod' | 'delivery_note' | 'failed_delivery' | 'unable_to_complete' | 'damage' | 'other';
export type JobEvidenceOutcome = 'delivered' | 'failed_delivery' | 'unable_to_complete' | 'unknown';
export type JobEvidenceReviewStatus = 'pending' | 'accepted' | 'rejected' | 'needs_follow_up';

export type JobEvidenceRecord = {
  id: string;
  company_id: string;
  job_id: string;
  job_assignment_id: string;
  evidence_type: JobEvidenceType;
  outcome: JobEvidenceOutcome;
  storage_bucket: 'pod-evidence';
  storage_path: string;
  source: 'portal_upload' | 'mobile_camera' | 'mobile_file';
  uploaded_by: string;
  uploaded_at: string;
  review_status: JobEvidenceReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  updated_at: string;
};

export type PodReviewQueueItem = {
  id: string;
  job_id: string;
  job_reference: string;
  job_title: string;
  job_assignment_id: string;
  assignment_status: string;
  evidence_type: JobEvidenceType;
  outcome: JobEvidenceOutcome;
  source: JobEvidenceRecord['source'];
  uploaded_at: string;
  uploader_role: string | null;
  uploader_label: string;
  review_status: JobEvidenceReviewStatus;
  reviewed_at: string | null;
  reviewed_by_label: string | null;
  review_notes: string | null;
  updated_at: string;
};

export type GovernedPodReviewResult = {
  outcome: 'reviewed' | 'already_reviewed' | 'stale' | 'permission_denied' | 'invalid_state';
  reason?: string;
  evidence?: Pick<JobEvidenceRecord, 'id' | 'review_status' | 'reviewed_at' | 'review_notes' | 'updated_at'>;
};

export type JobEvidenceUploadIntent = {
  id: string;
  company_id: string;
  job_id: string;
  job_assignment_id: string;
  storage_bucket: 'pod-evidence';
  storage_path: string;
  status: 'pending';
};

export async function fetchJobEvidence(jobAssignmentId: string): Promise<JobEvidenceRecord[]> {
  const { data, error } = await supabase.from('job_evidence').select('*').eq('job_assignment_id', jobAssignmentId).order('uploaded_at', { ascending: false });
  if (error) throw new Error(error.message || 'Unable to load job evidence.');
  return (data ?? []) as JobEvidenceRecord[];
}

export async function uploadJobEvidence(input: { assignmentId: string; file: File; evidenceType: JobEvidenceType; outcome: JobEvidenceOutcome; source?: 'portal_upload' | 'mobile_camera' | 'mobile_file' }) {
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: JobEvidenceRecord | null; error: { message: string } | null }>;
  const { data: intentData, error: intentError } = await rpc('begin_job_evidence_upload', { p_job_assignment_id: input.assignmentId, p_original_file_name: input.file.name });
  if (intentError || !intentData) throw new Error(intentError?.message || 'Unable to create a governed evidence upload intent.');
  const intent = intentData as unknown as JobEvidenceUploadIntent;
  const cleanup = async (reason: string) => {
    const { error } = await rpc('cleanup_failed_job_evidence_upload', { p_upload_intent_id: intent.id, p_reason: reason });
    if (error) throw new Error(error.message || 'Upload cleanup was not confirmed.');
  };
  try {
    const { error: uploadError } = await supabase.storage.from('pod-evidence').upload(intent.storage_path, input.file, { upsert: false, contentType: input.file.type || undefined });
    if (uploadError) {
      await cleanup(`storage upload failed: ${uploadError.message}`);
      throw new Error(uploadError.message || 'Unable to upload evidence file.');
    }
    const { data, error } = await rpc('finalize_job_evidence_upload', { p_upload_intent_id: intent.id, p_evidence_type: input.evidenceType, p_outcome: input.outcome, p_source: input.source ?? 'portal_upload', p_metadata: { file_name: input.file.name, content_type: input.file.type || null, size_bytes: input.file.size } });
    if (error || !data) {
      await cleanup(`evidence registration failed: ${error?.message ?? 'empty registration response'}`);
      throw new Error(error?.message || 'Unable to record job evidence.');
    }
    return data;
  } catch (error) {
    if (error instanceof Error && /cleanup was not confirmed/i.test(error.message)) throw error;
    throw error;
  }
}

export async function reviewJobEvidence(input: { evidenceId: string; reviewStatus: Exclude<JobEvidenceReviewStatus, 'pending'>; reviewNotes?: string | null; expectedUpdatedAt?: string | null }) {
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: GovernedPodReviewResult | null; error: { message: string } | null }>;
  const { data, error } = await rpc('review_job_evidence_governed', { p_evidence_id: input.evidenceId, p_review_status: input.reviewStatus, p_review_notes: input.reviewNotes ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null });
  if (error) throw new Error(error.message || 'Unable to review job evidence.');
  return data;
}

export async function fetchManagerPodReviewQueue(input: { reviewStatus?: JobEvidenceReviewStatus | 'all'; jobId?: string; from?: string; to?: string; limit?: number } = {}): Promise<PodReviewQueueItem[]> {
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: PodReviewQueueItem[] | null; error: { message: string } | null }>;
  const { data, error } = await rpc('list_manager_pod_review_queue', {
    p_review_status: input.reviewStatus && input.reviewStatus !== 'all' ? input.reviewStatus : null,
    p_job_id: input.jobId || null,
    p_from: input.from || null,
    p_to: input.to || null,
    p_limit: input.limit ?? 100,
  });
  if (error) throw new Error(error.message || 'Unable to load the manager POD review queue.');
  return parsePodReviewQueueResponse(data);
}

export function parsePodReviewQueueResponse(data: unknown): PodReviewQueueItem[] {
  if (!Array.isArray(data)) return [];
  const items = data.filter(isPodReviewQueueItem);
  if (items.length !== data.length) throw new Error('POD review queue response was incomplete.');
  return items;
}

function isPodReviewQueueItem(value: unknown): value is PodReviewQueueItem {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.job_id === 'string'
    && typeof value.job_reference === 'string'
    && typeof value.job_title === 'string'
    && typeof value.job_assignment_id === 'string'
    && typeof value.assignment_status === 'string'
    && typeof value.evidence_type === 'string'
    && typeof value.outcome === 'string'
    && typeof value.source === 'string'
    && typeof value.uploaded_at === 'string'
    && (value.uploader_role === null || typeof value.uploader_role === 'string')
    && typeof value.uploader_label === 'string'
    && typeof value.review_status === 'string'
    && (value.reviewed_at === null || typeof value.reviewed_at === 'string')
    && (value.reviewed_by_label === null || typeof value.reviewed_by_label === 'string')
    && (value.review_notes === null || typeof value.review_notes === 'string')
    && typeof value.updated_at === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function openJobEvidenceView(evidenceId: string): Promise<string> {
  const { data, error } = await supabase.from('job_evidence').select('storage_bucket, storage_path').eq('id', evidenceId).maybeSingle();
  if (error || !data || data.storage_bucket !== 'pod-evidence') throw new Error(error?.message || 'Evidence view is unavailable.');
  const { data: signed, error: signedError } = await supabase.storage.from('pod-evidence').createSignedUrl(data.storage_path, 60);
  if (signedError || !signed?.signedUrl) throw new Error(signedError?.message || 'Unable to create a protected evidence view.');
  return signed.signedUrl;
}
