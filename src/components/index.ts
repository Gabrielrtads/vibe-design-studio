/**
 * Vibe Design Studio — Biblioteca Canônica de Primitivas de Movimento (Motion Primitives)
 * O "Shadcn do Motion Design" em Remotion + React
 */

export { Smartphone3DMockup } from './Smartphone3DMockup';
export type { Smartphone3DMockupProps } from './Smartphone3DMockup';

export { VectorHUDOverlay } from './VectorHUDOverlay';
export type { VectorHUDOverlayProps } from './VectorHUDOverlay';

export { AppleKineticCard3D } from './AppleKineticCard3D';
export type { AppleKineticCard3DProps } from './AppleKineticCard3D';

export { AnimatedBezierCurve } from './AnimatedBezierCurve';
export type { AnimatedBezierCurveProps, CurvePoint } from './AnimatedBezierCurve';

export { InteractiveMacCursor } from './InteractiveMacCursor';
export type { InteractiveMacCursorProps, MacCursorWaypoint } from './InteractiveMacCursor';

export { AudioVisualizerBars } from './AudioVisualizerBars';
export type { AudioVisualizerBarsProps } from './AudioVisualizerBars';

// Kit "roteiro manda": fundo do estilo, frase e número em destaque
export { FundoEstilo, FraseDestaque, NumeroDestaque } from './roteiro/RoteiroKit';
export type { FundoEstiloProps, FraseDestaqueProps, NumeroDestaqueProps } from './roteiro/RoteiroKit';

// Elementos Planetários e Espaciais 3D
export { OrbitalPlanet3D } from './OrbitalPlanet3D';
export type { OrbitalPlanet3DProps } from './OrbitalPlanet3D';

// Técnicas de Retenção e Tipografia Hormozi
export { HormoziKineticCaption } from './HormoziKineticCaption';
export type { HormoziKineticCaptionProps } from './HormoziKineticCaption';

export { RetentionProgressBar } from './RetentionProgressBar';
export type { RetentionProgressBarProps } from './RetentionProgressBar';

export { HormoziPunchZoom } from './HormoziPunchZoom';
export type { HormoziPunchZoomProps } from './HormoziPunchZoom';

// Estilo VOX (Mixed Media Editorial & Cartografia 2.5D)
export * from './vox';

// Estilos Edit.IA Absorvidos (Gancho Grande, Órbita Split, Capa de Revista, Onda de Áudio)
export * from './editia';

// CapCut Amazing-Engine Effects & TikTok Viral Kinetic Captions
export { CapcutMotionBlur, computeMotionBlurVector } from './effects/CapcutMotionBlur';
export type { CapcutMotionBlurProps, BlurDirection, MotionBlurParams, MotionBlurVector } from './effects/CapcutMotionBlur';

export { TikTokStyleCaptions, getActiveCaptionState } from './captions/TikTokStyleCaptions';
export type { TikTokStyleCaptionsProps, TikTokCaptionVariant, WhisperWordItem, ActiveCaptionState } from './captions/TikTokStyleCaptions';

export { CinematicLutGrade, blendGradeMatrix } from './effects/CinematicLutGrade';
export type { CinematicLutGradeProps, CinematicGradePreset } from './effects/CinematicLutGrade';
