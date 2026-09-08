import {
  INITIAL_MOCK_ACTIVE_PROFILE,
  INITIAL_MOCK_PROFILES,
} from "@/mock/defaultProfiles";
import type {
  Binding,
  Layer,
  MacroDef,
  RemapConfig,
} from "@/types/remapConfig";

export interface MockState {
  profiles: Record<string, RemapConfig>;
  activeProfile: string;
  remapEnabled: boolean;
  layerStack: string[];
}

const STORAGE_KEY = "tauri_key_remapper_mock_state_v1";

// biome-ignore lint/suspicious/noExplicitAny: スキーママイグレーション用
function normalizeAction(action: any): any {
  if (!action || typeof action !== "object") {
    return action;
  }
  if (action.type === "remap" && !Array.isArray(action.keys)) {
    if (typeof action.to === "number") {
      const { to, ...rest } = action;
      return { ...rest, keys: [to] };
    }
    return { ...action, keys: [] };
  }
  return action;
}

function normalizeBinding(b: Binding): void {
  if (b?.action) {
    b.action = normalizeAction(b.action);
  }
}

function normalizeLayer(layer: Layer): void {
  if (!layer?.bindings || typeof layer.bindings !== "object") {
    return;
  }
  for (const bindings of Object.values(layer.bindings)) {
    if (Array.isArray(bindings)) {
      bindings.forEach(normalizeBinding);
    }
  }
}

function normalizeMacro(macro: MacroDef): void {
  if (Array.isArray(macro?.actions)) {
    macro.actions = macro.actions.map(normalizeAction);
  }
}

function normalizeProfile(config: RemapConfig): RemapConfig {
  if (!config || typeof config !== "object") {
    return config;
  }
  config.layers?.forEach(normalizeLayer);
  config.macros?.forEach(normalizeMacro);
  return config;
}

function createInitialState(): MockState {
  return {
    profiles: JSON.parse(JSON.stringify(INITIAL_MOCK_PROFILES)),
    activeProfile: INITIAL_MOCK_ACTIVE_PROFILE,
    remapEnabled: true,
    layerStack: ["base"],
  };
}

/**
 * localStorage からモックの状態を取得します。
 * 未保存または破損している場合はデフォルト状態を返して保存します。
 */
export function getMockState(): MockState {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialState();
      saveMockState(initial);
      return initial;
    }

    const parsed = JSON.parse(raw) as Partial<MockState>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.profiles ||
      !parsed.activeProfile
    ) {
      const initial = createInitialState();
      saveMockState(initial);
      return initial;
    }

    // 各プロファイルのマイグレーション・正規化
    const normalizedProfiles: Record<string, RemapConfig> = {};
    for (const [key, profile] of Object.entries(parsed.profiles)) {
      normalizedProfiles[key] = normalizeProfile(profile);
    }

    // 必要フィールドの整合性チェック・フォールバック
    const state: MockState = {
      profiles: normalizedProfiles,
      activeProfile: normalizedProfiles[parsed.activeProfile]
        ? parsed.activeProfile
        : Object.keys(normalizedProfiles)[0] || INITIAL_MOCK_ACTIVE_PROFILE,
      remapEnabled: parsed.remapEnabled ?? true,
      layerStack:
        Array.isArray(parsed.layerStack) && parsed.layerStack.length > 0
          ? parsed.layerStack
          : ["base"],
    };

    return state;
  } catch (error) {
    console.warn(
      "モックストレージの読み込みに失敗したため初期化します:",
      error
    );
    const initial = createInitialState();
    saveMockState(initial);
    return initial;
  }
}

/**
 * モック状態を localStorage に JSON として永続化します。
 */
export function saveMockState(state: MockState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("モックストレージの保存に失敗しました:", error);
  }
}

/**
 * モック状態を初期状態にリセットします。
 */
export function resetMockState(): MockState {
  const initial = createInitialState();
  saveMockState(initial);
  return initial;
}
