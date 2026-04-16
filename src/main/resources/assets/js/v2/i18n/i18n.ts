import {useMemo} from 'react';

import {useStoreValue} from '../hooks/use-store';
import {$config} from '../state';
import {DEFAULT_PHRASES} from './defaults';

//
// * Types
//

type TranslateArg = string | number | boolean;

export type TranslateFn = (key: string, ...args: TranslateArg[]) => string;

//
// * Helpers
//

function interpolate(template: string, args: readonly TranslateArg[]): string {
  if (args.length === 0) return template;
  return template.replace(/{(\d+)}/g, (_, i: string) => {
    const value = args[Number(i)];
    return value == null ? '' : String(value);
  });
}

function lookup(key: string, phrases: Record<string, string> | undefined): string | undefined {
  return phrases?.[key] ?? DEFAULT_PHRASES[key];
}

//
// * Plain function — usable outside components (event handlers, action resolvers, tests)
//

export function translate(key: string, ...args: TranslateArg[]): string {
  const value = lookup(key, $config.get()?.phrases);
  if (value == null) return `#${key}#`;
  return interpolate(value, args);
}

//
// * Hook — subscribes to $config so components re-render when phrases change
//

export function useI18n(): TranslateFn {
  const config = useStoreValue($config);
  const phrases = config?.phrases;

  return useMemo<TranslateFn>(
    () =>
      (key, ...args) => {
        const value = lookup(key, phrases);
        if (value == null) return `#${key}#`;
        return interpolate(value, args);
      },
    [phrases],
  );
}
