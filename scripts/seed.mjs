import bcrypt from "bcryptjs";
import postgres from "postgres";

const DEMO_PASSWORD = "Password123!";

if (!process.env.DIRECT_URL) {
  console.error("DIRECT_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL, {
  ssl: "require",
  max: 1,
  onnotice: () => {},
});

// Deterministic PRNG: `db:reset` produces the same dataset every run, so the
// documentation screenshots stay reproducible.
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260912);
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const toStep = (value, step) => Math.round(value / step) * step;
const pad = (n) => String(n).padStart(2, "0");

const PEOPLE = [
  { email: "admin@gymtracker.local", fullName: "Ana Adamovic", role: "ADMIN" },
  { email: "trainer1@gymtracker.local", fullName: "Marko Ilic", role: "TRAINER" },
  { email: "trainer2@gymtracker.local", fullName: "Ivana Peric", role: "TRAINER" },
  { email: "member1@gymtracker.local", fullName: "Nikola Jovanovic", role: "MEMBER" },
  { email: "member2@gymtracker.local", fullName: "Jelena Kostic", role: "MEMBER" },
  { email: "member3@gymtracker.local", fullName: "Stefan Mitrovic", role: "MEMBER" },
  { email: "member4@gymtracker.local", fullName: "Milica Radovanovic", role: "MEMBER" },
  { email: "member5@gymtracker.local", fullName: "Dusan Pavlovic", role: "MEMBER" },
];

// name, muscle group, equipment, starting working weight in kg (0 = bodyweight)
const EXERCISES = [
  ["Bench Press", "Chest", "Barbell", 60],
  ["Incline Dumbbell Press", "Chest", "Dumbbell", 22.5],
  ["Cable Fly", "Chest", "Cable", 15],
  ["Push-Up", "Chest", "Bodyweight", 0],
  ["Deadlift", "Back", "Barbell", 90],
  ["Barbell Row", "Back", "Barbell", 55],
  ["Pull-Up", "Back", "Bodyweight", 0],
  ["Lat Pulldown", "Back", "Cable", 45],
  ["Seated Cable Row", "Back", "Cable", 45],
  ["Back Squat", "Legs", "Barbell", 80],
  ["Front Squat", "Legs", "Barbell", 55],
  ["Romanian Deadlift", "Legs", "Barbell", 65],
  ["Leg Press", "Legs", "Machine", 110],
  ["Leg Curl", "Legs", "Machine", 35],
  ["Walking Lunge", "Legs", "Dumbbell", 16],
  ["Calf Raise", "Legs", "Machine", 60],
  ["Overhead Press", "Shoulders", "Barbell", 35],
  ["Lateral Raise", "Shoulders", "Dumbbell", 10],
  ["Face Pull", "Shoulders", "Cable", 20],
  ["Arnold Press", "Shoulders", "Dumbbell", 14],
  ["Barbell Curl", "Arms", "Barbell", 25],
  ["Hammer Curl", "Arms", "Dumbbell", 12],
  ["Triceps Pushdown", "Arms", "Cable", 25],
  ["Skull Crusher", "Arms", "Barbell", 22.5],
  ["Plank", "Core", "Bodyweight", 0],
  ["Hanging Leg Raise", "Core", "Bodyweight", 0],
];

const SESSION_TEMPLATES = [
  { notes: "Push day", exercises: ["Bench Press", "Overhead Press", "Triceps Pushdown"] },
  { notes: "Pull day", exercises: ["Deadlift", "Barbell Row", "Barbell Curl"] },
  { notes: "Leg day", exercises: ["Back Squat", "Romanian Deadlift", "Leg Press"] },
];

// Sessions logged per member, member1 first.
const SESSIONS_PER_MEMBER = [18, 10, 6, 4, 2];

/** Evenly spaced "days ago" values, oldest first, inside a 90-day window. */
function daysAgoSeries(count) {
  return Array.from({ length: count }, (_, i) =>
    Math.round(89 - (count === 1 ? 0.5 : i / (count - 1)) * 87),
  );
}

async function main() {
  const passwordHashes = await Promise.all(PEOPLE.map(() => bcrypt.hash(DEMO_PASSWORD, 10)));

  await sql.begin(async (tx) => {
    await tx`truncate table workout_sets, workouts, plan_exercises, workout_plans,
             goals, profiles, exercises, users restart identity cascade`;

    const users = await tx`
      insert into users ${tx(
        PEOPLE.map((person, i) => ({
          email: person.email,
          password_hash: passwordHashes[i],
          full_name: person.fullName,
          role: person.role,
        })),
        "email",
        "password_hash",
        "full_name",
        "role",
      )} returning id, email, role`;

    const byEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
    const admin = byEmail["admin@gymtracker.local"];
    const trainers = [byEmail["trainer1@gymtracker.local"], byEmail["trainer2@gymtracker.local"]];
    const members = PEOPLE.filter((p) => p.role === "MEMBER").map((p) => byEmail[p.email]);

    const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
    await tx`
      insert into profiles ${tx(
        users.map((user, i) => ({
          user_id: user.id,
          birth_date: `19${between(85, 99)}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
          height_cm: between(163, 195),
          weight_kg: between(6000, 9800) / 100,
          experience_level: levels[i % levels.length],
          bio: user.role === "TRAINER" ? "Licensed strength coach." : null,
        })),
        "user_id",
        "birth_date",
        "height_cm",
        "weight_kg",
        "experience_level",
        "bio",
      )}`;

    const authors = [trainers[0], trainers[1], admin];
    const exercises = await tx`
      insert into exercises ${tx(
        EXERCISES.map(([name, muscleGroup, equipment], i) => ({
          name,
          muscle_group: muscleGroup,
          equipment,
          is_public: true,
          created_by: authors[i % authors.length],
        })),
        "name",
        "muscle_group",
        "equipment",
        "is_public",
        "created_by",
      )} returning id, name`;

    const exerciseId = Object.fromEntries(exercises.map((e) => [e.name, e.id]));
    const baseWeight = Object.fromEntries(EXERCISES.map(([name, , , base]) => [name, base]));

    const plans = await tx`
      insert into workout_plans ${tx(
        [
          {
            owner_id: trainers[0],
            trainer_id: trainers[0],
            title: "Push / Pull / Legs - 3 days",
            description: "Basic three-day split for general strength.",
            days_per_week: 3,
            is_template: true,
          },
          {
            owner_id: members[0],
            trainer_id: trainers[0],
            title: "Beginner Strength",
            description: "Twelve-week plan built around the main compound lifts.",
            days_per_week: 3,
            is_template: false,
          },
          {
            owner_id: members[1],
            trainer_id: trainers[1],
            title: "Upper Body Hypertrophy",
            description: "Higher volume for chest, shoulders and arms.",
            days_per_week: 4,
            is_template: false,
          },
        ],
        "owner_id",
        "trainer_id",
        "title",
        "description",
        "days_per_week",
        "is_template",
      )} returning id`;

    const planExercises = [];
    for (const plan of plans) {
      SESSION_TEMPLATES.forEach((template, dayIdx) => {
        template.exercises.forEach((name, orderIdx) => {
          planExercises.push({
            plan_id: plan.id,
            exercise_id: exerciseId[name],
            day_index: dayIdx + 1,
            target_sets: 3,
            target_reps: between(6, 12),
            order_index: orderIdx + 1,
          });
        });
      });
    }
    await tx`
      insert into plan_exercises ${tx(
        planExercises,
        "plan_id",
        "exercise_id",
        "day_index",
        "target_sets",
        "target_reps",
        "order_index",
      )}`;

    // Exercises workouts.plan_id for the two members who have a plan of their own.
    const planForMember = { [members[0]]: plans[1].id, [members[1]]: plans[2].id };

    const workoutRows = [];
    members.forEach((userId, memberIdx) => {
      daysAgoSeries(SESSIONS_PER_MEMBER[memberIdx]).forEach((daysAgo, i) => {
        const template = SESSION_TEMPLATES[i % SESSION_TEMPLATES.length];
        const performedAt = new Date(Date.now() - daysAgo * 86_400_000);
        performedAt.setHours(between(7, 20), between(0, 59), 0, 0);
        workoutRows.push({
          user_id: userId,
          plan_id: planForMember[userId] ?? null,
          performed_at: performedAt,
          duration_min: between(42, 82),
          notes: template.notes,
          template,
          daysAgo,
        });
      });
    });

    const workouts = await tx`
      insert into workouts ${tx(
        workoutRows,
        "user_id",
        "plan_id",
        "performed_at",
        "duration_min",
        "notes",
      )} returning id`;

    const setRows = [];
    workouts.forEach((workout, idx) => {
      const { template, daysAgo } = workoutRows[idx];
      const weeksTrained = (90 - daysAgo) / 7;
      for (const name of template.exercises) {
        const base = baseWeight[name];
        const isBodyweight = base === 0;
        const working = isBodyweight ? 0 : toStep(base * (1 + 0.012 * weeksTrained), 2.5);
        for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
          setRows.push({
            workout_id: workout.id,
            exercise_id: exerciseId[name],
            set_number: setNumber,
            reps: isBodyweight ? between(10, 22) : between(5, 10),
            weight_kg: working,
            rpe: rand() < 0.2 ? null : toStep(between(60, 95) / 10, 0.5),
          });
        }
      }
    });
    await tx`
      insert into workout_sets ${tx(
        setRows,
        "workout_id",
        "exercise_id",
        "set_number",
        "reps",
        "weight_kg",
        "rpe",
      )}`;

    const deadline = (days) =>
      new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    await tx`
      insert into goals ${tx(
        [
          { user_id: members[0], exercise_id: exerciseId["Bench Press"], goal_type: "MAX_WEIGHT", target_value: 100, unit: "kg", deadline: deadline(60), status: "ACTIVE" },
          { user_id: members[0], exercise_id: null, goal_type: "SESSION_COUNT", target_value: 60, unit: "sessions", deadline: deadline(120), status: "ACTIVE" },
          { user_id: members[0], exercise_id: null, goal_type: "BODY_WEIGHT", target_value: 80, unit: "kg", deadline: deadline(-10), status: "ACHIEVED" },
          { user_id: members[1], exercise_id: exerciseId["Back Squat"], goal_type: "MAX_WEIGHT", target_value: 140, unit: "kg", deadline: deadline(90), status: "ACTIVE" },
          { user_id: members[1], exercise_id: null, goal_type: "TOTAL_VOLUME", target_value: 50000, unit: "kg", deadline: deadline(45), status: "ACTIVE" },
          { user_id: members[2], exercise_id: exerciseId["Deadlift"], goal_type: "MAX_WEIGHT", target_value: 180, unit: "kg", deadline: deadline(75), status: "ACTIVE" },
          { user_id: members[3], exercise_id: null, goal_type: "SESSION_COUNT", target_value: 24, unit: "sessions", deadline: deadline(-20), status: "ABANDONED" },
          { user_id: members[4], exercise_id: null, goal_type: "BODY_WEIGHT", target_value: 72, unit: "kg", deadline: deadline(150), status: "ACTIVE" },
        ],
        "user_id",
        "exercise_id",
        "goal_type",
        "target_value",
        "unit",
        "deadline",
        "status",
      )}`;
  });

  const [counts] = await sql`
    select (select count(*) from users)          as users,
           (select count(*) from profiles)       as profiles,
           (select count(*) from exercises)      as exercises,
           (select count(*) from workout_plans)  as plans,
           (select count(*) from plan_exercises) as plan_exercises,
           (select count(*) from workouts)       as workouts,
           (select count(*) from workout_sets)   as workout_sets,
           (select count(*) from goals)          as goals`;

  console.log("seeded:");
  for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(15)} ${n}`);
  console.log(`\nall demo accounts use the password ${DEMO_PASSWORD}`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(`seed failed: ${err.message ?? err}`);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
