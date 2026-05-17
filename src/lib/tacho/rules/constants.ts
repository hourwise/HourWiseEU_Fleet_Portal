import type { TachoRuleCode } from './types';
import {
  TACHO_RULE_LIMITS as SHARED_TACHO_RULE_LIMITS,
  TACHO_RULE_TITLES as SHARED_TACHO_RULE_TITLES,
} from '../../../../shared/tachoRuleCore';

export const TACHO_RULE_LIMITS = SHARED_TACHO_RULE_LIMITS;

export const TACHO_RULE_TITLES: Record<TachoRuleCode, string> = SHARED_TACHO_RULE_TITLES;
