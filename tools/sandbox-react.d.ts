// Solo per l'ambiente di sviluppo senza accesso a npm: tipi minimi di React per controllare il resto del codice.
// Con `npm install` normale si usa @types/react e questo file non serve (vedi tsconfig.sandbox.json).
declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type CSSProperties = Record<string, string | number | undefined>;
  export type FC<P = {}> = (props: P) => ReactNode;
  export type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  export type Dispatch<A> = (a: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export function useState<T>(init: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  export function useState<T = undefined>(): [T | undefined, Dispatch<SetStateAction<T | undefined>>];
  export function useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(fn: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...a: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(init: T): { current: T };
  export function useRef<T>(init: T | null): { readonly current: T | null };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useId(): string;
  export function useReducer<S, A>(r: (s: S, a: A) => S, init: S): [S, Dispatch<A>];
  export interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; Consumer: any }
  export function createContext<T>(def: T): Context<T>;
  export function useContext<T>(c: Context<T>): T;
  export function useSyncExternalStore<T>(sub: (cb: () => void) => () => void, get: () => T, getServer?: () => T): T;
  export function startTransition(fn: () => void): void;
  export const Fragment: any;
  export const StrictMode: any;
  export type Ref<T> = { current: T | null } | ((el: T | null) => void) | null;
  interface BaseEvent<T> {
    currentTarget: T;
    target: any;
    preventDefault(): void;
    stopPropagation(): void;
    defaultPrevented: boolean;
  }
  export type ChangeEvent<T = Element> = BaseEvent<T> & { target: T & { value: string; checked: boolean; files: FileList | null; name: string } };
  export type FormEvent<T = Element> = BaseEvent<T>;
  export type MouseEvent<T = Element> = BaseEvent<T> & { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; clientX: number; clientY: number };
  export type KeyboardEvent<T = Element> = BaseEvent<T> & { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean };
  export type DragEvent<T = Element> = BaseEvent<T> & { dataTransfer: DataTransfer };
  export type HTMLAttributes<T> = Record<string, any>;
  export type ComponentProps<T> = any;
}
declare module 'react/jsx-runtime' {
  import type { ChangeEvent, FormEvent, MouseEvent, KeyboardEvent, DragEvent } from 'react';
  interface DomAttrs {
    [k: string]: any;
    onChange?: (e: ChangeEvent<any>) => void;
    onInput?: (e: FormEvent<any>) => void;
    onSubmit?: (e: FormEvent<any>) => void;
    onClick?: (e: MouseEvent<any>) => void;
    onMouseDown?: (e: MouseEvent<any>) => void;
    onKeyDown?: (e: KeyboardEvent<any>) => void;
    onDragOver?: (e: DragEvent<any>) => void;
    onDragLeave?: (e: DragEvent<any>) => void;
    onDrop?: (e: DragEvent<any>) => void;
  }
  export namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: any }
    interface IntrinsicElements { [name: string]: DomAttrs }
  }
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
declare module 'react-dom/client' {
  export function createRoot(el: Element | DocumentFragment): { render(n: any): void; unmount(): void };
}
