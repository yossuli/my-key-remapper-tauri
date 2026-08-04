# Props Flow Reference

このドキュメントは、アプリケーション全体のプロップス伝播フローを詳細に可視化した調査レポート兼設計図です。
「どのデータがどこで生成され、どのように運搬され、最終的にどこで消費されているか」を 1 項目も漏らさず正確に記録することを目的としています。

## 1. 凡例 (Legend)

| 記号 | 英語 (English) | 日本語 (Japanese) | 説明                                                                       |
| :--: | :------------- | :---------------- | :------------------------------------------------------------------------- |
|  🆕  | **Define**     | **定義・生成**    | このコンポーネントまたはフックで新しい値やインスタンスが生成されています。 |
|  📦  | **Pack**       | **グループ化**    | 伝搬効率や可読性のために、個別の値をオブジェクトにまとめています。         |
|  🎁  | **Pass Group** | **グループ渡し**  | Group オブジェクトのまま、変更せず子コンポーネントへ渡しています。         |
|  ∈   | **In Group**   | **グループ内包**  | 親の Group オブジェクトに含まれて渡されています。                          |
|  🔨  | **Unpack**     | **解体・展開**    | Group オブジェクトから値を分割代入 (Destructure) しています。              |
|  🚌  | **Drill**      | **通過 (Drill)**  | コンポーネント自身は使用せず、そのまま子へ渡しています (Prop Drilling)。   |
|  🔥  | **Use**        | **使用**          | ロジックやレンダリングで実際に値を使用しています。                         |
|  🧩  | **Individual** | **個別扱い**      | グループ化されず、個別のプロップスとして扱われています。                   |
|  🛑  | **Stop**       | **停止**          | 子コンポーネントへは渡されず、ここでフローが終了します。                   |
|  ➖  | **None**       | **関与なし**      | この項目とは無関係、または内部で完結しています。                           |

---

## 2. 定義参照 (Definition Reference)

`KeyRemapperPage.tsx` および主要 Organism で管理されている Prop Groups です。

| Type Name              | Source          | Included Props                                                                                              | Status |
| :--------------------- | :-------------- | :---------------------------------------------------------------------------------------------------------- | :----: |
| **`LayerState`**       | KeyRemapperPage | `layers`, `layerId`                                                                                         |   ✅   |
| **`LayerActions`**     | useLayerState   | `setLayerId`, `addLayer`, `removeLayer`, `reorderLayers`                                                    |   ✅   |
| **`MappingActions`**   | KeyRemapperPage | `saveMapping`, `removeMapping`                                                                              |   ✅   |
| **`RemapActions`**     | useRemapControl | `toggleActive`, `enableRemap`, `disableRemap`                                                               |   ✅   |
| **`KeyEditorActions`** | KeyEditorForm   | `addHoldKey`, `removeKey`, `resetState`, `handleSave`, `handleRemove`, `clearTargetKeys`                    |   ✅   |
| **`MouseHandlers`**    | KeyEditorForm   | `setMouseX`, `setMouseY`, `setMouseButton`, `setClickCount`, `setCursorReturnDelayMs`, `onGetMousePosition` |   ✅   |
| **`MouseState`**       | KeyEditorForm   | `x`, `y`, `button`, `clickCount`, `isCapturing`, `countdown`, `cursorReturnDelayMs`                         |   ✅   |

---

## 3. Master Propagation Matrix

### A. Main View Path

`KeyRemapperPage` → `KeyRemapSection` → (`LayerTabs`, `KeyboardGrid` → `KeyButton`)

| Prop / Group               | Page | Section | Tabs | Grid | Button | 備考           |
| :------------------------- | :--: | :-----: | :--: | :--: | :----: | :------------- |
| **[Group] LayerState**     | 🆕📦 |   🎁    | 🔥🔨 |  🎁  |  ∈🔥   |                |
| **[Group] LayerActions**   |  🆕  |   🎁    | 🔥🔨 |  ➖  |   ➖   | rest 展開/受取 |
| **[Group] MappingActions** | 🆕📦 |   🎁    |  ➖  |  🎁  |  ∈🔥   |                |
| **[Group] RemapActions**   |  🆕  |   🎁    |  ➖  |  ➖  |   ➖   | rest 展開/受取 |
| `layout`                   |  🆕  |   🚌    |  ➖  |  🚌  |   🔥   |                |
| `keyboardLayout`           |  🆕  |   🚌    |  ➖  |  🔥  |   ➖   | Grid で使用    |
| `bindings`                 |  🆕  |   🚌    |  ➖  |  🔥  |   ➖   | Grid で使用    |
| `selectedTrigger`          |  🆕  |   🔥    |  ➖  |  🔥  |   🔥   |                |
| `editingKey`               |  🆕  |   ➖    |  ➖  |  ➖  |   ➖   | Modal 制御用   |
| `onLayoutToggle`           |  🆕  |   🔥    |  ➖  |  ➖  |   ➖   | Section で消費 |
| `onTriggerChange`          |  🆕  |   🔥    |  ➖  |  ➖  |   ➖   | Section で消費 |
| `setEditingKey`            |  🆕  |   🔥    |  ➖  |  ➖  |   ➖   | KeyClick 経由  |

### B. Editor Modal Path

`KeyRemapperPage` → `KeyEditorForm` → (`ActionSettingsSection` → `RemapKeySection`, `TimingSettingsSection`, `MousePositionInput`)

| Prop / Group                 | Page | Editor | ActionS | RemapK | TimingS | MouseI |
| :--------------------------- | :--: | :----: | :-----: | :----: | :-----: | :----: | ----------- |
| `targetVk`                   |  🆕  |   🔥   |   🚌    |   🔥   |   ➖    |   ➖   |
| `layerId`                    |  🆕  |   🔥   |   🚌    |   ➖   |   ➖    |   ➖   |
| `layout`                     |  🆕  |   🔥   |   🚌    |   🔥   |   ➖    |   ➖   |
| `layers`                     |  🆕  |   🔥   |   🚌    |   ➖   |   ➖    |   ➖   |
| `trigger`                    |  🆕  |   🔥   |   ➖    |   ➖   |   ➖    |   ➖   |
| **[Group] KeyEditorActions** |  ➖  |  🆕📦  |   🎁    |  🔥🔨  |   ➖    |   ➖   |
| **[Group] MouseState**       |  ➖  |  🆕📦  |   🎁    |   ➖   |   ➖    |  🔥🔨  |
| **[Group] MouseHandlers**    |  ➖  |  🆕📦  |   🎁    |   ➖   |   ➖    |  🔥🔨  |
| `defaultHoldThresholdMs`     |  ➖  |   🆕   |   🚌    |   ➖   |   🔥    |   ➖   | GS より導出 |
| `defaultTapIntervalMs`       |  ➖  |   🆕   |   🚌    |   ➖   |   🔥    |   ➖   | GS より導出 |

### C. Utility & Peripheral Flow (Direct / Hybrid)

`KeyRemapperPage` → 各種独立コンポーネント (`AppHeader`, `LayerStatusPanel`, `LogList` etc.)

| Prop / Group         | Page | Header | StatusP | LogList | GlobalF | PressedK | 備考           |
| :------------------- | :--: | :----: | :-----: | :-----: | :-----: | :------: | :------------- |
| `isActive`           |  🆕  |   🔥   |   ➖    |   ➖    |   ➖    |    ➖    |                |
| `simpleMode`         |  🆕  |   🔥   |   ➖    |   ➖    |   ➖    |    ➖    |                |
| `onToggleActive`     |  🆕  |   🔥   |   ➖    |   ➖    |   ➖    |    ➖    |                |
| `onToggleSimpleMode` |  🆕  |   🔥   |   ➖    |   ➖    |   ➖    |    ➖    |                |
| `onOpenSettings`     |  🆕  |   🔥   |   ➖    |   ➖    |   ➖    |    ➖    |                |
| `availableLayers`    |  🆕  |   ➖   |   🔥    |   ➖    |   ➖    |    ➖    | Derived State  |
| `layout`             |  🆕  |   ➖   |   ➖    |   ➖    |   ➖    |    🔥    |                |
| **Internal Hooks**   |  ➖  |   ➖   |   🆕    |   🆕    |   🆕    |    ➖    | Self-contained |
| 🔥                   |

---

## 4. Leaf Decomposition Flow

末端コンポーネントでの詳細なプロップス受信・解体状況を記録します。

### KeyButton

| Member (from Group/Indiv) | Source (KeyboardGrid) | Use in KeyButton       |
| :------------------------ | :-------------------: | :--------------------- |
| `keyDef`                  |          🆕           | ラベル表示, VK 判定    |
| `layerId`                 |           ∈           | レイヤー固有ラベル判定 |
| `bindings`                |           ∈           | リマップ済みバッジ表示 |
| `layout`                  |          🚌           | キー形状/位置計算      |
| `selectedTrigger`         |          🚌           | 表示フィルタリング     |

### RemapKeySection

| Member (from Group)   | Source (ActionSettingsSection) | Use in RemapKeySection              |
| :-------------------- | :----------------------------: | :---------------------------------- |
| `keyEditorActions`    |              🎁🔨              | `handleSave`, `addHoldKey`          |
| `keyEditorState`      |              🎁🔨              | `showVkInput`, `vkInputValue`       |
| `keyEditorUIHandlers` |              🎁🔨              | `setShowVkInput`, `setVkInputValue` |

---

## 5. 調査結果まとめと設計指針 (Conclusion)

- **Smart 化と Reprop 化の共存**: Page 全体のレイアウト（Show）に依存するものはプロップス経由とし、機能的に独立可能なものはフック内部解決とする Hybrid 構成が最短経路であることを確認。
- **Prop Grouping の積極活用**: 3 階層以上にわたる伝播におけるバケツリレー（🚌）のメンテナンス負担を、Grouping（🎁）により軽減。
- **今後の課題**: `selectedTrigger` や `layout` のような「ほぼ全てのコンポーネントが関心を持つ」低頻度更新な状態については、さらなる最適化（Context 等）の余地を常にモニタリングする。
