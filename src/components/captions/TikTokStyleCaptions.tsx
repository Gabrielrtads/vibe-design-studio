/**
 * ════════════════════════════════════════════════════════════════════════════
 * TIKTOK & CAPCUT VIRAL KINETIC CAPTIONS (Bodymovin / Lottie Inspired)
 * ════════════════════════════════════════════════════════════════════════════
 * Legendas dinâmicas palavra por palavra sincronizadas com Whisper (words.json).
 * Segue a regra inegociável do estúdio: gradientes de texto são renderizados
 * exclusivamente via SVG `<text fill="url(#id)">` para evitar bugs de clipping
 * no Chromium headless multi-thread.
 */

import React, { useId } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
	CAPCUT_EASE,
	getActiveCaptionState,
	type ActiveCaptionState,
	type WhisperWordItem,
} from '../../kinematics/capcutEasing';

export { getActiveCaptionState, type ActiveCaptionState, type WhisperWordItem };

export type TikTokCaptionVariant = 'active-pop' | 'karaoke-svg' | 'neon-glow';

export interface TikTokStyleCaptionsProps {
	words: WhisperWordItem[];
	variant?: TikTokCaptionVariant;
	highlightColor?: string;
	baseColor?: string;
	fontSize?: number;
	maxWordsPerLine?: number;
	bottomOffsetPx?: number;
}

export const TikTokStyleCaptions: React.FC<TikTokStyleCaptionsProps> = ({
	words,
	variant = 'active-pop',
	highlightColor = '#FFE600',
	baseColor = '#FFFFFF',
	fontSize = 62,
	maxWordsPerLine = 3,
	bottomOffsetPx = 340,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const rawId = useId();
	const gradId = `tiktok-karaoke-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

	const currentTimeSec = frame / Math.max(1, fps);
	const state = getActiveCaptionState(words, currentTimeSec, maxWordsPerLine);

	if (state.activeIndex === -1 || state.windowWords.length === 0) {
		return null;
	}

	const bounceT = Math.min(1, state.wordProgress * 2.5);
	const popScale = 1 + 0.16 * CAPCUT_EASE.tiktokBounce(bounceT);

	if (variant === 'karaoke-svg' && state.activeWord) {
		const pct = Math.round(state.wordProgress * 100);
		return (
			<div
				style={{
					position: 'absolute',
					left: 60,
					right: 60,
					bottom: bottomOffsetPx,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					pointerEvents: 'none',
				}}
			>
				<svg width="960" height={fontSize * 2.2} viewBox={`0 0 960 ${fontSize * 2.2}`}>
					<defs>
						<linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
							<stop offset={`${pct}%`} stopColor={highlightColor} />
							<stop offset={`${pct}%`} stopColor={baseColor} />
						</linearGradient>
					</defs>
					<text
						x="480"
						y={fontSize * 1.35}
						textAnchor="middle"
						fill={`url(#${gradId})`}
						stroke="#000000"
						strokeWidth={8}
						paintOrder="stroke fill"
						style={{
							fontFamily: 'Inter, system-ui, sans-serif',
							fontWeight: 900,
							fontSize: `${fontSize}px`,
							textTransform: 'uppercase',
						}}
					>
						{state.windowWords.map((w) => w.word).join(' ')}
					</text>
				</svg>
			</div>
		);
	}

	return (
		<div
			style={{
				position: 'absolute',
				left: 60,
				right: 60,
				bottom: bottomOffsetPx,
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: 'center',
				alignItems: 'center',
				gap: '16px',
				pointerEvents: 'none',
			}}
		>
			{state.windowWords.map((item) => {
				const isActive = item.index === state.activeIndex;
				const color = isActive ? highlightColor : baseColor;
				const scale = isActive ? popScale : 1;

				return (
					<span
						key={`${item.index}-${item.word}`}
						style={{
							display: 'inline-block',
							fontFamily: 'Inter, system-ui, sans-serif',
							fontWeight: 900,
							fontSize: `${fontSize}px`,
							color,
							textTransform: 'uppercase',
							transform: `scale(${scale.toFixed(3)})`,
							textShadow:
								variant === 'neon-glow' && isActive
									? `0 0 24px ${highlightColor}, 0 6px 14px rgba(0,0,0,0.95)`
									: '0 6px 14px rgba(0,0,0,0.92), -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000',
						}}
					>
						{item.word}
					</span>
				);
			})}
		</div>
	);
};
