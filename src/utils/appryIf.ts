export const applyIf =
  <T>(condition: (value: T) => boolean, apply: (value: T) => T) =>
  (elm: T) =>
    condition(elm) ? apply(elm) : elm;
