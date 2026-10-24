/**
 * Smart Speaker, Viral Highlight & Beat-Aligned BGM Engine (`smartSpeakerAndBeatEngine.ts`)
 *
 * Pure local mathematical & linguistic engine for automatic video editing:
 * 1. Filler-word & stutter removal (pt-BR & EN).
 * 2. Viral Hook scoring & Cold-Open promotion (first 3 seconds).
 * 3. Beat-grid alignment, SFX trigger placement & BGM ducking/fade-out calculation.
 */

export interface TranscriptSegmentInput {
  startSec: number;
  endSec: number;
  text: string;
}

export interface ScoredSpeakerSegment {
  startSec: number;
  endSec: number;
  durationSec: number;
  timelineStartSec: number;
  timelineEndSec: number;
  text: string;
  hookScore: number;
  isHighlight: boolean;
  recommendedScale: number;
}

export interface SmartSpeakerAnalysisResult {
  totalDurationSec: number;
  keptSegments: ScoredSpeakerSegment[];
  removedFillers: Array<TranscriptSegmentInput & { reason: string }>;
  promotedHook: ScoredSpeakerSegment | null;
  beatMarkersSec: number[];
  sfxTriggersSec: number[];
  bgmFadeOutStartSec: number;
}

export interface SmartSpeakerOptions {
  extraFillerWords?: string[];
  minSegmentDurationSec?: number;
  promoteBestHook?: boolean;
  bpm?: number;
  punchZoomScale?: number;
}

const DEFAULT_FILLERS = new Set([
  "é",
  "éé",
  "ééé",
  "hum",
  "hmm",
  "ãhn",
  "ahn",
  "tipo",
  "né",
  "uh",
  "um",
  "erm",
  "ah",
  "oh",
]);

const HOOK_KEYWORDS = [
  "segredo",
  "erro",
  "nunca",
  "jamais",
  "verdade",
  "gratis",
  "grátis",
  "dinheiro",
  "reais",
  "r$",
  "como",
  "descobri",
  "pare",
  "cuidado",
  "ninguem",
  "ninguém",
  "100%",
  "mil",
];

export function computeViralHookScore(text: string, durationSec: number): number {
  const lower = String(text || "").toLowerCase();
  let score = 0;

  for (const kw of HOOK_KEYWORDS) {
    if (lower.includes(kw)) score += 25;
  }
  if (/\d+/.test(lower)) score += 20;
  if (/[?!]/.test(lower)) score += 15;
  if (durationSec >= 1.5 && durationSec <= 4.5) score += 20;

  const words = lower.split(/\s+/).filter(Boolean);
  const wps = durationSec > 0 ? words.length / durationSec : 0;
  if (wps >= 2.2) score += 15;

  return Math.min(100, score);
}

export function cleanStuttersFromText(rawText: string): string {
  const tokens = String(rawText || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const cleaned: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const currentNorm = tokens[i].toLowerCase().replace(/[.,!?;:"]/g, "");
    const prevNorm =
      i > 0 ? tokens[i - 1].toLowerCase().replace(/[.,!?;:"]/g, "") : "";
    if (i > 0 && currentNorm && currentNorm === prevNorm) {
      continue;
    }
    cleaned.push(tokens[i]);
  }
  return cleaned.join(" ");
}

export function analyzeSmartSpeakerTimeline(
  segments: TranscriptSegmentInput[],
  options: SmartSpeakerOptions = {},
): SmartSpeakerAnalysisResult {
  const fillerSet = new Set([
    ...DEFAULT_FILLERS,
    ...(options.extraFillerWords ?? []).map((w) => w.toLowerCase()),
  ]);
  const minDur = options.minSegmentDurationSec ?? 0.25;
  const promoteBestHook = options.promoteBestHook ?? true;
  const bpm = Math.max(40, options.bpm ?? 120);
  const punchZoomScale = options.punchZoomScale ?? 1.12;

  const valid: Array<{
    startSec: number;
    endSec: number;
    durationSec: number;
    text: string;
    hookScore: number;
    isHighlight: boolean;
  }> = [];
  const removedFillers: Array<TranscriptSegmentInput & { reason: string }> = [];

  for (const seg of segments ?? []) {
    const durationSec = Number((seg.endSec - seg.startSec).toFixed(4));
    const trimmed = String(seg.text || "").trim();
    if (durationSec < minDur || !trimmed) {
      removedFillers.push({ ...seg, reason: "too_short_or_empty" });
      continue;
    }

    const wordsNorm = trimmed
      .toLowerCase()
      .replace(/[.,!?;:"]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    if (
      wordsNorm.length > 0 &&
      wordsNorm.length <= 2 &&
      wordsNorm.every((w) => fillerSet.has(w))
    ) {
      removedFillers.push({ ...seg, reason: "filler_word" });
      continue;
    }

    const deStuttered = cleanStuttersFromText(trimmed);
    const hookScore = computeViralHookScore(deStuttered, durationSec);
    valid.push({
      startSec: seg.startSec,
      endSec: seg.endSec,
      durationSec,
      text: deStuttered,
      hookScore,
      isHighlight: hookScore >= 40,
    });
  }

  let ordered = [...valid];
  let promotedRaw: (typeof valid)[number] | null = null;

  if (promoteBestHook && ordered.length > 1) {
    let bestIndex = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i].hookScore > ordered[bestIndex].hookScore) {
        bestIndex = i;
      }
    }
    if (bestIndex > 0 && ordered[bestIndex].hookScore >= 40) {
      promotedRaw = ordered[bestIndex];
      ordered = [promotedRaw, ...ordered];
    }
  }

  let cursorSec = 0;
  const keptSegments: ScoredSpeakerSegment[] = [];
  const sfxTriggersSec: number[] = [];

  ordered.forEach((item, idx) => {
    const timelineStartSec = Number(cursorSec.toFixed(4));
    const timelineEndSec = Number((cursorSec + item.durationSec).toFixed(4));
    if (idx > 0) {
      sfxTriggersSec.push(timelineStartSec);
    }
    keptSegments.push({
      startSec: item.startSec,
      endSec: item.endSec,
      durationSec: item.durationSec,
      timelineStartSec,
      timelineEndSec,
      text: item.text,
      hookScore: item.hookScore,
      isHighlight: item.isHighlight,
      recommendedScale: idx % 2 === 1 ? punchZoomScale : 1.0,
    });
    cursorSec += item.durationSec;
  });

  const totalDurationSec = Number(cursorSec.toFixed(3));
  const beatStepSec = 60 / bpm;
  const barStepSec = beatStepSec * 4;
  const beatMarkersSec: number[] = [];
  for (let t = 0; t <= totalDurationSec + 1e-6; t += barStepSec) {
    beatMarkersSec.push(Number(t.toFixed(3)));
  }

  return {
    totalDurationSec,
    keptSegments,
    removedFillers,
    promotedHook: promotedRaw ? keptSegments[0] : null,
    beatMarkersSec,
    sfxTriggersSec,
    bgmFadeOutStartSec: Number(Math.max(0, totalDurationSec - 1.5).toFixed(3)),
  };
}
