import { getAvailableFiles } from "@/lib/data";
import { parseShareParams } from "@/lib/shareLink";
import TrainingSession from "@/components/TrainingSession";

type HomeSearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams> | HomeSearchParams;
}) {
  const availableFiles = await getAvailableFiles();
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};
  const initialShareConfig = parseShareParams(
    resolvedSearchParams,
    availableFiles.map((file) => file.value),
  );

  return (
    <TrainingSession
      initialAvailableFiles={availableFiles}
      initialShareConfig={initialShareConfig}
    />
  );
}
