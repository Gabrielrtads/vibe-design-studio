/**
 * ════════════════════════════════════════════════════════════════════════════
 * CAPCUT DESKTOP DRAFT COMPILER & FREE AUTO-CUT / SUBTITLE ENGINE (PURE TS)
 * ════════════════════════════════════════════════════════════════════════════
 * Compilador isomórfico (zero dependências de I/O) que gera estruturas
 * `draft_content.json` compatíveis com CapCut Desktop (v360000 / 181.0.0):
 * 1. Converte timelines do Vibe Design Studio para a estrutura do CapCut;
 * 2. Executa Auto-Cut gratuito de silêncios (Ripple Cut sem CapCut Pro);
 * 3. Gera faixas de legendas sincronizadas livres de flags VIP/Pro.
 */

export interface SpeechRange {
	startSec: number;
	endSec: number;
}

export interface CaptionEntry {
	text: string;
	startSec: number;
	endSec: number;
	color?: string;
	fontSize?: number;
	yPosition?: number;
}

export interface VideoClipInput {
	path: string;
	width?: number;
	height?: number;
	durationSec?: number;
	speechRanges?: SpeechRange[];
	volume?: number;
	speed?: number;
}

export interface AudioClipInput {
	path: string;
	startSec: number;
	durationSec: number;
	volume?: number;
}

export interface CapcutDraftOptions {
	name: string;
	width?: number;
	height?: number;
	fps?: number;
	videoClips: VideoClipInput[];
	audioClips?: AudioClipInput[];
	captions?: CaptionEntry[];
}

export function secondsToMicroseconds(seconds: number): number {
	if (!Number.isFinite(seconds) || seconds < 0) return 0;
	return Math.round(seconds * 1_000_000);
}

export function framesToMicroseconds(frames: number, fps = 30): number {
	if (!Number.isFinite(frames) || frames < 0 || fps <= 0) return 0;
	return Math.round((frames / fps) * 1_000_000);
}

let fallbackCounter = 0;
function generateUuid(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID().toUpperCase();
	}
	fallbackCounter += 1;
	const hex = Date.now().toString(16).padStart(12, '0');
	const seq = fallbackCounter.toString(16).padStart(4, '0');
	return `40CCB2FC-${seq}-49BE-BF37-${hex}`.toUpperCase();
}

function baseName(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const parts = normalized.split('/');
	return parts[parts.length - 1] || normalized;
}

/**
 * Fatia um material de vídeo com base nos intervalos de fala (Whisper / Silêncio),
 * removendo pausas e colando os segmentos em sequência contínua (Ripple Edit).
 */
export function buildRoughCutSegments(params: {
	materialId: string;
	speechRanges: SpeechRange[];
	startTimelineUs?: number;
	volume?: number;
	speed?: number;
}) {
	const { materialId, speechRanges, startTimelineUs = 0, volume = 1.0, speed = 1.0 } = params;
	const segments = [];
	let cursorUs = startTimelineUs;

	for (const range of speechRanges) {
		const startSourceUs = secondsToMicroseconds(range.startSec);
		const endSourceUs = secondsToMicroseconds(range.endSec);
		const rawDurationUs = Math.max(0, endSourceUs - startSourceUs);
		if (rawDurationUs <= 0) continue;

		const targetDurationUs = Math.max(1, Math.round(rawDurationUs / Math.max(0.1, speed)));

		segments.push({
			id: generateUuid(),
			material_id: materialId,
			source_timerange: {
				start: startSourceUs,
				duration: rawDurationUs,
			},
			target_timerange: {
				start: cursorUs,
				duration: targetDurationUs,
			},
			render_timerange: { start: 0, duration: 0 },
			speed,
			volume,
			last_nonzero_volume: volume > 0 ? volume : 1.0,
			visible: true,
			clip: {
				scale: { x: 1.0, y: 1.0 },
				rotation: 0.0,
				transform: { x: 0.0, y: 0.0 },
				flip: { vertical: false, horizontal: false },
				alpha: 1.0,
			},
			uniform_scale: { on: true, value: 1.0 },
			enable_lut: true,
			enable_adjust: true,
			enable_color_curves: true,
			enable_color_wheels: true,
			extra_material_refs: [],
			keyframe_refs: [],
			track_render_index: 0,
			source: 'segmentsourcenormal',
		});

		cursorUs += targetDurationUs;
	}

	return {
		segments,
		totalDurationUs: cursorUs - startTimelineUs,
	};
}

/**
 * Constrói uma track de legendas 100% gratuitas (text materials normais sem flag VIP/Pro),
 * permitindo usar transcrição Whisper local e exportar no CapCut sem cadeado pago.
 */
export function buildFreeSubtitlesTrack(captions: CaptionEntry[]) {
	const materials = [];
	const segments = [];

	for (const cap of captions) {
		const startUs = secondsToMicroseconds(cap.startSec);
		const endUs = secondsToMicroseconds(cap.endSec);
		const durationUs = Math.max(0, endUs - startUs);
		if (durationUs <= 0 || !cap.text.trim()) continue;

		const matId = generateUuid();
		const textColor = cap.color || '#FFE600';
		const fontSize = cap.fontSize ?? 11.0;

		materials.push({
			id: matId,
			type: 'text',
			content: JSON.stringify({
				text: cap.text.trim(),
				styles: [
					{
						fill: { content: { solid: { color: [1.0, 0.9, 0.0] } } },
						range: [0, cap.text.trim().length],
						size: fontSize,
						bold: true,
						strokes: [{ color: [0, 0, 0], width: 0.08 }],
					},
				],
			}),
			text_color: textColor,
			font_size: fontSize,
			alignment: 1,
			check_flag: 7,
			pre_applied_vip_materials: [] as string[],
		});

		segments.push({
			id: generateUuid(),
			material_id: matId,
			target_timerange: {
				start: startUs,
				duration: durationUs,
			},
			source_timerange: {
				start: 0,
				duration: durationUs,
			},
			clip: {
				scale: { x: 1.0, y: 1.0 },
				rotation: 0.0,
				transform: { x: 0.0, y: cap.yPosition ?? -0.55 },
				flip: { vertical: false, horizontal: false },
				alpha: 1.0,
			},
			visible: true,
			volume: 1.0,
			extra_material_refs: [],
			keyframe_refs: [],
		});
	}

	return {
		materials,
		track: {
			id: generateUuid(),
			type: 'text',
			name: 'Vibe_Whisper_Subtitles',
			is_default_name: false,
			flag: 0,
			attribute: 0,
			segments,
		},
	};
}

/**
 * Monta o objeto JSON completo (`draft_content.json`) no padrão CapCut v360000.
 */
export function buildCapcutDraftContent(options: CapcutDraftOptions) {
	const width = options.width ?? 1080;
	const height = options.height ?? 1920;
	const fps = options.fps ?? 30.0;

	const videoMaterials = [];
	const videoSegments = [];
	let timelineCursorUs = 0;

	for (const clip of options.videoClips) {
		const matId = generateUuid();
		const normalizedPath = clip.path.replace(/\\/g, '/');
		const ranges: SpeechRange[] =
			clip.speechRanges && clip.speechRanges.length > 0
				? clip.speechRanges
				: [{ startSec: 0, endSec: clip.durationSec ?? 5.0 }];

		const maxEndSec = Math.max(...ranges.map((r) => r.endSec), clip.durationSec ?? 5.0);
		const sourceDurationUs = secondsToMicroseconds(maxEndSec);

		videoMaterials.push({
			id: matId,
			unique_id: generateUuid().replace(/-/g, '').toLowerCase(),
			type: 'video',
			duration: sourceDurationUs,
			path: normalizedPath,
			material_name: baseName(normalizedPath),
			width: clip.width ?? width,
			height: clip.height ?? height,
			has_audio: true,
			category_name: 'local',
			crop_ratio: 'free',
			crop_scale: 1.0,
			crop: {
				upper_left_x: 0.0,
				upper_left_y: 0.0,
				upper_right_x: 1.0,
				upper_right_y: 0.0,
				lower_left_x: 0.0,
				lower_left_y: 1.0,
				lower_right_x: 1.0,
				lower_right_y: 1.0,
			},
			check_flag: 62978047,
			pre_applied_vip_materials: [] as string[],
		});

		const cut = buildRoughCutSegments({
			materialId: matId,
			speechRanges: ranges,
			startTimelineUs: timelineCursorUs,
			volume: clip.volume ?? 1.0,
			speed: clip.speed ?? 1.0,
		});

		videoSegments.push(...cut.segments);
		timelineCursorUs += cut.totalDurationUs;
	}

	const tracks: Array<Record<string, unknown>> = [
		{
			id: generateUuid(),
			type: 'video',
			name: 'Vibe_Main_Video',
			is_default_name: false,
			flag: 0,
			attribute: 0,
			segments: videoSegments,
		},
	];

	const audioMaterials = [];
	if (options.audioClips && options.audioClips.length > 0) {
		const audioSegments = [];
		for (const audio of options.audioClips) {
			const matId = generateUuid();
			const durUs = secondsToMicroseconds(audio.durationSec);
			const startUs = secondsToMicroseconds(audio.startSec);
			const normalizedPath = audio.path.replace(/\\/g, '/');

			audioMaterials.push({
				id: matId,
				type: 'extract_music',
				path: normalizedPath,
				name: baseName(normalizedPath),
				duration: durUs,
				check_flag: 1,
			});

			audioSegments.push({
				id: generateUuid(),
				material_id: matId,
				source_timerange: { start: 0, duration: durUs },
				target_timerange: { start: startUs, duration: durUs },
				volume: audio.volume ?? 1.0,
				visible: true,
			});
		}

		tracks.push({
			id: generateUuid(),
			type: 'audio',
			name: 'Vibe_Audio_Track',
			is_default_name: false,
			flag: 0,
			attribute: 0,
			segments: audioSegments,
		});
	}

	let textMaterials: Array<Record<string, unknown>> = [];
	if (options.captions && options.captions.length > 0) {
		const sub = buildFreeSubtitlesTrack(options.captions);
		textMaterials = sub.materials;
		tracks.push(sub.track);
	}

	const nowSec = Math.floor(Date.now() / 1000);

	return {
		id: generateUuid(),
		version: 360000,
		new_version: '181.0.0',
		name: options.name,
		duration: timelineCursorUs,
		create_time: nowSec,
		update_time: nowSec,
		fps,
		is_drop_frame_timecode: false,
		color_space: 0,
		config: {
			video_mute: false,
			maintrack_adsorb: true,
			subtitle_sync: true,
			lyrics_sync: true,
		},
		canvas_config: {
			ratio: width < height ? '9:16' : 'original',
			width,
			height,
			background: null,
		},
		tracks,
		materials: {
			flowers: [],
			videos: videoMaterials,
			audios: audioMaterials,
			texts: textMaterials,
			speeds: [],
			canvases: [],
			transitions: [],
			effects: [],
		},
	};
}
