import type React from "react";
import type { JSX } from "react";

export type BaseProps<
  T extends React.ElementType = typeof React.Fragment,
  // biome-ignore lint/suspicious/noExplicitAny: 汎用性を持たせるため
  U extends Record<string, any> = {
    children?: React.ReactNode;
  },
> = {
  as?: T;
} & U &
  Omit<React.ComponentProps<T>, keyof U>;

export const findWithComponentType = <
  T extends JSX.Element,
  // biome-ignore lint/suspicious/noExplicitAny: コンポーネント型の汎用性のため
  U extends React.FC<any>,
>(
  children: T[],
  component: U
) => children.find((C) => C.type === component);
