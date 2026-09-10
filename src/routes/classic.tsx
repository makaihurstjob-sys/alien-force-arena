import { createFileRoute } from "@tanstack/react-router";
import Classic from "@/components/Classic";

export const Route = createFileRoute("/classic")({
  head: () => ({ meta: [{ title: "Alien Force - Classic" }] }),
  component: Classic,
});
