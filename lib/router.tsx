import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PartialWithUndefined, RestrictedURLProps } from './types.js';
import { urlObjectAssign, urlRhs, withWindow } from './util.js';
import { Matcher, regexParamMatcher } from './matcher.js';

interface ContextInterface {
  url: URL;
  matcher: Matcher;
}

type NavigationMethod = (
  partial: PartialWithUndefined<RestrictedURLProps>,
  options?: { data: unknown },
) => void;

type NavigateEventListener = (evt: NavigateEvent) => void;

export const RouterContext = createContext<null | ContextInterface>(null);

const navigationApiAvailable = typeof navigation !== 'undefined';

export const Router: FC<
  PropsWithChildren<{
    origin: string;
    hash?: string;
    pathname?: string;
    search?: string;
    matcher?: Matcher;
  }>
> = ({
  children,
  matcher = regexParamMatcher,
  search,
  hash,
  pathname,
  origin,
}) => {
  const [url, setUrl] = useState(() =>
    withWindow<URL, URL>(
      ({ location }) =>
        urlObjectAssign(new URL(location.origin), {
          search: search || location.search,
          hash: hash || location.hash,
          pathname: pathname || location.pathname,
        }),
      urlObjectAssign(new URL(origin), {
        search: search || '',
        hash: hash || '',
        pathname: pathname || '',
      }),
    ),
  );

  const setUrlIfChanged = useCallback((dest: string) => {
    setUrl((src) => (src.toString() !== dest ? new URL(dest) : src));
  }, []);

  useEffect(() => {
    // Navigation API
    if (navigationApiAvailable) {
      const navigateEventHandler: NavigateEventListener = (e) => {
        setUrlIfChanged(e.destination.url);
      };

      navigation.addEventListener(
        'navigate',
        navigateEventHandler as EventListener,
      );

      return () => {
        navigation.removeEventListener(
          'navigate',
          navigateEventHandler as EventListener,
        );
      };
    }

    // History API
    if (typeof window !== 'undefined') {
      const navigateEventHandler = (/* evt: PopStateEvent */): void => {
        setUrlIfChanged(window.location.href);
      };

      window.addEventListener('popstate', navigateEventHandler);

      return () => {
        window.removeEventListener('popstate', navigateEventHandler);
      };
    }

    // noop
    return () => {};
  }, [setUrlIfChanged]);

  return (
    <RouterContext.Provider value={{ url, matcher }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter() {
  const state = useContext(RouterContext);
  if (!state) {
    throw new Error('Must be used within a Router');
  }
  return state;
}

export function useLocation(): [
  URL,
  {
    push: NavigationMethod;
    replace: NavigationMethod;
    go: (offset?: number) => void;
    back: () => void;
  },
] {
  const { url } = useRouter();

  const navigateTo = useCallback(
    (
      partial: PartialWithUndefined<RestrictedURLProps>,
      options?: { replace?: boolean; data?: unknown },
    ) => {
      const { history } = window;
      const nextUrl = urlObjectAssign(new URL(url), partial);
      const nextRhs = urlRhs(nextUrl);

      if (options?.replace) {
        history.replaceState(options.data, '', nextRhs);
      } else {
        history.pushState(options?.data, '', nextRhs);
      }

      // pushState and replaceState don't trigger popstate event
      // this is only needed when there's no navigation API
      if (!navigationApiAvailable) {
        dispatchEvent(
          new PopStateEvent('popstate', {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            state: history.state,
          }),
        );
      }
    },
    [url],
  );

  const replace = useCallback(
    (
      partial: PartialWithUndefined<RestrictedURLProps>,
      { data }: { data?: unknown } = {},
    ) => {
      navigateTo(partial, {
        data,
        replace: true,
      });
    },
    [navigateTo],
  );

  const push = useCallback(
    (
      partial: PartialWithUndefined<RestrictedURLProps>,
      { data }: { data?: unknown } = {},
    ) => {
      navigateTo(partial, { data });
    },
    [navigateTo],
  );

  const go = useCallback((offset = 0) => {
    window.history.go(offset);
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  return [url, { replace, push, go, back }];
}
