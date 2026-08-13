import React from "react";
import type { BaseProps } from ".";

type ShowProps<T extends React.ElementType = typeof React.Fragment> = BaseProps<
  T,
  {
    condition: boolean;
    children?: React.ReactNode;
  }
>;

export const Show = <T extends React.ElementType = typeof React.Fragment>({
  condition,
  children,
  as,
  ...props
}: ShowProps<T>) => {
  if (!condition) {
    return null;
  }
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children}</Tag>;
};
