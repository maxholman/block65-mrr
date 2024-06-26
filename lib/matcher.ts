import type { ReactElement } from 'react';
import { parse } from 'regexparam';
import { pathCache } from './path-cache.js';
import type {
  ExtractRouteParams,
  Params,
  RouteComponentProps,
  RoutingProps,
} from './types.js';

export type Match<TPath extends string = '/'> =
  | MatchResult<ExtractRouteParams<TPath>>
  | false;

export interface MatchResult<P extends Params> {
  path: string;
  index: number;
  params: P;
}

export type Matcher = (
  component: ReactElement<RouteComponentProps>,
  pathname: string,
) => Match | false;

// const pathToRegexpCache = new Map<string, MatchFunction<DefaultRouteParams>>();

// export const pathToRegexpMatcher: Matcher = (
//   { props }: RouteComponent,
//   { pathname }: URL,
// ): MatchResult<DefaultRouteParams> | false => {
//   if (!props.path) {
//     return { index: 0, params: {}, path: '' };
//   }
//   const fn = pathCache(pathToRegexpCache, props.path, (k) =>
//     match<DefaultRouteParams>(k, {
//       decode: decodeURIComponent,
//     }),
//   );

//   return fn(pathname);
// };

const regexparamCache = new WeakMap<
  RoutingProps<string>,
  | {
      keys: string[];
      pattern: RegExp;
    }
  | {
      keys: false;
      pattern: RegExp;
    }
>();

function regexParamExec(path: string, keys: string[], pattern: RegExp) {
  const matches = (pattern.exec(path) || []).slice(1);
  return Object.fromEntries(matches.map((m, idx) => [keys[idx], m]));
}

export const regexParamMatcher: Matcher = ({ props }, pathname): Match => {
  if (!('path' in props)) {
    return { index: 0, params: {}, path: '' };
  }

  const { keys, pattern } = pathCache(
    regexparamCache,
    {
      path: props.path,
      wildcard: 'wildcard' in props && props.wildcard,
    },
    (p) => parse(p.path, !!p.wildcard),
  );

  if (pattern.test(pathname)) {
    return {
      index: 0,
      // apparently keys is always an array if parse input is a string
      // https://github.com/lukeed/regexparam#regexparamparseinput-string-loose-boolean
      params: regexParamExec(pathname, keys || [], pattern),
      path: pathname,
    };
  }

  return false;
};
