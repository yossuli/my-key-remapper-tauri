import React from "react";
import { define } from "@/utils/define";
import type { BaseProps } from ".";

type WithProps<
  T,
  U extends React.ElementType = typeof React.Fragment,
> = BaseProps<
  U,
  {
    value: T | undefined | null;
    children: (value: T) => React.ReactNode;
  }
>;

export const With = <T, U extends React.ElementType = typeof React.Fragment>({
  value,
  children,
  as,
  ...props
}: WithProps<T, U>) => {
  if (!define(value)) {
    return null;
  }
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children(value)}</Tag>;
};
