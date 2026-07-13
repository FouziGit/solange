import { articles } from "@/lib/mock";
import { JournalView } from "./JournalView";

export default function JournalPage() {
  return <JournalView articles={articles} />;
}
