import type { BlockStyle } from "../types";

export interface BlockProps {
  id?: string;
  style?: BlockStyle;
  [key: string]: unknown;
}

export interface BlockComponentProps<T = Record<string, unknown>> {
  props: T & BlockProps;
  products?: Record<string, unknown>;
  collections?: Record<string, unknown>;
}
