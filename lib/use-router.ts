import { useCallback, useContext } from 'react';
import { RouterContext } from './Router.js';
import {
  ActionType,
  type Destination,
  type SyntheticNavigateEventListener,
} from './State.js';
import { type PartialWithUndefined, type RestrictedURLProps } from './types.js';
import { calculateUrl, popStateEventName, urlRhs, withWindow } from './util.js';

type SyntheticNavigationResult = {
  committed: Promise<void>;
  finished: Promise<void>;
};

const resolved = Promise.resolve();
const syntheticNavigationResult = {
  committed: resolved,
  finished: resolved,
};

export function useRouter() {
  const state = useContext(RouterContext);
  if (!state) {
    throw new Error('Must be used within a Router');
  }
  return state;
}

export function useRouterIntercept() {
  const [, dispatch] = useRouter();

  return useCallback(
    (listener: SyntheticNavigateEventListener) => {
      dispatch({
        type: ActionType.Hooks,
        intercept: listener,
      });

      return () => {
        dispatch({ type: ActionType.Hooks, intercept: undefined });
      };
    },
    [dispatch],
  );
}

export function useLocation() {
  const [{ url, useNavApi }] = useRouter();
  const hasNav = typeof navigation !== 'undefined' && useNavApi !== false;

  const navigate = useCallback(
    (
      href: PartialWithUndefined<RestrictedURLProps> | URL | string,
      options?: { history?: NavigationHistoryBehavior },
    ): NavigationResult | SyntheticNavigationResult => {
      const nextUrl = calculateUrl(href, url);

      // nav api
      if (hasNav) {
        return navigation.navigate(nextUrl.toString(), {
          ...(options?.history && { history: options.history }),
        });
      }

      // window
      return withWindow(({ history }) => {
        // we can only use push/replaceState for same origin
        if (nextUrl.origin === url.origin) {
          const nextRhs = urlRhs(nextUrl);

          if (options?.history === 'replace') {
            history.replaceState(null, '', nextRhs);
          } else {
            history.pushState(null, '', nextRhs);
          }

          // pushState and replaceState don't trigger popstate event
          dispatchEvent(new PopStateEvent(popStateEventName));
        } else {
          window?.location.assign(nextUrl);
        }

        return syntheticNavigationResult;
      }, syntheticNavigationResult);
    },
    [hasNav, url],
  );

  const back = useCallback(
    async (
      alternateHref?: Destination,
    ): Promise<NavigationResult | SyntheticNavigationResult> => {
      if (hasNav) {
        if (navigation.entries()?.length > 0) {
          return navigation.back();
        }

        if (alternateHref) {
          // No history entries, go directly to alternateHref
          return navigate(alternateHref, { history: 'replace' });
        }

        return navigation.back();
      }
      window?.history.back();
      return syntheticNavigationResult;
    },
    [hasNav, navigate],
  );

  return [url, { navigate, back }] as const;
}
