/** Provider-neutral seam for a future Atlas inference integration.
 *
 * Batch 13 deliberately does not implement this interface or make external
 * calls. The domain router returns a truthful `*_required` result instead.
 */
export type AtlasModelTier = 'SYNTHESIS' | 'STANDARD' | 'DEEP' | 'FALLBACK';

export type AtlasModelRequest = {
  question: string;
  reasoningPacket: unknown;
  tier: AtlasModelTier;
};

export type AtlasModelResponse = {
  text: string;
  proposedActions?: readonly unknown[];
};

export interface AtlasModelGateway {
  synthesize(request: AtlasModelRequest): Promise<AtlasModelResponse>;
  reason(request: AtlasModelRequest): Promise<AtlasModelResponse>;
  deepReason(request: AtlasModelRequest): Promise<AtlasModelResponse>;
}

export const ATLAS_MODEL_TIER_ORDER: readonly AtlasModelTier[] = ['SYNTHESIS', 'STANDARD', 'DEEP', 'FALLBACK'];
