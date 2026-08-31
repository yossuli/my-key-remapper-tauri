export type CallbackFns<T, U extends keyof T, V> = {
  [K in T[U] extends string ? T[U] : never]: (
    k: T extends { [_ in U]: K } ? T : never
  ) => V;
};
type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

type LastOfUnion<T> =
  UnionToIntersection<T extends unknown ? () => T : never> extends () => infer R
    ? R
    : never;

type _MergeKey<T extends string, U extends string = T> = T extends string
  ? `${_MergeKey<Exclude<U, T>> extends [never]
      ? ""
      : `${_MergeKey<Exclude<U, T>>}-`}${T}`
  : T;

type MergeKey<T extends string, U extends string = T> = T extends never
  ? T
  : LastOfUnion<_MergeKey<U>> | MergeKey<Exclude<U, T>>;

type Split<T extends string> = T extends `${infer L}-${infer R}`
  ? L | Split<R>
  : T;

type MergeCallbackFns<
  U extends Record<string, unknown>,
  T extends keyof U & string,
  V,
  W extends string,
> = {
  [K in W]: (s: U extends { [_ in T]: Split<K> } ? U : never, k: Split<K>) => V;
};

export const objectiveMergeSwitch = <
  T extends keyof U extends string ? keyof U : never,
  // biome-ignore lint/suspicious/noExplicitAny: 汎用的な関数であるため
  U extends Record<string, any>,
  V,
  W extends string = MergeKey<T> extends unknown ? never : MergeKey<T>,
>(
  callbackFns: MergeCallbackFns<U, T, V, W>,
  value: U,
  key: T,
  interaction: Record<Split<W>, W>
): V =>
  callbackFns[interaction[value[key]]](
    // biome-ignore lint/suspicious/noExplicitAny: 型の怪しい部分をutilに押し込む
    value as any,
    // biome-ignore lint/suspicious/noExplicitAny: 型の怪しい部分をutilに押し込む
    interaction[value[key]] as any
  );

export const objectiveDiscriminantSwitch = <
  // biome-ignore lint/suspicious/noExplicitAny: 汎用的な関数であるため
  T extends Record<string, any>,
  U extends keyof T,
  V,
>(
  callbackFns: CallbackFns<T, U, V>,
  value: T,
  key: U
): V => {
  // biome-ignore lint/suspicious/noExplicitAny: 型の怪しい部分をutilに押し込む
  return callbackFns[value[key]](value as any);
};

export const objectiveDiscriminantPartialSwitch = <
  // biome-ignore lint/suspicious/noExplicitAny: 汎用的な関数であるため
  T extends Record<string, any>,
  U extends keyof T,
  V,
>(
  callbackFns: Partial<CallbackFns<T, U, V>>,
  value: T,
  key: U
): V | undefined => {
  const handler = callbackFns[value[key]];
  if (handler) {
    // biome-ignore lint/suspicious/noExplicitAny: 型の怪しい部分をutilに押し込む
    return handler(value as any);
  }
  return;
};

export const objectiveSwitch = <T extends string, V>(
  callbackFns: Record<T, () => V>,
  value: T
): V => callbackFns[value]();
