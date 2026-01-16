import type React from "react";
import { Mapped } from "@/components/control/Mapped";
import { Else, Ternary, Then } from "@/components/control/Ternary";

interface HandleEmptyProps<T extends { id: string | number }> {
  array: T[];
  empty?: React.ReactNode;
  children: (value: T, index: number, array: T[]) => React.ReactNode;
}

export const HandleEmpty = <T extends { id: string | number }>({
  array,
  empty,
  children,
}: HandleEmptyProps<T>) => (
  <>
    <Ternary condition={array.length === 0}>
      <Then>{empty}</Then>
      <Else>
        <Mapped<T, typeof React.Fragment> value={array}>
          {(elm, i) => children(elm, i, array)}
        </Mapped>
      </Else>
    </Ternary>
  </>
);
