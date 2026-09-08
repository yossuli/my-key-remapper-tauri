import { DEFAULT_PROFILE } from "@/mock/defaultProfiles";
import { getMockState, saveMockState } from "@/mock/mockStorage";
import type { ProfileListResponse } from "@/types/profile";
import type {
  Binding,
  GlobalSettings,
  Layer,
  MacroDef,
  RemapConfig,
  Trigger,
} from "@/types/remapConfig";

const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;
const INITIAL_COUNTER = 2;
const INCREMENT_STEP = 1;
const JSON_FILE_EXTENSION_REGEX = /\.json$/i;

// biome-ignore lint/suspicious/noExplicitAny: モックイベントペイロード用
type MockListener = (event: { payload: any }) => void;
const eventListeners = new Map<string, Set<MockListener>>();

/**
 * モックイベントを登録リスナーに配信します
 */
// biome-ignore lint/suspicious/noExplicitAny: モックイベント引数
export function emitMockEvent(channel: string, payload: any): void {
  const listeners = eventListeners.get(channel);
  if (!listeners) {
    return;
  }
  for (const callback of listeners) {
    try {
      callback({ payload });
    } catch (err) {
      console.error(
        `モックイベント処理中にエラーが発生しました (${channel}):`,
        err
      );
    }
  }
}

/**
 * モックイベントのリスナーを登録します
 */
export function mockListen(
  channel: string,
  callback: MockListener
): () => void {
  let listeners = eventListeners.get(channel);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(channel, listeners);
  }
  listeners.add(callback);

  return () => {
    listeners?.delete(callback);
  };
}

/**
 * 重複しないプロファイル名を生成します
 */
function generateUniqueProfileName(
  baseName: string,
  existingProfiles: Record<string, RemapConfig>
): string {
  let uniqueName = baseName;
  let counter = INITIAL_COUNTER;
  while (existingProfiles[uniqueName]) {
    uniqueName = `${baseName}-${counter}`;
    counter += INCREMENT_STEP;
  }
  return uniqueName;
}

/**
 * インポートされたJSONファイルを解析・保存します
 */
async function parseAndSaveImportedProfile(
  file: File
): Promise<ProfileListResponse | null> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as RemapConfig;
    if (!(parsed && Array.isArray(parsed.layers))) {
      console.warn("有効なキーリマップ設定ファイルではありません。");
      return null;
    }

    const state = getMockState();
    const rawBase = file.name.replace(JSON_FILE_EXTENSION_REGEX, "").trim();
    const baseName = rawBase || "imported";
    const uniqueName = generateUniqueProfileName(baseName, state.profiles);

    state.profiles[uniqueName] = parsed;
    state.activeProfile = uniqueName;
    saveMockState(state);

    return {
      profiles: Object.keys(state.profiles).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      ),
      activeProfile: uniqueName,
    };
  } catch (err) {
    console.error("ファイル読み込みエラー:", err);
    return null;
  }
}

/**
 * モックインポートダイアログ（ブラウザのファイル選択）
 */
function promptImportFile(): Promise<ProfileListResponse | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const result = await parseAndSaveImportedProfile(file);
      resolve(result);
    };

    input.oncancel = () => {
      resolve(null);
    };

    input.click();
  });
}

// -------------------------------------------------------------
// 個別コマンドハンドラーの定義 (認知複雑度の抑制のためマップ化)
// -------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: モック引数
type CommandHandler = (args: any) => Promise<any> | any;

const commandHandlers: Record<string, CommandHandler> = {
  "get-mappings": () => {
    const state = getMockState();
    return state.profiles[state.activeProfile];
  },

  "update-global-settings": (args: { settings?: Partial<GlobalSettings> }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    if (config && args?.settings) {
      config.globalSettings = {
        ...config.globalSettings,
        ...args.settings,
      };
      saveMockState(state);
    }
  },

  "get-layer-stack": () => {
    const state = getMockState();
    return state.layerStack;
  },

  "get-pressed-keys": () => [],

  "get-macros": () => {
    const state = getMockState();
    return state.profiles[state.activeProfile]?.macros ?? [];
  },

  "save-macros": (args: { macros?: MacroDef[] }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    if (config && args?.macros) {
      config.macros = args.macros;
      saveMockState(state);
    }
  },

  "release-all-keys": () => {
    // モックでは何もしない
  },

  "get-screen-size": () => ({
    width:
      typeof window !== "undefined" ? window.innerWidth : DEFAULT_SCREEN_WIDTH,
    height:
      typeof window !== "undefined"
        ? window.innerHeight
        : DEFAULT_SCREEN_HEIGHT,
  }),

  "get-cursor-position": () => ({ x: 0, y: 0 }),

  "set-debug-log-enabled": () => {
    // モックでは何もしない
  },

  "save-key-config": (args: {
    layerId: string;
    from: number;
    binding: Binding;
  }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    const layer = config?.layers.find((l) => l.id === args.layerId);
    if (layer) {
      const fromKey = args.from;
      const existing = layer.bindings[fromKey] ?? [];
      layer.bindings[fromKey] = [
        ...existing.filter((b) => b.trigger !== args.binding.trigger),
        args.binding,
      ];
      saveMockState(state);
    }
  },

  "remove-binding": (args: {
    layerId: string;
    from: number;
    trigger: Trigger;
  }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    const layer = config?.layers.find((l) => l.id === args.layerId);
    if (layer?.bindings[args.from]) {
      layer.bindings[args.from] = layer.bindings[args.from].filter(
        (b) => b.trigger !== args.trigger
      );
      if (layer.bindings[args.from].length === 0) {
        delete layer.bindings[args.from];
      }
      saveMockState(state);
    }
  },

  "add-layer": (args: { layerId: string }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    if (config && !config.layers.some((l) => l.id === args.layerId)) {
      config.layers.push({
        id: args.layerId,
        bindings: {},
      });
      config.layerOrder.push(args.layerId);
      saveMockState(state);
    }
  },

  "remove-layer": (args: { layerId: string }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    if (config) {
      config.layers = config.layers.filter((l) => l.id !== args.layerId);
      config.layerOrder = config.layerOrder.filter((id) => id !== args.layerId);
      saveMockState(state);
    }
  },

  "reorder-layers": (args: { newOrder: string[] }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    if (config && Array.isArray(args.newOrder)) {
      config.layerOrder = args.newOrder;
      saveMockState(state);
    }
  },

  "update-layer": (args: { layerId: string; updates: Partial<Layer> }) => {
    const state = getMockState();
    const config = state.profiles[state.activeProfile];
    const layer = config?.layers.find((l) => l.id === args.layerId);
    if (layer && config) {
      Object.assign(layer, args.updates);
      if (args.updates.id && args.updates.id !== args.layerId) {
        config.layerOrder = config.layerOrder.map((id) =>
          id === args.layerId ? (args.updates.id as string) : id
        );
      }
      saveMockState(state);
    }
  },

  "set-remap-enabled": (args: { enabled: boolean }) => {
    const state = getMockState();
    state.remapEnabled = args.enabled;
    saveMockState(state);
  },

  "get-remap-enabled": () => {
    const state = getMockState();
    return state.remapEnabled;
  },

  "reset-layer": (args: { layerId: string }) => {
    const state = getMockState();
    state.layerStack = [args.layerId];
    saveMockState(state);
    emitMockEvent("layer-stack-changed", { stack: [args.layerId] });
  },

  "list-profiles": (): ProfileListResponse => {
    const state = getMockState();
    return {
      profiles: Object.keys(state.profiles).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      ),
      activeProfile: state.activeProfile,
    };
  },

  "load-profile": (args: { profileName: string }) => {
    const state = getMockState();
    if (!state.profiles[args.profileName]) {
      throw new Error(`プロファイル '${args.profileName}' が見つかりません。`);
    }
    state.activeProfile = args.profileName;
    saveMockState(state);
    return state.profiles[args.profileName];
  },

  "create-profile": (args: { profileName: string }) => {
    const state = getMockState();
    const name = args.profileName.trim();
    if (state.profiles[name]) {
      throw new Error(`プロファイル '${name}' は既に存在します。`);
    }
    const newConfig: RemapConfig = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    newConfig.macros = JSON.parse(
      JSON.stringify(state.profiles[state.activeProfile]?.macros ?? [])
    );
    state.profiles[name] = newConfig;
    state.activeProfile = name;
    saveMockState(state);
    return newConfig;
  },

  "copy-profile": (args: { sourceName: string; newName: string }) => {
    const state = getMockState();
    const newName = args.newName.trim();
    if (state.profiles[newName]) {
      throw new Error(`プロファイル '${newName}' は既に存在します。`);
    }
    const source = state.profiles[args.sourceName];
    if (!source) {
      throw new Error(
        `コピー元のプロファイル '${args.sourceName}' が見つかりません。`
      );
    }
    state.profiles[newName] = JSON.parse(JSON.stringify(source));
    state.activeProfile = newName;
    saveMockState(state);
    return state.profiles[newName];
  },

  "copy-profile-with-dialog": (): ProfileListResponse => {
    const state = getMockState();
    const baseCandidate = `${state.activeProfile}-copy`;
    const candidate = generateUniqueProfileName(baseCandidate, state.profiles);

    const source = state.profiles[state.activeProfile];
    state.profiles[candidate] = JSON.parse(JSON.stringify(source));
    state.activeProfile = candidate;
    saveMockState(state);

    return {
      profiles: Object.keys(state.profiles).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      ),
      activeProfile: candidate,
    };
  },

  "delete-profile": (args: { profileName: string }): ProfileListResponse => {
    const state = getMockState();
    const keys = Object.keys(state.profiles);
    if (keys.length <= 1) {
      throw new Error("プロファイルが1つしかないため削除できません。");
    }
    if (!state.profiles[args.profileName]) {
      throw new Error(`プロファイル '${args.profileName}' が見つかりません。`);
    }

    delete state.profiles[args.profileName];
    if (state.activeProfile === args.profileName) {
      state.activeProfile = Object.keys(state.profiles)[0] || "default";
    }
    saveMockState(state);

    return {
      profiles: Object.keys(state.profiles).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      ),
      activeProfile: state.activeProfile,
    };
  },

  "export-profile-with-dialog": (args?: { profileName?: string }) => {
    const state = getMockState();
    const target = args?.profileName || state.activeProfile;
    const config = state.profiles[target];
    if (!config) {
      throw new Error(`プロファイル '${target}' が見つかりません。`);
    }

    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return `${target}.json`;
  },

  "import-profile-with-dialog": async () => await promptImportFile(),
};

/**
 * モック用 invoke ディスパッチャー
 */
export async function mockInvoke<T = unknown>(
  channel: string,
  // biome-ignore lint/suspicious/noExplicitAny: モック引数
  args?: Record<string, any>
): Promise<T> {
  const handler = commandHandlers[channel];
  if (!handler) {
    console.warn(`[Mock IPC] 未対応のチャンネルです: ${channel}`, args);
    return undefined as unknown as T;
  }
  return (await handler(args)) as T;
}

/**
 * モック用 send ディスパッチャー
 */
// biome-ignore lint/suspicious/noExplicitAny: モック引数
export async function mockSend(channel: string, payload?: any): Promise<void> {
  await mockInvoke(channel, payload);
}
