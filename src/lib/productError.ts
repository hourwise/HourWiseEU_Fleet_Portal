export type ProductError = {
  message: string;
};

/** Keep database/provider details in diagnostics while showing bounded product copy. */
export function toProductError(error: unknown, fallback: string): ProductError {
  if (error instanceof Error) console.error(`[HourWise] ${fallback}`, error);
  return { message: fallback };
}
