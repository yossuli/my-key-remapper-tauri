/**
 * 現在の動作環境がモックモード（ブラウザ完結モード）かどうかを判定します
 */
export function isMockMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // 1. URLクエリパラメータ (?mock=true / ?mock=false)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const mockParam = urlParams.get("mock");
    if (mockParam === "false") {
      return false;
    }
    if (mockParam === "true") {
      return true;
    }
  } catch {
    // URL解析不可時はフォールスルー
  }

  // 2. localStorage の明示的オーバーライド設定
  try {
    const storedMock = window.localStorage.getItem(
      "my_key_remapper_force_mock"
    );
    if (storedMock === "false") {
      return false;
    }
    if (storedMock === "true") {
      return true;
    }
  } catch {
    // localStorageアクセス不可時はフォールスルー
  }

  // 3. 環境変数 (VITE_MOCK)
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> })
      ?.env;
    if (env?.VITE_MOCK === "true") {
      return true;
    }
  } catch {
    // env参照不可時はフォールスルー
  }

  // 4. Tauri ランタイム環境が存在しない場合は自動でモックモード
  const isTauriRuntime =
    "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
  return !isTauriRuntime;
}
