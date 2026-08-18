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

export async function fetchJobEvidence(jobAssignmentId: string): Promise<JobEvidenceRecord[]> {
  const { data, error } = await supabase.from('job_evidence').select('*').eq('job_assignment_id', jobAssignmentId).order('uploaded_at', { ascending: false });
  if (error) throw new Error(error.message || 'Unable to load job evidence.');
  return (data ?? []) as JobEvidenceRecord[];
}

export async function uploadJobEvidence(input: { assignmentId: string; file: File; evidenceType: JobEvidenceType; outcome: JobEvidenceOutcome; source?: 'portal_upload' | 'mobile_camera' | 'mobile_file' }) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) throw new Error('You must be signed in to upload evidence.');
  const companyId = (await supabase.from('profiles').select('company_id').eq('id', userResult.user.id).maybeSingle()).data?.company_id;
  if (!companyId) throw new Error('Company context is unavailable.');
  const safeName = input.file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-120) || 'evidence';
  const path = `${companyId}/${input.assignmentId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('pod-evidence').upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
  if (uploadError) throw new Error(uploadError.message || 'Unable to upload evidence file.');
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: JobEvidenceRecord | null; error: { message: string } | null }>;
  const { data, error } = await rpc('create_job_evidence', { p_job_assignment_id: input.assignmentId, p_evidence_type: input.evidenceType, p_outcome: input.outcome, p_storage_path: path, p_source: input.source ?? 'portal_upload', p_metadata: { file_name: input.file.name, content_type: input.file.type || null, size_bytes: input.file.size } });
  if (error) throw new Error(error.message || 'Unable to record job evidence.');
  return data;
}

export async function reviewJobEvidence(input: { evidenceId: string; reviewStatus: Exclude<JobEvidenceReviewStatus, 'pending'>; reviewNotes?: string | null; expectedUpdatedAt?: string | null }) {
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: JobEvidenceRecord | null; error: { message: string } | null }>;
  const { data, error } = await rpc('review_job_evidence', { p_evidence_id: input.evidenceId, p_review_status: input.reviewStatus, p_review_notes: input.reviewNotes ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null });
  if (error) throw new Error(error.message || 'Unable to review job evidence.');
  return data;
}
