import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  analyzeSmartSpeakerTimeline,
  cleanStuttersFromText,
  computeViralHookScore,
} from "../../src/timeline/smartSpeakerAndBeatEngine.ts";

test("cleanStuttersFromText remove repeticoes imediatas de gagueira", () => {
  assert.equal(cleanStuttersFromText("Eu eu descobri o o segredo"), "Eu descobri o segredo");
});

test("analyzeSmartSpeakerTimeline remove vicios de linguagem e promove o gancho viral para 0.0s", () => {
  const result = analyzeSmartSpeakerTimeline(
    [
      { startSec: 0.0, endSec: 1.5, text: "Oi gente tudo bom" },
      { startSec: 1.5, endSec: 2.2, text: "ééé hum" },
      { startSec: 3.0, endSec: 5.5, text: "Descobri o segredo de R$ 10 mil nunca revelado!" },
      { startSec: 6.0, endSec: 8.0, text: "Veja como funciona na pratica" },
    ],
    { bpm: 120, promoteBestHook: true, punchZoomScale: 1.14 },
  );

  assert.equal(result.removedFillers.length, 1);
  assert.ok(result.promotedHook);
  assert.equal(result.keptSegments[0].timelineStartSec, 0);
  assert.ok(result.keptSegments[0].text.includes("segredo"));
  assert.equal(result.keptSegments[1].recommendedScale, 1.14);
  assert.ok(result.beatMarkersSec.length >= 2);
  assert.ok(result.sfxTriggersSec.length >= 2);
});

test("computeViralHookScore pontua ganchos com numeros e palavras de impacto", () => {
  const weak = computeViralHookScore("bom dia pessoal", 2.0);
  const strong = computeViralHookScore("O erro que custa R$ 50 mil todo mes!", 2.5);
  assert.ok(strong > weak);
  assert.ok(strong >= 60);
});

test("CinematicLutGrade.tsx existe e utiliza feColorMatrix nativo sem -webkit-background-clip", () => {
  const file = path.resolve("src/components/effects/CinematicLutGrade.tsx");
  const src = fs.readFileSync(file, "utf8");
  assert.ok(src.includes("feColorMatrix"));
  assert.ok(!src.includes(["-webkit", "background-clip"].join("-")));
});
