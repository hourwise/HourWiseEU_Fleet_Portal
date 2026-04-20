-- ============================================================
-- Fuel & Mileage Tracker
-- NOTE: fuel_logs table + RLS was created separately via the
--       app SQL panel. This migration only adds the remaining
--       companies column needed for the company bulk price card.
-- ============================================================

-- Add default bulk fuel cost per litre to companies table.
-- Managers update this whenever their delivery price changes.
-- NULL = no default set (portal shows "Not set").
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS default_fuel_cost_per_litre numeric(6,3);
