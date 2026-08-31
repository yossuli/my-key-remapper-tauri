import { useCallback, useEffect, useRef, useState } from "react";
import { useIpc, useIpcEvent } from "@/hooks/api/useIpc";
import type {
  CaptureSource,
  MouseTraceEvent,
  ScrollSimulationConfig,
  TracePoint,
  TrackpadMetrics,
} from "@/types/trackpad";

const MAX_POINTS = 300;
const MAX_LOGS = 200;

export const DEFAULT_SCROLL_SIMULATION_CONFIG: ScrollSimulationConfig = {
  triggerVk: -1, // -1 = 常時有効（テスト用）, 0 = 任意のキー, >0 = 指定VK
  sensitivity: 1.0,
  deadzone: 0,
  smoothingMode: "raw",
  smoothingAlpha: 0.3,
  inertiaDamping: 0.92,
  axis: "both",
  invert: false,
  stepThreshold: 15,
};

const INITIAL_METRICS: TrackpadMetrics = {
  currentHz: 0,
  avgHz: 0,
  maxHz: 0,
  currentDt: 0,
  minDt: 9999,
  maxDt: 0,
  avgDt: 0,
  jitterDt: 0,
  currentDx: 0,
  currentDy: 0,
  totalDistance: 0,
  currentSpeed: 0,
  maxSpeed: 0,
  eventCount: 0,
  pressedKeys: [],
  isKeyActive: true,
};

export function useTrackpadTrace() {
  const { invoke } = useIpc();
  const [captureSource, setCaptureSource] =
    useState<CaptureSource>("canvas-pointer");
  const [isCapturing, setIsCapturing] = useState(true);
  const [points, setPoints] = useState<TracePoint[]>([]);
  const [logs, setLogs] = useState<TracePoint[]>([]);
  const [metrics, setMetrics] = useState<TrackpadMetrics>(INITIAL_METRICS);
  const [scrollConfig, setScrollConfig] = useState<ScrollSimulationConfig>(
    DEFAULT_SCROLL_SIMULATION_CONFIG
  );
  const [simulatedScroll, setSimulatedScroll] = useState<{
    scrollX: number;
    scrollY: number;
    lastDeltaX: number;
    lastDeltaY: number;
    seq: number;
  }>({
    scrollX: 0,
    scrollY: 0,
    lastDeltaX: 0,
    lastDeltaY: 0,
    seq: 0,
  });

  // 内部追跡用のRefs（高頻度イベントのレンダリング負荷軽減）
  const lastEventTimeRef = useRef<number>(performance.now());
  const eventTimestampsRef = useRef<number[]>([]);
  const dtsRef = useRef<number[]>([]);
  const totalDistanceRef = useRef<number>(0);
  const maxHzRef = useRef<number>(0);
  const maxSpeedRef = useRef<number>(0);
  const eventCountRef = useRef<number>(0);
  const accumulatedXRef = useRef<number>(0);
  const accumulatedYRef = useRef<number>(0);
  const smoothedDxRef = useRef<number>(0);
  const smoothedDyRef = useRef<number>(0);
  const pressedKeysRef = useRef<Set<number>>(new Set());
  const seqRef = useRef<number>(0);

  // キー押下状態（DOMキーイベント）の追跡（キャンバスモード時用）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const vk = e.keyCode || e.which;
      pressedKeysRef.current.add(vk);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const vk = e.keyCode || e.which;
      pressedKeysRef.current.delete(vk);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Native Hook の ON/OFF 制御
  useEffect(() => {
    const enableNative = isCapturing && captureSource === "native-hook";
    invoke("set-mouse-trace-enabled", { enabled: enableNative }).catch(
      (err) => {
        console.warn("Failed to set mouse trace enabled:", err);
      }
    );

    return () => {
      if (enableNative) {
        invoke("set-mouse-trace-enabled", { enabled: false }).catch(() => {});
      }
    };
  }, [captureSource, isCapturing, invoke]);

  // ポイントおよびメトリクス更新コアロジック
  const processNewEvent = useCallback(
    (
      x: number,
      y: number,
      dx: number,
      dy: number,
      eventType: TracePoint["eventType"],
      pressedKeysInput?: number[]
    ) => {
      if (!isCapturing) {
        return;
      }

      const now = performance.now();
      const dt = Math.max(1, now - lastEventTimeRef.current);
      lastEventTimeRef.current = now;

      // タイムスタンプ履歴 (過去1秒間のHz計算)
      eventTimestampsRef.current.push(now);
      const oneSecAgo = now - 1000;
      while (
        eventTimestampsRef.current.length > 0 &&
        eventTimestampsRef.current[0] < oneSecAgo
      ) {
        eventTimestampsRef.current.shift();
      }
      const currentHz = eventTimestampsRef.current.length;
      if (currentHz > maxHzRef.current) {
        maxHzRef.current = currentHz;
      }

      // dt 統計
      dtsRef.current.push(dt);
      if (dtsRef.current.length > 60) {
        dtsRef.current.shift();
      }
      const avgDt =
        dtsRef.current.reduce((a, b) => a + b, 0) / dtsRef.current.length;
      const minDt = Math.min(...dtsRef.current);
      const maxDt = Math.max(...dtsRef.current);
      const variance =
        dtsRef.current.reduce((acc, val) => acc + (val - avgDt) ** 2, 0) /
        dtsRef.current.length;
      const jitterDt = Math.sqrt(variance);

      // 移動距離 & 速度 (px/s)
      const distance = Math.hypot(dx, dy);
      totalDistanceRef.current += distance;
      const speed = distance / (dt / 1000) || 0;
      if (speed > maxSpeedRef.current && speed < 15_000) {
        maxSpeedRef.current = Math.round(speed);
      }
      eventCountRef.current += 1;

      // キー押下状態の判定
      // Native Hook から受け取った pressedKeysInput と DOM の pressedKeysRef を合体
      const mergedKeys = new Set<number>(pressedKeysRef.current);
      if (pressedKeysInput) {
        for (const k of pressedKeysInput) {
          mergedKeys.add(k);
        }
      }
      const pressedKeys = Array.from(mergedKeys);

      const isKeyActive =
        scrollConfig.triggerVk === -1
          ? true // 常時有効モード
          : scrollConfig.triggerVk === 0
          ? pressedKeys.length > 0 // 任意のキー押下中
          : pressedKeys.includes(scrollConfig.triggerVk); // 指定キー押下中

      // スクロールシミュレーションの計算
      let simDeltaX = 0;
      let simDeltaY = 0;

      if (isKeyActive) {
        // デッドゾーン判定
        let effectiveDx = Math.abs(dx) >= scrollConfig.deadzone ? dx : 0;
        let effectiveDy = Math.abs(dy) >= scrollConfig.deadzone ? dy : 0;

        if (scrollConfig.axis === "vertical") {
          effectiveDx = 0;
        }
        if (scrollConfig.axis === "horizontal") {
          effectiveDy = 0;
        }

        const directionMultiplier = scrollConfig.invert ? -1 : 1;

        if (scrollConfig.smoothingMode === "raw") {
          simDeltaX =
            effectiveDx * scrollConfig.sensitivity * directionMultiplier;
          simDeltaY =
            effectiveDy * scrollConfig.sensitivity * directionMultiplier;
        } else if (scrollConfig.smoothingMode === "lowpass") {
          smoothedDxRef.current =
            smoothedDxRef.current * (1 - scrollConfig.smoothingAlpha) +
            effectiveDx * scrollConfig.smoothingAlpha;
          smoothedDyRef.current =
            smoothedDyRef.current * (1 - scrollConfig.smoothingAlpha) +
            effectiveDy * scrollConfig.smoothingAlpha;
          simDeltaX =
            smoothedDxRef.current *
            scrollConfig.sensitivity *
            directionMultiplier;
          simDeltaY =
            smoothedDyRef.current *
            scrollConfig.sensitivity *
            directionMultiplier;
        } else if (scrollConfig.smoothingMode === "accumulated") {
          accumulatedXRef.current += effectiveDx * scrollConfig.sensitivity;
          accumulatedYRef.current += effectiveDy * scrollConfig.sensitivity;

          if (Math.abs(accumulatedXRef.current) >= scrollConfig.stepThreshold) {
            simDeltaX =
              Math.sign(accumulatedXRef.current) *
              scrollConfig.stepThreshold *
              directionMultiplier;
            accumulatedXRef.current = 0;
          }
          if (Math.abs(accumulatedYRef.current) >= scrollConfig.stepThreshold) {
            simDeltaY =
              Math.sign(accumulatedYRef.current) *
              scrollConfig.stepThreshold *
              directionMultiplier;
            accumulatedYRef.current = 0;
          }
        }
      }

      seqRef.current += 1;
      setSimulatedScroll((prev) => ({
        scrollX: prev.scrollX + simDeltaX,
        scrollY: prev.scrollY + simDeltaY,
        lastDeltaX: simDeltaX,
        lastDeltaY: simDeltaY,
        seq: seqRef.current,
      }));

      const newPoint: TracePoint = {
        id: crypto.randomUUID(),
        x,
        y,
        dx,
        dy,
        speed: Math.round(speed),
        timestamp: Math.round(now),
        dt: Math.round(dt * 10) / 10,
        eventType,
        pressedKeys,
        isScrollActive: isKeyActive,
      };

      setPoints((prev) => {
        const next = [...prev, newPoint];
        if (next.length > MAX_POINTS) {
          return next.slice(-MAX_POINTS);
        }
        return next;
      });

      setLogs((prev) => {
        const next = [newPoint, ...prev];
        if (next.length > MAX_LOGS) {
          return next.slice(0, MAX_LOGS);
        }
        return next;
      });

      setMetrics({
        currentHz,
        avgHz: Math.round(
          eventTimestampsRef.current.length /
            Math.max(1, (now - eventTimestampsRef.current[0] || 1000) / 1000)
        ),
        maxHz: maxHzRef.current,
        currentDt: Math.round(dt * 10) / 10,
        minDt: Math.round(minDt * 10) / 10,
        maxDt: Math.round(maxDt * 10) / 10,
        avgDt: Math.round(avgDt * 10) / 10,
        jitterDt: Math.round(jitterDt * 100) / 100,
        currentDx: dx,
        currentDy: dy,
        totalDistance: Math.round(totalDistanceRef.current),
        currentSpeed: Math.round(speed),
        maxSpeed: maxSpeedRef.current,
        eventCount: eventCountRef.current,
        pressedKeys,
        isKeyActive,
      });
    },
    [isCapturing, scrollConfig]
  );

  // Native Hook イベントハンドラ
  const handleNativeEvent = useCallback(
    (...args: unknown[]) => {
      if (captureSource !== "native-hook" || !isCapturing) {
        return;
      }
      const data = args[0] as MouseTraceEvent;
      if (!data) {
        return;
      }

      processNewEvent(
        data.x,
        data.y,
        data.dx,
        data.dy,
        data.eventType,
        data.pressedKeys
      );
    },
    [captureSource, isCapturing, processNewEvent]
  );

  useIpcEvent("mouse-trace-event", handleNativeEvent);

  // Web Canvas Pointer イベントハンドラ
  const lastCanvasPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (captureSource !== "canvas-pointer") {
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      lastCanvasPosRef.current = { x, y };
      processNewEvent(x, y, 0, 0, "down");
    },
    [captureSource, processNewEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (captureSource !== "canvas-pointer") {
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);

      let dx = e.movementX;
      let dy = e.movementY;

      // movementX/Y が未対応または異常値の場合のフォールバック
      if (
        lastCanvasPosRef.current &&
        (dx === undefined || (dx === 0 && dy === 0))
      ) {
        dx = x - lastCanvasPosRef.current.x;
        dy = y - lastCanvasPosRef.current.y;
      }
      lastCanvasPosRef.current = { x, y };

      if (dx !== 0 || dy !== 0) {
        processNewEvent(x, y, dx, dy, "move");
      }
    },
    [captureSource, processNewEvent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (captureSource !== "canvas-pointer") {
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      lastCanvasPosRef.current = null;
      processNewEvent(x, y, 0, 0, "up");
    },
    [captureSource, processNewEvent]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (captureSource !== "canvas-pointer") {
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      processNewEvent(x, y, e.deltaX, e.deltaY, "wheel");
    },
    [captureSource, processNewEvent]
  );

  // シミュレーター要素用汎用ポインタハンドラ
  const handleGenericPointerMove = useCallback(
    (clientX: number, clientY: number, movementX: number, movementY: number) => {
      if (captureSource !== "canvas-pointer" || !isCapturing) {
        return;
      }
      processNewEvent(Math.round(clientX), Math.round(clientY), movementX, movementY, "move");
    },
    [captureSource, isCapturing, processNewEvent]
  );

  const handleGenericWheel = useCallback(
    (clientX: number, clientY: number, deltaX: number, deltaY: number) => {
      if (captureSource !== "canvas-pointer" || !isCapturing) {
        return;
      }
      processNewEvent(Math.round(clientX), Math.round(clientY), deltaX, deltaY, "wheel");
    },
    [captureSource, isCapturing, processNewEvent]
  );

  // リセット
  const clearTrace = useCallback(() => {
    setPoints([]);
    setLogs([]);
    totalDistanceRef.current = 0;
    maxHzRef.current = 0;
    maxSpeedRef.current = 0;
    eventCountRef.current = 0;
    eventTimestampsRef.current = [];
    dtsRef.current = [];
    accumulatedXRef.current = 0;
    accumulatedYRef.current = 0;
    smoothedDxRef.current = 0;
    smoothedDyRef.current = 0;
    setSimulatedScroll({
      scrollX: 0,
      scrollY: 0,
      lastDeltaX: 0,
      lastDeltaY: 0,
      seq: 0,
    });
    setMetrics(INITIAL_METRICS);
  }, []);

  return {
    captureSource,
    setCaptureSource,
    isCapturing,
    setIsCapturing,
    points,
    logs,
    metrics,
    scrollConfig,
    setScrollConfig,
    simulatedScroll,
    clearTrace,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleGenericPointerMove,
    handleGenericWheel,
  };
}
