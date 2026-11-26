import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="display text-5xl font-bold">That page is not here.</h1>
      <p className="mt-3 text-zinc-400">
        <Link href="/draft-rater" className="underline">
          Back to the board
        </Link>
      </p>
    </div>
  );
}
