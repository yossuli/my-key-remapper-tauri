export interface KeyDefinition {
  id: number;
  label: string;
  vk: number | number[];
  /** 幅（1 = 標準キー） */
  width?: number;
  /** CSSグリッドのエリア指定用 */
  code?: string;
}

export type KeyboardLayout = {
  id: number;
  row: KeyDefinition[];
}[];

export interface SimpleKeyboardProps {
  mappings: Map<number, number>;
  onKeyClick: (vk: number) => void;
}

export type LayoutType = "US" | "JIS";

export type LayerType = "base" | "custom";

// biome-ignore lint/suspicious/noExplicitAny: 汎用性のため
export type AddPrefix<T extends Record<string, any>, U extends string> = {
  [K in keyof T as `${U}${K extends string ? K : never}`]: T[K];
};
