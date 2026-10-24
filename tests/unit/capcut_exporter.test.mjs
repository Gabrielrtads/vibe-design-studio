import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildCapcutDraftContent,
  buildFreeSubtitlesTrack,
  buildRoughCutSegments,
  framesToMicroseconds,
  secondsToMicroseconds,
} from '../../src/integrations/capcut/capcutExporter.ts';
import {
  saveCapcutDraftToDisk,
} from '../../src/integrations/capcut/capcutDraftDisk.mjs';

test('secondsToMicroseconds e framesToMicroseconds convertem com precisão inteira', () => {
  assert.equal(secondsToMicroseconds(1), 1_000_000);
  assert.equal(secondsToMicroseconds(3.5494), 3_549_400);
  assert.equal(framesToMicroseconds(30, 30), 1_000_000);
  assert.equal(framesToMicroseconds(15, 30), 500_000);
});

test('buildRoughCutSegments: fatia vídeo removendo silêncios e encadeando target_timerange contínuo', () => {
  const speechRanges = [
    { startSec: 1.0, endSec: 3.0 }, // 2s de fala
    { startSec: 5.5, endSec: 8.0 }, // 2.5s de fala (pula os 2.5s de silêncio entre 3.0 e 5.5)
  ];
  const result = buildRoughCutSegments({
    materialId: 'MAT-VIDEO-01',
    speechRanges,
  });

  assert.equal(result.segments.length, 2);
  // Primeiro corte: lê de 1s..3s do vídeo original, posicionado em 0s..2s na timeline
  assert.equal(result.segments[0].source_timerange.start, 1_000_000);
  assert.equal(result.segments[0].source_timerange.duration, 2_000_000);
  assert.equal(result.segments[0].target_timerange.start, 0);
  assert.equal(result.segments[0].target_timerange.duration, 2_000_000);

  // Segundo corte: lê de 5.5s..8.0s do original, colado em 2s..4.5s na timeline (ripple automático!)
  assert.equal(result.segments[1].source_timerange.start, 5_500_000);
  assert.equal(result.segments[1].source_timerange.duration, 2_500_000);
  assert.equal(result.segments[1].target_timerange.start, 2_000_000);
  assert.equal(result.segments[1].target_timerange.duration, 2_500_000);
  assert.equal(result.totalDurationUs, 4_500_000);
});

test('buildFreeSubtitlesTrack: gera legendas sem flags VIP/Pro para exportação gratuita', () => {
  const captions = [
    { text: 'Kage Bunshin', startSec: 0, endSec: 1.5, color: '#FFE600' },
    { text: 'no Jutsu!', startSec: 1.5, endSec: 3.0, color: '#FFFFFF' },
  ];
  const sub = buildFreeSubtitlesTrack(captions);
  assert.equal(sub.materials.length, 2);
  assert.equal(sub.track.type, 'text');
  assert.equal(sub.track.segments.length, 2);
  for (const mat of sub.materials) {
    assert.deepEqual(mat.pre_applied_vip_materials, [], 'nunca deve marcar material VIP pago');
  }
});

test('buildCapcutDraftContent e saveCapcutDraftToDisk: gera schema v360000 válido e cria backup .bak', () => {
  const draft = buildCapcutDraftContent({
    name: 'Vibe_Kage_Bunshin_Reel',
    width: 1080,
    height: 1920,
    fps: 30,
    videoClips: [
      {
        path: 'media/take01.mp4',
        speechRanges: [
          { startSec: 0.5, endSec: 2.5 },
          { startSec: 3.0, endSec: 5.0 },
        ],
      },
    ],
    captions: [
      { text: 'Clones em paralelo', startSec: 0, endSec: 2.0, color: '#FFE600' },
    ],
  });

  assert.equal(draft.version, 360000);
  assert.equal(draft.new_version, '181.0.0');
  assert.equal(draft.canvas_config.width, 1080);
  assert.equal(draft.canvas_config.height, 1920);
  assert.equal(draft.duration, 4_000_000);
  assert.ok(draft.tracks.some((t) => t.type === 'video'));
  assert.ok(draft.tracks.some((t) => t.type === 'text'));

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capcut-draft-test-'));
  try {
    const firstSave = saveCapcutDraftToDisk({
      draftRootDir: tmpRoot,
      draftId: 'test-draft-01',
      draftName: 'Vibe_Kage_Bunshin_Reel',
      content: draft,
    });
    assert.ok(fs.existsSync(firstSave.contentPath));
    assert.ok(fs.existsSync(firstSave.metaPath));

    // Segunda gravação deve preservar backup .bak
    const secondSave = saveCapcutDraftToDisk({
      draftRootDir: tmpRoot,
      draftId: 'test-draft-01',
      draftName: 'Vibe_Kage_Bunshin_Reel_v2',
      content: draft,
    });
    assert.ok(fs.existsSync(secondSave.backupPath), 'deve criar draft_content.json.bak ao sobrescrever');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
