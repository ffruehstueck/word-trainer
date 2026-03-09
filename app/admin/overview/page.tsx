import { getFromStrapiCollection } from "@/lib/strapiLogging";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";

const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"] });
const SESSION_PAGE_SIZE = 10;

type StrapiSession = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  mode: "exam" | "training";
  selectedFile: string;
  knownCount: number;
  unknownCount: number;
  totalAnswers: number;
  viewedWords?: number;
  totalWords?: number;
  progressPercent?: number;
  suspiciousFastWords?: number;
};

type StrapiAnswerEvent = {
  sessionId: string;
  timestamp: string;
  mode: "exam";
  selectedFile: string;
  wordId: number;
  source?: string;
  target?: string;
  isCorrect: boolean;
  attemptNumber: number;
  durationMs: number | null;
};

type WordItem = {
  key: string;
  source: string;
  target: string;
  wordId: number;
  correctCount: number;
  incorrectCount: number;
  durationSamples: number[];
};

type OverviewSession = {
  sessionId: string;
  mode: "exam" | "training";
  selectedFile: string;
  startedAt?: string;
  endedAt?: string;
  eventCount: number;
  knownAnswerCount: number;
  unknownAnswerCount: number;
  averageDurationMs?: number;
  viewedWords?: number;
  totalWords?: number;
  progressPercent?: number;
  suspiciousFastWords?: number;
  knownWords: WordItem[];
  unknownWords: WordItem[];
};

const dateTimeFormatter = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "medium",
  timeStyle: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDateTime = (value?: string): string => {
  if (!value) return "-";
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "-";
  return dateTimeFormatter.format(asDate);
};

const normalizeWordKey = (event: StrapiAnswerEvent): string => {
  const source = (event.source || "").trim();
  const target = (event.target || "").trim();
  return `${event.wordId}::${source}::${target}`;
};

const getScore = (known: number, unknown: number): number => {
  const total = known + unknown;
  if (total === 0) return 0;
  return Math.round((known / total) * 100);
};

const formatDuration = (durationMs?: number): string => {
  if (durationMs === undefined || Number.isNaN(durationMs)) return "-";
  return `${(durationMs / 1000).toFixed(2)}s`;
};

const getAverageDuration = (durations: number[]): number | undefined => {
  if (durations.length === 0) return undefined;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
};

const getDayKey = (value?: string): string | null => {
  if (!value) return null;
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString().slice(0, 10);
};

const buildOverviewHref = (page: number, day?: string): string => {
  const params = new URLSearchParams();
  if (day) {
    params.set("day", day);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/admin/overview?${query}` : "/admin/overview";
};

const fetchEventsForSessionIds = async (sessionIds: string[]): Promise<StrapiAnswerEvent[]> => {
  if (sessionIds.length === 0) return [];

  const allEvents: StrapiAnswerEvent[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const params = new URLSearchParams();
    params.set("pagination[page]", String(page));
    params.set("pagination[pageSize]", "200");
    params.set("sort", "createdAt:desc");
    sessionIds.forEach((sessionId, index) => {
      params.set(`filters[sessionId][$in][${index}]`, sessionId);
    });

    const response = await getFromStrapiCollection<StrapiAnswerEvent>(
      "training-answer-events",
      params.toString(),
    );

    allEvents.push(...(response.data || []));
    pageCount = response.meta?.pagination?.pageCount ?? page;
    page += 1;
  }

  return allEvents;
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams?: { day?: string; page?: string };
}) {
  let sessions: StrapiSession[] = [];
  let events: StrapiAnswerEvent[] = [];
  let loadError: string | null = null;
  let pageCount = 1;
  let totalSessionCount = 0;
  const pageFromQuery = Number(searchParams?.page ?? "1");
  const currentPage = Number.isInteger(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : 1;

  try {
    const sessionParams = new URLSearchParams();
    sessionParams.set("pagination[page]", String(currentPage));
    sessionParams.set("pagination[pageSize]", String(SESSION_PAGE_SIZE));
    sessionParams.set("sort", "createdAt:desc");

    const sessionResponse = await getFromStrapiCollection<StrapiSession>(
      "training-sessions",
      sessionParams.toString(),
    );
    sessions = sessionResponse.data || [];
    pageCount = sessionResponse.meta?.pagination?.pageCount ?? 1;
    totalSessionCount = sessionResponse.meta?.pagination?.total ?? sessions.length;

    const sessionIds = sessions.map((session) => session.sessionId);
    events = await fetchEventsForSessionIds(sessionIds);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (loadError) {
    return (
      <main className={`min-h-screen bg-[radial-gradient(circle_at_top_right,#fde68a_0%,#fff7ed_32%,#f8fafc_72%)] p-6 md:p-10 ${displayFont.className}`}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Admin Overview</h1>
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
            Fehler beim Laden der Logging-Daten: {loadError}
          </div>
        </div>
      </main>
    );
  }

  const sessionById = new Map<string, StrapiSession>();
  for (const session of sessions) {
    sessionById.set(session.sessionId, session);
  }

  const sessionEvents = new Map<string, StrapiAnswerEvent[]>();
  for (const event of events) {
    const rows = sessionEvents.get(event.sessionId) || [];
    rows.push(event);
    sessionEvents.set(event.sessionId, rows);
  }

  const allSessionIds = new Set<string>([
    ...sessions.map((session) => session.sessionId),
    ...events.map((event) => event.sessionId),
  ]);

  const overviewRows: OverviewSession[] = [];

  for (const sessionId of allSessionIds) {
    const session = sessionById.get(sessionId);
    const eventsForSession = sessionEvents.get(sessionId) || [];

    eventsForSession.sort((a, b) => {
      const left = new Date(a.timestamp).getTime();
      const right = new Date(b.timestamp).getTime();
      return left - right;
    });

    const wordsMap = new Map<string, WordItem>();
    let knownAnswerCount = 0;
    let unknownAnswerCount = 0;

    for (const event of eventsForSession) {
      const key = normalizeWordKey(event);
      const existing = wordsMap.get(key) || {
        key,
        source: event.source || `Word #${event.wordId}`,
        target: event.target || "",
        wordId: event.wordId,
        correctCount: 0,
        incorrectCount: 0,
        durationSamples: [],
      };

      if (event.isCorrect) {
        knownAnswerCount += 1;
        existing.correctCount += 1;
      } else {
        unknownAnswerCount += 1;
        existing.incorrectCount += 1;
      }
      if (typeof event.durationMs === "number") {
        existing.durationSamples.push(event.durationMs);
      }

      wordsMap.set(key, existing);
    }

    const allWords = Array.from(wordsMap.values());
    const sessionDurations = eventsForSession
      .map((event) => event.durationMs)
      .filter((duration): duration is number => typeof duration === "number");
    const knownWords = allWords
      .filter((word) => word.correctCount > 0)
      .sort((a, b) => {
        const aAvg = getAverageDuration(a.durationSamples);
        const bAvg = getAverageDuration(b.durationSamples);
        if (aAvg !== undefined && bAvg !== undefined && aAvg !== bAvg) {
          return aAvg - bAvg;
        }
        if (aAvg !== undefined && bAvg === undefined) {
          return -1;
        }
        if (aAvg === undefined && bAvg !== undefined) {
          return 1;
        }
        return b.correctCount - a.correctCount || a.source.localeCompare(b.source);
      });

    const unknownWords = allWords
      .filter((word) => word.incorrectCount > 0)
      .sort((a, b) => b.incorrectCount - a.incorrectCount || a.source.localeCompare(b.source));

    overviewRows.push({
      sessionId,
      mode: session?.mode || "exam",
      selectedFile: session?.selectedFile || eventsForSession[0]?.selectedFile || "-",
      startedAt: session?.startedAt || eventsForSession[0]?.timestamp,
      endedAt: session?.endedAt || eventsForSession[eventsForSession.length - 1]?.timestamp,
      eventCount: eventsForSession.length,
      knownAnswerCount: session?.knownCount ?? knownAnswerCount,
      unknownAnswerCount: session?.unknownCount ?? unknownAnswerCount,
      averageDurationMs: getAverageDuration(sessionDurations),
      viewedWords: session?.viewedWords,
      totalWords: session?.totalWords,
      progressPercent: session?.progressPercent,
      suspiciousFastWords: session?.suspiciousFastWords,
      knownWords,
      unknownWords,
    });
  }

  overviewRows.sort((a, b) => {
    const left = new Date(a.endedAt || a.startedAt || 0).getTime();
    const right = new Date(b.endedAt || b.startedAt || 0).getTime();
    return right - left;
  });

  const availableDays = Array.from(
    new Set(
      overviewRows
        .map((row) => getDayKey(row.startedAt || row.endedAt))
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => b.localeCompare(a));

  const selectedDay = searchParams?.day;
  const hasSelectedDay = Boolean(selectedDay);
  const filteredRows = hasSelectedDay
    ? overviewRows.filter((row) => getDayKey(row.startedAt || row.endedAt) === selectedDay)
    : overviewRows;

  const totalSessions = filteredRows.length;
  const totalKnown = filteredRows.reduce((sum, row) => sum + row.knownAnswerCount, 0);
  const totalUnknown = filteredRows.reduce((sum, row) => sum + row.unknownAnswerCount, 0);
  const totalAnswers = filteredRows.reduce((sum, row) => sum + row.eventCount, 0);
  const overallScore = getScore(totalKnown, totalUnknown);
  const totalViewedWords = filteredRows.reduce((sum, row) => sum + (row.viewedWords ?? 0), 0);
  const totalTrainingWords = filteredRows.reduce((sum, row) => sum + (row.totalWords ?? 0), 0);
  const onlyTrainingRows = filteredRows.length > 0 && filteredRows.every((row) => row.mode === "training");

  return (
    <main className={`min-h-screen bg-[radial-gradient(circle_at_top_right,#fde68a_0%,#fff7ed_32%,#f8fafc_72%)] p-6 md:p-10 ${displayFont.className}`}>
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 rounded-3xl border border-white/70 bg-white/70 backdrop-blur-sm p-6 md:p-8 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.45)]">
          <p className="uppercase tracking-[0.22em] text-xs font-medium text-orange-600 mb-2">Admin Analytics</p>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900">Lern-Übersicht</h1>
          <p className="text-slate-600 mt-3 max-w-2xl">
            Wann gelernt wurde und welche Wörter sicher saßen oder Probleme gemacht haben.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/admin/overview"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                !hasSelectedDay
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Alle Tage
            </Link>
            {availableDays.map((day) => (
              <Link
                key={day}
                href={buildOverviewHref(1, day)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  hasSelectedDay && selectedDay === day
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {shortDateFormatter.format(new Date(day))}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="text-slate-600">
              Seite {currentPage} von {pageCount} · {totalSessionCount} Sessions gesamt
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={buildOverviewHref(Math.max(1, currentPage - 1), selectedDay)}
                aria-disabled={currentPage <= 1}
                className={`rounded-lg border px-3 py-1.5 ${
                  currentPage <= 1
                    ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Neuer
              </Link>
              <Link
                href={buildOverviewHref(currentPage + 1, selectedDay)}
                aria-disabled={currentPage >= pageCount}
                className={`rounded-lg border px-3 py-1.5 ${
                  currentPage >= pageCount
                    ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Älter
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Sessions</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalSessions}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                {onlyTrainingRows ? "Gesehen" : "Gewusst"}
              </div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">
                {onlyTrainingRows ? totalViewedWords : totalKnown}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs uppercase tracking-wide text-rose-700">
                {onlyTrainingRows ? "Gesamt Vokabeln" : "Nicht gewusst"}
              </div>
              <div className="text-2xl font-bold text-rose-900 mt-1">
                {onlyTrainingRows ? totalTrainingWords : totalUnknown}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-700">Score</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{overallScore}%</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-600">Gesamtantworten: {totalAnswers}</div>
        </header>

        {filteredRows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-slate-600 shadow-sm">
            Keine Sessions für den gewählten Tag.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredRows.map((row) => {
              const score = getScore(row.knownAnswerCount, row.unknownAnswerCount);
              const suspiciousKnownCount = row.knownWords.filter((word) => {
                const averageDuration = getAverageDuration(word.durationSamples);
                return averageDuration !== undefined && averageDuration < 1000;
              }).length;
              const trainingViewed = row.viewedWords ?? row.knownAnswerCount;
              const trainingTotal = row.totalWords ?? Math.max(row.knownAnswerCount + row.unknownAnswerCount, 0);
              const trainingPercent =
                row.progressPercent ??
                (trainingTotal > 0 ? Math.round((trainingViewed / trainingTotal) * 100) : 0);
              const trainingSuspiciousFast = row.suspiciousFastWords ?? 0;
              return (
                <section
                  key={row.sessionId}
                  className="rounded-3xl border border-slate-200 bg-white shadow-[0_16px_34px_-26px_rgba(15,23,42,0.7)] overflow-hidden"
                >
                  <div className="p-5 md:p-6 bg-gradient-to-r from-slate-50 via-white to-amber-50 border-b border-slate-100">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-500">{shortDateFormatter.format(new Date(row.startedAt || Date.now()))}</div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mt-1">Session {row.sessionId.slice(0, 8)}...</h2>
                        <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          Datei: {row.selectedFile}
                        </div>
                        <div className="mt-2 inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                          Modus: {row.mode}
                        </div>
                      </div>

                      <div className="min-w-[220px]">
                        {row.mode === "exam" ? (
                          <>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>Lernscore</span>
                              <span>{score}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500" style={{ width: `${score}%` }} />
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-800 text-center">{row.knownAnswerCount} ✓</div>
                              <div className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-rose-800 text-center">{row.unknownAnswerCount} ✗</div>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-slate-700 text-center">{row.eventCount} #</div>
                              <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800 text-center">{formatDuration(row.averageDurationMs)}</div>
                            </div>
                            {suspiciousKnownCount > 0 ? (
                              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                {suspiciousKnownCount}x sehr schnell (&lt;1s) korrekt beantwortet
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>Trainingsfortschritt</span>
                              <span>{trainingPercent}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${trainingPercent}%` }} />
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                              <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-1 text-indigo-800 text-center">
                                {trainingViewed}/{trainingTotal}
                              </div>
                              <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-slate-700 text-center">
                                {trainingPercent}%
                              </div>
                              <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800 text-center">
                                {trainingSuspiciousFast}
                              </div>
                            </div>
                            {trainingSuspiciousFast > 0 ? (
                              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                {trainingSuspiciousFast}x Vokabel auffällig schnell weitergeklickt (&lt;1s)
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid md:grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>Start: {formatDateTime(row.startedAt)}</div>
                      <div>Ende: {formatDateTime(row.endedAt)}</div>
                    </div>
                  </div>

                  {row.mode === "exam" ? (
                    <div className="grid lg:grid-cols-2 gap-0">
                    <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-slate-100">
                      <h3 className="font-semibold text-emerald-700 mb-3">Gewusst</h3>
                      {row.knownWords.length === 0 ? (
                        <p className="text-sm text-slate-500">Keine korrekt beantworteten Wörter.</p>
                      ) : (
                        <>
                          <ul className="space-y-2">
                            {row.knownWords.slice(0, 5).map((word) => {
                              const averageDuration = getAverageDuration(word.durationSamples);
                              const isSuspiciousFast = averageDuration !== undefined && averageDuration < 1000;
                              return (
                                <li key={`known-${word.key}`} className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 text-sm">
                                  <div className="flex justify-between gap-2 items-start">
                                    <div>
                                      <div className="font-medium text-slate-900">{word.source}</div>
                                      {word.target ? <div className="text-slate-600 mt-0.5">{word.target}</div> : null}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {isSuspiciousFast ? (
                                        <span className="rounded-full bg-amber-200 text-amber-900 px-2 py-0.5 text-xs font-semibold">
                                          {formatDuration(averageDuration)}
                                        </span>
                                      ) : null}
                                      <span className="rounded-full bg-emerald-200 text-emerald-900 px-2 py-0.5 text-xs font-semibold">
                                        {word.correctCount}x
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          {row.knownWords.length > 5 ? (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-800">
                                Mehr ({row.knownWords.length - 5})
                              </summary>
                              <ul className="space-y-2 mt-2">
                                {row.knownWords.slice(5).map((word) => {
                                  const averageDuration = getAverageDuration(word.durationSamples);
                                  const isSuspiciousFast = averageDuration !== undefined && averageDuration < 1000;
                                  return (
                                    <li key={`known-more-${word.key}`} className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 text-sm">
                                      <div className="flex justify-between gap-2 items-start">
                                        <div>
                                          <div className="font-medium text-slate-900">{word.source}</div>
                                          {word.target ? <div className="text-slate-600 mt-0.5">{word.target}</div> : null}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          {isSuspiciousFast ? (
                                            <span className="rounded-full bg-amber-200 text-amber-900 px-2 py-0.5 text-xs font-semibold">
                                              {formatDuration(averageDuration)}
                                            </span>
                                          ) : null}
                                          <span className="rounded-full bg-emerald-200 text-emerald-900 px-2 py-0.5 text-xs font-semibold">
                                            {word.correctCount}x
                                          </span>
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="p-5 md:p-6">
                      <h3 className="font-semibold text-rose-700 mb-3">Nicht gewusst</h3>
                      {row.unknownWords.length === 0 ? (
                        <p className="text-sm text-slate-500">Keine falsch beantworteten Wörter.</p>
                      ) : (
                        <>
                          <ul className="space-y-2">
                            {row.unknownWords.slice(0, 5).map((word) => {
                              const averageDuration = getAverageDuration(word.durationSamples);
                              return (
                                <li key={`unknown-${word.key}`} className="rounded-xl bg-rose-50/70 border border-rose-100 p-3 text-sm">
                                  <div className="flex justify-between gap-2 items-start">
                                    <div>
                                      <div className="font-medium text-slate-900">{word.source}</div>
                                      {word.target ? <div className="text-slate-600 mt-0.5">{word.target}</div> : null}
                                      <div className="mt-1 text-xs text-slate-500">
                                        Ø Antwortzeit: {formatDuration(averageDuration)}
                                      </div>
                                    </div>
                                    <span className="rounded-full bg-rose-200 text-rose-900 px-2 py-0.5 text-xs font-semibold">{word.incorrectCount}x</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          {row.unknownWords.length > 5 ? (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-sm font-medium text-rose-700 hover:text-rose-800">
                                Mehr ({row.unknownWords.length - 5})
                              </summary>
                              <ul className="space-y-2 mt-2">
                                {row.unknownWords.slice(5).map((word) => {
                                  const averageDuration = getAverageDuration(word.durationSamples);
                                  return (
                                    <li key={`unknown-more-${word.key}`} className="rounded-xl bg-rose-50/70 border border-rose-100 p-3 text-sm">
                                      <div className="flex justify-between gap-2 items-start">
                                        <div>
                                          <div className="font-medium text-slate-900">{word.source}</div>
                                          {word.target ? <div className="text-slate-600 mt-0.5">{word.target}</div> : null}
                                          <div className="mt-1 text-xs text-slate-500">
                                            Ø Antwortzeit: {formatDuration(averageDuration)}
                                          </div>
                                        </div>
                                        <span className="rounded-full bg-rose-200 text-rose-900 px-2 py-0.5 text-xs font-semibold">{word.incorrectCount}x</span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
                          ) : null}
                        </>
                      )}
                    </div>
                    </div>
                  ) : (
                    <div className="p-5 md:p-6">
                      <h3 className="font-semibold text-indigo-700 mb-2">Training-Session</h3>
                      <p className="text-sm text-slate-600">
                        Im Trainingsmodus wird kein „gewusst / nicht gewusst“ erfasst. Es wird nur gespeichert,
                        wie viele Vokabeln angesehen wurden.
                      </p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
