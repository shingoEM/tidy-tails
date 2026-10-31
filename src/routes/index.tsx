import { createFileRoute } from "@tanstack/react-router";
import { TidyGame } from "@/components/TidyGame";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <TidyGame />;
}
