import { articles } from "@/lib/journal";
import { JournalView } from "./JournalView";

export default function JournalPage() {
  return <JournalView articles={articles} />;
}
