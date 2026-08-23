export const planningVehicleClasses = [
  "3_5t",
  "7_5t",
  "class_2",
  "class_1",
] as const;
export type PlanningVehicleClass = (typeof planningVehicleClasses)[number];

export const licenceEntitlements = ["B", "BE", "C1", "C1E", "C", "CE"] as const;
export type LicenceEntitlement = (typeof licenceEntitlements)[number];

export function planningVehicleClassLabel(
  value: PlanningVehicleClass | null | undefined,
): string {
  return value
    ? {
        "3_5t": "3.5t",
        "7_5t": "7.5t",
        class_2: "Class 2",
        class_1: "Class 1",
      }[value]
    : "Any vehicle type";
}

export function licenceEntitlementLabel(value: LicenceEntitlement): string {
  return { B: "B", BE: "B+E", C1: "C1", C1E: "C1+E", C: "C", CE: "CE" }[value];
}

export function entitlementCoversVehicleClass(
  entitlements: readonly LicenceEntitlement[],
  vehicleClass: PlanningVehicleClass | null | undefined,
): boolean {
  if (!vehicleClass) return true;
  const accepted: Record<PlanningVehicleClass, readonly LicenceEntitlement[]> =
    {
      "3_5t": licenceEntitlements,
      "7_5t": ["C1", "C1E", "C", "CE"],
      class_2: ["C", "CE"],
      class_1: ["CE"],
    };
  return entitlements.some((entry) => accepted[vehicleClass].includes(entry));
}

export function allowedPlanningClassesForAsset(
  assetClass: string | null | undefined,
): PlanningVehicleClass[] {
  if (assetClass === "van") return ["3_5t"];
  if (assetClass === "rigid") return ["7_5t", "class_2"];
  if (assetClass === "artic_unit") return ["class_1"];
  return [];
}
