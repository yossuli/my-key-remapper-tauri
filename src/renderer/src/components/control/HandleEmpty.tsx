import React from "react";
import { Mapped } from "@/components/control/Mapped";
import { Else, Ternary, Then } from "@/components/control/Ternary";
import type { BaseProps } from ".";

type HandleEmptyProps<
  T,
  U extends React.ElementType = typeof React.Fragment,
> = BaseProps<
  U,
  {
    array: T[];
    empty?: React.ReactNode;
    children: (value: T, index: number, array: T[]) => React.ReactNode;
  }
>;

export const HandleEmpty = <
  T extends { id: string | number },
  U extends React.ElementType = typeof React.Fragment,
>({
  array,
  empty,
  children,
  as,
  ...props
}: HandleEmptyProps<T, U>) => {
  const Tag = as ?? React.Fragment;
  return (
    <Tag {...props}>
      <Ternary condition={array.length === 0}>
        <Then>{empty}</Then>
        <Else>
          <Mapped value={array}>{(elm, i) => children(elm, i, array)}</Mapped>
        </Else>
      </Ternary>
    </Tag>
  );
};
