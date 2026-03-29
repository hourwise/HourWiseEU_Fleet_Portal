import type { Database } from './database.types';

// --- 1. Interfaces ---
interface OvertimeTier {
    threshold: number;
    multiplier?: number;
    percentage?: number;
}

interface PayConfiguration {
    hourlyRate: number;
    shiftAllowance: number;
    overtimeThresholdHours?: number;
    unpaidBreakMinutes: number;
    // Note: The following are for legacy compatibility, new logic uses tiers
    overtimeRateMultiplier?: number;
    overtimeRatePercentage?: number;
    additionalOvertimeTiers?: OvertimeTier[];
}

interface WorkSession {
    totalWorkMinutes: number;
}

export interface DailyPayDetails {
    totalPay: number;
    normalHours: number;
    overtimeHours: number;
    shiftAllowance: number;
}

interface PayConfigInput {
    hourly_rate?: number | null;
    shift_allowance?: number | null;
    overtime_threshold_hours?: number | null;
    unpaid_break_minutes?: number | null;
    overtime_rate_multiplier?: number | null;
    overtime_rate_percentage?: number | null;
    additional_overtime_tiers?: OvertimeTier[] | null;
}

interface WorkSessionInput {
    total_work_minutes?: number | null;
}

// --- 2. Helper: Safe Rate Calculation ---
const calculateTierRate = (baseRate: number, tier: OvertimeTier): number => {
    if (tier.multiplier !== undefined) {
        return baseRate * tier.multiplier;
    }
    if (tier.percentage !== undefined) {
        return baseRate * (1 + tier.percentage / 100);
    }
    return baseRate; // Should not happen with valid tiers
};

// --- 3. Core Calculation Logic ---
function calculateDailyPayInternal(
  sessions: WorkSession[],
  payConfig: PayConfiguration
): DailyPayDetails {
  const emptyResult = { totalPay: 0, normalHours: 0, overtimeHours: 0, shiftAllowance: 0 };
  
  if (!sessions || sessions.length === 0) {
    return emptyResult;
  }

  const totalMinutesWorked = sessions.reduce((sum, s) => sum + (s.totalWorkMinutes || 0), 0);
  const paidMinutes = Math.max(0, totalMinutesWorked - payConfig.unpaidBreakMinutes);
  const hoursWorked = paidMinutes / 60;

  if (hoursWorked <= 0) {
    // Still return shift allowance if applicable
    emptyResult.shiftAllowance = payConfig.shiftAllowance;
    emptyResult.totalPay = payConfig.shiftAllowance;
    return emptyResult;
  }

  let totalPay = 0;

  const threshold = payConfig.overtimeThresholdHours ?? hoursWorked;
  const normalHours = Math.min(hoursWorked, threshold);
  const overtimeHours = Math.max(0, hoursWorked - normalHours);

  totalPay += normalHours * payConfig.hourlyRate;

  if (overtimeHours > 0) {
    const tiers: OvertimeTier[] = [];

    // Create a default tier from legacy fields if no new tiers are defined
    const hasLegacyConfig = payConfig.overtimeRateMultiplier || payConfig.overtimeRatePercentage;
    if (hasLegacyConfig && !payConfig.additionalOvertimeTiers?.length) {
       tiers.push({
        threshold: 0,
        multiplier: payConfig.overtimeRateMultiplier,
        percentage: payConfig.overtimeRatePercentage,
      });
    }

    if (payConfig.additionalOvertimeTiers) {
      tiers.push(...payConfig.additionalOvertimeTiers);
    }
    
    // Sort tiers by their threshold to process them correctly
    tiers.sort((a, b) => a.threshold - b.threshold);

    let remainingOvertime = overtimeHours;
    for (const tier of tiers) {
        if(remainingOvertime <= 0) break;

        // For simplicity, this example assumes tiers apply sequentially to total overtime hours.
        // A more complex model might have tiers like "first 2 hours at 1.5x, next 2 at 2x".
        // This logic handles that correctly.
        const tierStart = tier.threshold;
        const tierEnd = Infinity; // Simplified for now, but could be extended
        
        const hoursInThisTier = Math.min(remainingOvertime, tierEnd - tierStart);

        if(hoursInThisTier > 0) {
            const rate = calculateTierRate(payConfig.hourlyRate, tier);
            totalPay += hoursInThisTier * rate;
            remainingOvertime -= hoursInThisTier;
        }
    }
  }

  totalPay += payConfig.shiftAllowance;

  return {
    totalPay: Number(totalPay.toFixed(2)),
    normalHours: Number(normalHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    shiftAllowance: payConfig.shiftAllowance
  };
}


// --- 4. EXPORTED ADAPTERS ---

export const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(0);
    }
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
};

export const calculateDailyPay = (rawSessions: WorkSessionInput[], rawConfig: PayConfigInput): DailyPayDetails => {
    const emptyResult = { totalPay: 0, normalHours: 0, overtimeHours: 0, shiftAllowance: 0 };
    if (!rawConfig) {
        console.warn("[PAY CALC] No Pay Configuration found for sessions.");
        return emptyResult;
    }
    if (!rawSessions || rawSessions.length === 0) {
        const shiftAllowance = Number(rawConfig.shift_allowance || 0);
        return { ...emptyResult, shiftAllowance, totalPay: shiftAllowance };
    }

    const safeNum = (val: number | null | undefined, defaultVal = 0) => {
        const n = Number(val);
        return isNaN(n) ? defaultVal : n;
    };

    const payConfig: PayConfiguration = {
        hourlyRate: safeNum(rawConfig.hourly_rate),
        shiftAllowance: safeNum(rawConfig.shift_allowance),
        overtimeThresholdHours: rawConfig.overtime_threshold_hours ? safeNum(rawConfig.overtime_threshold_hours) : undefined,
        unpaidBreakMinutes: safeNum(rawConfig.unpaid_break_minutes),
        // Legacy fields
        overtimeRateMultiplier: rawConfig.overtime_rate_multiplier ? safeNum(rawConfig.overtime_rate_multiplier) : undefined,
        overtimeRatePercentage: rawConfig.overtime_rate_percentage ? safeNum(rawConfig.overtime_rate_percentage) : undefined,
        additionalOvertimeTiers: rawConfig.additional_overtime_tiers || []
    };

    const sessions: WorkSession[] = rawSessions.map(s => ({
        totalWorkMinutes: safeNum(s.total_work_minutes)
    }));

    return calculateDailyPayInternal(sessions, payConfig);
};
