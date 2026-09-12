import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

const FEATURES = [
  {
    title: "Log every session",
    body: "Record sets, reps, weight and RPE as you train, with a rest timer between sets.",
  },
  {
    title: "See the trend",
    body: "Estimated one-rep max per exercise and weekly training volume, charted over time.",
  },
  {
    title: "Train with a coach",
    body: "Trainers build plans and assign them to members; members keep their own log.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12">
      <header className="flex flex-col items-start gap-4">
        <Badge tone="info">Workout tracker</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">
          Track your training, not just your gym membership.
        </h1>
        <p className="max-w-2xl opacity-70">
          GymTracker keeps your sessions, sets and goals in one place, and shows whether the
          numbers are actually going up.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/register"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} header={feature.title}>
            <p className="opacity-70">{feature.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
