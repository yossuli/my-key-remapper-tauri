export type TraceEventType =
  | "move"
  | "wheel"
  | "hwheel"
  | "down"
  | "up"
  | "other";

export interface MouseTraceEvent {
  x: number;
  y: number;
  dx: number;
  dy: number;
  eventType: TraceEventType;
  wheelDelta: number;
  timestamp: number;
  pressedKeys: number[];
}

export interface TracePoint {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number; // px/s
  timestamp: number;
  dt: number; // ms
  eventType: TraceEventType;
  pressedKeys: number[];
  isScrollActive: boolean;
}

export interface TrackpadMetrics {
  currentHz: number;
  avgHz: number;
  maxHz: number;
  currentDt: number;
  minDt: number;
  maxDt: number;
  avgDt: number;
  jitterDt: number;
  currentDx: number;
  currentDy: number;
  totalDistance: number;
  currentSpeed: number;
  maxSpeed: number;
  eventCount: number;
  pressedKeys: number[];
  isKeyActive: boolean;
}

export type SmoothingMode = "raw" | "accumulated" | "lowpass" | "inertia";
export type ScrollAxis = "both" | "vertical" | "horizontal";

export interface ScrollSimulationConfig {
  /** トリガーキー VKCode (0 は任意のキーが押されている場合) */
  triggerVk: number;
  /** スクロール感度 (0.1 〜 5.0) */
  sensitivity: number;
  /** デッドゾーン (0 〜 20 px) - 微小な揺れを除去 */
  deadzone: number;
  /** スムージング方式 */
  smoothingMode: SmoothingMode;
  /** EMAスムージング係数 (0.1 〜 0.9) */
  smoothingAlpha: number;
  /** 慣性減衰率 (0.80 〜 0.98) */
  inertiaDamping: number;
  /** スクロール対象軸 */
  axis: ScrollAxis;
  /** スクロール方向反転 */
  invert: boolean;
  /** ステップ蓄積モード時の閾値 (px) */
  stepThreshold: number;
}

export type CaptureSource = "canvas-pointer" | "native-hook";
