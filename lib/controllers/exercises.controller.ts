import { z } from "zod";
import { ApiError } from "@/lib/api/withApi";
import type { Session } from "@/lib/auth/guard";
import { sql } from "@/lib/db";

export const PAGE_SIZE = 20;

export const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  muscleGroup: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  muscleGroup: z.string().trim().min(2).max(40),
  equipment: z.string().trim().max(40).nullish(),
  isPublic: z.boolean().default(true),
});

export const updateSchema = createSchema.partial();

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  isPublic: boolean;
  createdBy: number | null;
  createdByName: string | null;
};

type Row = {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string | null;
  is_public: boolean;
  created_by: number | null;
  created_by_name: string | null;
};

const toExercise = (row: Row): Exercise => ({
  id: row.id,
  name: row.name,
  muscleGroup: row.muscle_group,
  equipment: row.equipment,
  isPublic: row.is_public,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
});

export async function list(query: z.infer<typeof listQuerySchema>) {
  const search = query.search?.length ? query.search : null;
  const muscleGroup = query.muscleGroup?.length ? query.muscleGroup : null;
  const offset = (query.page - 1) * PAGE_SIZE;

  const rows = await sql<(Row & { total: string })[]>`
    select e.id, e.name, e.muscle_group, e.equipment, e.is_public, e.created_by,
           u.full_name as created_by_name,
           count(*) over () as total
    from exercises e
    left join users u on u.id = e.created_by
    where (${search}::text is null or e.name ilike '%' || ${search}::text || '%')
      and (${muscleGroup}::text is null or e.muscle_group = ${muscleGroup}::text)
    order by e.muscle_group, e.name
    limit ${PAGE_SIZE} offset ${offset}`;

  return {
    data: rows.map(toExercise),
    meta: { page: query.page, pageSize: PAGE_SIZE, total: rows[0] ? Number(rows[0].total) : 0 },
  };
}

export async function get(id: number): Promise<Exercise> {
  const [row] = await sql<Row[]>`
    select e.id, e.name, e.muscle_group, e.equipment, e.is_public, e.created_by,
           u.full_name as created_by_name
    from exercises e
    left join users u on u.id = e.created_by
    where e.id = ${id}`;
  if (!row) throw new ApiError(404, "NOT_FOUND", "Exercise not found.");
  return toExercise(row);
}

export async function create(
  session: Session,
  input: z.infer<typeof createSchema>,
): Promise<Exercise> {
  const [existing] = await sql<{ id: number }[]>`
    select id from exercises where name = ${input.name} and created_by = ${session.userId}`;
  if (existing) {
    throw new ApiError(409, "CONFLICT", "You already created an exercise with that name.");
  }

  const [row] = await sql<{ id: number }[]>`
    insert into exercises (name, muscle_group, equipment, is_public, created_by)
    values (${input.name}, ${input.muscleGroup}, ${input.equipment ?? null},
            ${input.isPublic}, ${session.userId})
    returning id`;
  return get(row.id);
}

export async function update(
  session: Session,
  id: number,
  input: z.infer<typeof updateSchema>,
): Promise<Exercise> {
  const current = await get(id);
  // A trainer may only edit what they created; an admin may edit anything.
  if (session.role !== "ADMIN" && current.createdBy !== session.userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only edit exercises you created.");
  }

  await sql`
    update exercises set
      name         = ${input.name ?? current.name},
      muscle_group = ${input.muscleGroup ?? current.muscleGroup},
      equipment    = ${input.equipment === undefined ? current.equipment : input.equipment},
      is_public    = ${input.isPublic ?? current.isPublic}
    where id = ${id}`;
  return get(id);
}

export async function remove(id: number): Promise<void> {
  await get(id);
  try {
    await sql`delete from exercises where id = ${id}`;
  } catch (err) {
    // 23503: still referenced by logged sets or plan rows, which we will not destroy.
    if ((err as { code?: string }).code === "23503") {
      throw new ApiError(
        409,
        "CONFLICT",
        "This exercise is used by existing workouts or plans and cannot be deleted.",
      );
    }
    throw err;
  }
}

export async function muscleGroups(): Promise<string[]> {
  const rows = await sql<{ muscle_group: string }[]>`
    select distinct muscle_group from exercises order by muscle_group`;
  return rows.map((row) => row.muscle_group);
}
