/**
 * ════════════════════════════════════════════════════════════════════════════
 * CAPCUT AMAZING-ENGINE DIRECTIONAL MOTION BLUR & OPTICAL ZOOM
 * ════════════════════════════════════════════════════════════════════════════
 * Aplica desfoque de movimento direcional real via filtro SVG `<feGaussianBlur>`
 * acoplado à derivada de velocidade das curvas do CapCut (`CAPCUT_EASE.flashIn`).
 * Renderização SVG nativa (100% segura para render multi-thread).
 */

import React, { useId } from 'react';
import { useCurrentFrame } from 'remotion';
import {
	computeMotionBlurVector,
	type BlurDirection,
	type MotionBlurParams,
	type MotionBlurVector,
} from '../../kinematics/capcutEasing';

export { computeMotionBlurVector, type BlurDirection, type MotionBlurParams, type MotionBlurVector };

export interface CapcutMotionBlurProps {
	children: React.ReactNode;
	transitionStartFrame?: number;
	transitionDurationFrames?: number;
	maxBlurPx?: number;
	maxZoomBoost?: number;
	direction?: BlurDirection;
	style?: React.CSSProperties;
}

export const CapcutMotionBlur: React.FC<CapcutMotionBlurProps> = ({
	children,
	transitionStartFrame = 0,
	transitionDurationFrames = 10,
	maxBlurPx = 16,
	maxZoomBoost = 0.08,
	direction = 'horizontal',
	style,
}) => {
	const frame = useCurrentFrame();
	const rawId = useId();
	const filterId = `capcut-mb-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

	const vec = computeMotionBlurVector({
		frame,
		transitionStartFrame,
		transitionDurationFrames,
		maxBlurPx,
		maxZoomBoost,
		direction,
	});

	const hasBlur = vec.stdDeviationX > 0.1 || vec.stdDeviationY > 0.1;

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
				transform: `scale(${vec.scale})`,
				filter: hasBlur ? `url(#${filterId})` : undefined,
				willChange: 'transform, filter',
				...style,
			}}
		>
			{hasBlur && (
				<svg
					width={0}
					height={0}
					style={{ position: 'absolute', pointerEvents: 'none', opacity: 0 }}
					aria-hidden="true"
				>
					<defs>
						<filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur
								in="SourceGraphic"
								stdDeviation={`${vec.stdDeviationX} ${vec.stdDeviationY}`}
								edgeMode="duplicate"
							/>
						</filter>
					</defs>
				</svg>
			)}
			{children}
		</div>
	);
};
