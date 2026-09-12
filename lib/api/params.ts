import { ApiError } from "@/lib/api/withApi";

/** Reads a positive integer id out of a dynamic route segment. */
export async function routeId(
  params: Promise<{ id: string }> | Promise<Record<string, string>>,
  key = "id",
): Promise<number> {
  const resolved = (await params) as Record<string, string>;
  const value = Number(resolved[key]);
  if (!Number.isInteger(value) || value < 1) {
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid ${key} in path.`);
  }
  return value;
}
