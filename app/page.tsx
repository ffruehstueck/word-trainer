import { getAvailableFiles } from "@/lib/data";
import TrainingSession from "@/components/TrainingSession";

export default async function Home() {
  // Load available files on the server
  const availableFiles = await getAvailableFiles();

  return <TrainingSession initialAvailableFiles={availableFiles} />;
}
