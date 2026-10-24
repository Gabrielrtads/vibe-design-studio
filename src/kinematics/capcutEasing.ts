/**
 * ════════════════════════════════════════════════════════════════════════════
 * CAPCUT VELOCITY, MOTION BLUR & KINETIC CAPTION MATH ENGINE
 * ════════════════════════════════════════════════════════════════════════════
 * Curvas matemáticas de interpolação, Speed Ramp, vetores de Motion Blur
 * e cálculo de janelas de legendas sincronizadas (Whisper).
 */

export type BezierTuple = readonly [number, number, number, number];

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;

	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;

	const sampleCurveX = (u: number) => ((ax * u + bx) * u + cx) * u;
	const sampleCurveY = (u: number) => ((ay * u + by) * u + cy) * u;
	const sampleCurveDerivativeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

	const solveCurveX = (x: number): number => {
		let u = x;
		for (let i = 0; i < 8; i++) {
			const xEst = sampleCurveX(u) - x;
			if (Math.abs(xEst) < 1e-6) return u;
			const d = sampleCurveDerivativeX(u);
			if (Math.abs(d) < 1e-6) break;
			u -= xEst / d;
		}
		let lo = 0;
		let hi = 1;
		u = x;
		for (let i = 0; i < 12; i++) {
			const xEst = sampleCurveX(u);
			if (Math.abs(xEst - x) < 1e-6) return u;
			if (x > xEst) lo = u;
			else hi = u;
			u = 0.5 * (lo + hi);
		}
		return u;
	};

	return (t: number): number => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		if (x1 === y1 && x2 === y2) return t;
		return sampleCurveY(solveCurveX(t));
	};
}

const guard = (fn: (t: number) => number) => (t: number): number => {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return fn(t);
};

export const CAPCUT_BEZIER_PRESETS: Record<string, BezierTuple> = {
	flashIn: [0.08, 0.92, 0.18, 1.0] as const,
	flashOut: [0.78, 0.0, 0.94, 0.22] as const,
	heroZoom: [0.16, 1.0, 0.3, 1.0] as const,
	speedRamp: [0.85, 0.0, 0.15, 1.0] as const,
	montageCut: [0.65, 0.0, 0.08, 1.0] as const,
	tiktokBounce: [0.22, 1.52, 0.36, 1.0] as const,
} as const;

export const CAPCUT_EASE = {
	flashIn: guard(cubicBezier(...CAPCUT_BEZIER_PRESETS.flashIn)),
	flashOut: guard(cubicBezier(...CAPCUT_BEZIER_PRESETS.flashOut)),
	heroZoom: guard(cubicBezier(...CAPCUT_BEZIER_PRESETS.heroZoom)),
	speedRamp: guard(cubicBezier(...CAPCUT_BEZIER_PRESETS.speedRamp)),
	montageCut: guard(cubicBezier(...CAPCUT_BEZIER_PRESETS.montageCut)),
	tiktokBounce: guard(cubicBezier(...CAPCUT_BEZIER_PRESETS.tiktokBounce)),
} as const;

export const CAPCUT_EASE_FRAMES: Record<keyof typeof CAPCUT_EASE, number> = {
	flashIn: 9,
	flashOut: 8,
	heroZoom: 14,
	speedRamp: 16,
	montageCut: 10,
	tiktokBounce: 12,
} as const;

export type CapcutEaseName = keyof typeof CAPCUT_EASE;

export type BlurDirection = 'horizontal' | 'vertical' | 'radial-zoom';

export interface MotionBlurParams {
	frame: number;
	transitionStartFrame?: number;
	transitionDurationFrames?: number;
	maxBlurPx?: number;
	maxZoomBoost?: number;
	direction?: BlurDirection;
}

export interface MotionBlurVector {
	stdDeviationX: number;
	stdDeviationY: number;
	scale: number;
	progress: number;
}

export function computeMotionBlurVector(params: MotionBlurParams): MotionBlurVector {
	const {
		frame,
		transitionStartFrame = 0,
		transitionDurationFrames = 10,
		maxBlurPx = 16,
		maxZoomBoost = 0.08,
		direction = 'horizontal',
	} = params;

	const localFrame = frame - transitionStartFrame;
	if (localFrame < 0 || localFrame >= transitionDurationFrames || transitionDurationFrames <= 0) {
		return { stdDeviationX: 0, stdDeviationY: 0, scale: 1, progress: 1 };
	}

	const t = localFrame / transitionDurationFrames;
	const dt = 1 / Math.max(2, transitionDurationFrames);
	const p0 = CAPCUT_EASE.flashIn(Math.max(0, t - dt * 0.5));
	const p1 = CAPCUT_EASE.flashIn(Math.min(1, t + dt * 0.5));

	const envelope = Math.sin(Math.PI * t);
	const rawVelocity = Math.min(2.5, Math.abs(p1 - p0) / dt);
	const intensity = Math.min(1, rawVelocity * 0.45 * envelope + envelope * 0.35);

	const blurAmount = Number((maxBlurPx * intensity).toFixed(2));
	const scale = Number((1 + maxZoomBoost * envelope).toFixed(4));

	if (direction === 'vertical') {
		return { stdDeviationX: 0, stdDeviationY: blurAmount, scale, progress: CAPCUT_EASE.flashIn(t) };
	}
	if (direction === 'radial-zoom') {
		const diag = Number((blurAmount * 0.6).toFixed(2));
		return { stdDeviationX: diag, stdDeviationY: diag, scale, progress: CAPCUT_EASE.heroZoom(t) };
	}
	return { stdDeviationX: blurAmount, stdDeviationY: 0, scale, progress: CAPCUT_EASE.flashIn(t) };
}

export interface WhisperWordItem {
	word: string;
	start: number;
	end: number;
}

export interface ActiveCaptionState {
	activeIndex: number;
	activeWord: WhisperWordItem | null;
	wordProgress: number;
	windowWords: Array<WhisperWordItem & { index: number }>;
}

export function getActiveCaptionState(
	words: WhisperWordItem[],
	currentTimeSec: number,
	maxWordsPerLine = 4
): ActiveCaptionState {
	if (!Array.isArray(words) || words.length === 0) {
		return { activeIndex: -1, activeWord: null, wordProgress: 0, windowWords: [] };
	}

	let activeIndex = -1;
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		if (currentTimeSec >= w.start && currentTimeSec <= w.end) {
			activeIndex = i;
			break;
		}
	}

	if (activeIndex === -1) {
		return { activeIndex: -1, activeWord: null, wordProgress: 0, windowWords: [] };
	}

	const activeWord = words[activeIndex];
	const duration = Math.max(0.05, activeWord.end - activeWord.start);
	const wordProgress = Math.min(1, Math.max(0, (currentTimeSec - activeWord.start) / duration));

	const safeChunkSize = Math.max(1, maxWordsPerLine);
	const groupStart = Math.floor(activeIndex / safeChunkSize) * safeChunkSize;
	const groupEnd = Math.min(words.length, groupStart + safeChunkSize);

	const windowWords = words.slice(groupStart, groupEnd).map((w, idx) => ({
		...w,
		index: groupStart + idx,
	}));

	return {
		activeIndex,
		activeWord,
		wordProgress,
		windowWords,
	};
}
