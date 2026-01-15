import React from "react";
import type { BaseProps } from ".";

type MappedProps<
  T extends { id: string | number },
  U extends React.ElementType = typeof React.Fragment,
> = BaseProps<
  U,
  {
    value: readonly T[];
    children: (item: T, index: number, array: readonly T[]) => React.ReactNode;
  }
>;

export const Mapped = <
  T extends { id: string | number },
  U extends React.ElementType = typeof React.Fragment,
>({
  value,
  children,
  as,
  ...props
}: MappedProps<T, U>) => {
  const Tag = as ?? React.Fragment;
  return (
    <Tag {...props}>
      {value.map((item, index) => (
        <React.Fragment key={item.id}>
          {children(item, index, value)}
        </React.Fragment>
      ))}
    </Tag>
  );
};
