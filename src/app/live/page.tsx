import { streams } from "@/lib/mock";
import { StreamsView } from "./StreamsView";

export default function LivePage() {
  return <StreamsView streams={streams} />;
}
