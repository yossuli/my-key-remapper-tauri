import type { JSX } from "react";
import React from "react";
import { type BaseProps, findWithComponentType } from ".";

interface TernaryProps {
  condition: boolean;
  children: [JSX.Element, JSX.Element];
}

export const Then = <T extends React.ElementType = typeof React.Fragment>({
  children,
  as,
  ...props
}: BaseProps<T>) => {
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children}</Tag>;
};

export const Else = <T extends React.ElementType = typeof React.Fragment>({
  children,
  as,
  ...props
}: BaseProps<T>) => {
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children}</Tag>;
};

export const Ternary = ({ condition, children }: TernaryProps) =>
  findWithComponentType(children, condition ? Then : Else);
