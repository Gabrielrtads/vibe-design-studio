import React, { useId } from "react";
import { AbsoluteFill } from "remotion";

export type CinematicGradePreset =
  | "teal-orange"
  | "kodak-2383"
  | "cyber-neon"
  | "bleach-bypass"
  | "warm-editorial";

export interface CinematicLutGradeProps {
  children: React.ReactNode;
  preset?: CinematicGradePreset;
  intensity?: number;
  vignetteOpacity?: number;
  halationGlow?: boolean;
  style?: React.CSSProperties;
}

const GRADE_MATRICES: Record<CinematicGradePreset, number[]> = {
  "teal-orange": [
    1.12, -0.04, -0.06, 0, 0.02,
    -0.02, 1.02, 0.02, 0, 0.0,
    -0.08, 0.04, 1.16, 0, 0.03,
    0, 0, 0, 1, 0,
  ],
  "kodak-2383": [
    1.08, 0.03, -0.04, 0, 0.01,
    0.01, 1.04, -0.02, 0, 0.01,
    -0.04, 0.02, 1.09, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  "cyber-neon": [
    1.18, -0.08, 0.08, 0, 0.01,
    -0.05, 1.05, 0.06, 0, 0.0,
    0.04, -0.04, 1.24, 0, 0.04,
    0, 0, 0, 1, 0,
  ],
  "bleach-bypass": [
    0.68, 0.22, 0.10, 0, -0.02,
    0.18, 0.72, 0.10, 0, -0.02,
    0.16, 0.22, 0.62, 0, -0.01,
    0, 0, 0, 1, 0,
  ],
  "warm-editorial": [
    1.10, 0.04, -0.02, 0, 0.02,
    0.02, 1.03, -0.01, 0, 0.01,
    -0.05, -0.02, 0.94, 0, 0.0,
    0, 0, 0, 1, 0,
  ],
};

const IDENTITY_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

export function blendGradeMatrix(
  preset: CinematicGradePreset,
  intensity = 1.0,
): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  const target = GRADE_MATRICES[preset] ?? GRADE_MATRICES["kodak-2383"];
  const blended = IDENTITY_MATRIX.map(
    (idVal, idx) => Number((idVal + (target[idx] - idVal) * clamped).toFixed(4)),
  );
  return blended.join(" ");
}

/**
 * Applies hardware-accelerated SVG Color Matrix grading (equivalent to 3D LUT / AmazingFeature shaders)
 * with optional optical vignette and highlight halation.
 */
export const CinematicLutGrade: React.FC<CinematicLutGradeProps> = ({
  children,
  preset = "kodak-2383",
  intensity = 0.85,
  vignetteOpacity = 0.28,
  halationGlow = false,
  style,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterId = `vibe-lut-grade-${rawId}`;
  const matrixValues = blendGradeMatrix(preset, intensity);

  return (
    <AbsoluteFill style={style}>
      <svg
        width={0}
        height={0}
        style={{ position: "absolute", pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={matrixValues} result="graded" />
            {halationGlow ? (
              <>
                <feGaussianBlur in="graded" stdDeviation="4" result="blurGlow" />
                <feBlend in="graded" in2="blurGlow" mode="screen" />
              </>
            ) : null}
          </filter>
        </defs>
      </svg>

      <AbsoluteFill style={{ filter: `url(#${filterId})` }}>
        {children}
      </AbsoluteFill>

      {vignetteOpacity > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,${Math.min(0.85, vignetteOpacity)}) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
