declare module 'react' {
  export = React;

  namespace React {
    type ReactNode = any;
    type MouseEvent<T = Element> = any;
    type MouseEventHandler<T = Element> = (event: MouseEvent<T>) => void;
    type CSSProperties = Record<string, string | number>;
    type HTMLAttributes<T> = Record<string, any>;
    type ButtonHTMLAttributes<T> = Record<string, any>;
    type InputHTMLAttributes<T> = Record<string, any>;
    type SelectHTMLAttributes<T> = Record<string, any>;
    type TableHTMLAttributes<T> = Record<string, any>;
    type ThHTMLAttributes<T> = Record<string, any>;
    type TdHTMLAttributes<T> = Record<string, any>;
    type LabelHTMLAttributes<T> = Record<string, any>;
    type ForwardedRef<T> = any;
    type Ref<T> = any;
    type ReactElement<P = any> = any;
    type ComponentProps<T> = Record<string, any>;

    interface FC<P = any> {
      (props: P): ReactElement | null;
    }

    function useState<T = any>(initialState: T): [T, (value: T | ((current: T) => T)) => void];
    function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    function useMemo<T>(factory: () => T, deps: any[]): T;
    function useRef<T = any>(value: T): { current: T };
    function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
    function useDeferredValue<T>(value: T): T;
    function useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T;
    function lazy<T = any>(factory: () => Promise<any>): T;
    function createContext<T>(defaultValue: T): any;
    function useContext<T = any>(context: any): T;
    function forwardRef<T = any, P = any>(render: (props: P, ref: ForwardedRef<T>) => ReactElement | null): any;
    function isValidElement(value: any): boolean;
    function cloneElement(element: any, props?: Record<string, any>, ...children: any[]): any;
    function startTransition(scope: () => void): void;

    const Children: {
      map(children: any, fn: (child: any) => any): any[];
    };

    const StrictMode: any;
    const Suspense: any;
  }
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: any): void;
  };
}

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}
