/**
 * Store: context + useReducer. Action helpers add the time from the system clock here,
 * so the reducer itself stays deterministic. Mirrors the view in the URL hash.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Clock } from '@core';
import { formulary } from '../data';
import { derive, type Derived } from './derive';
import { initialState, makeReducer } from './reducer';
import type { Action, AppState, View } from './types';

/** The one place the UI reads the system time. */
export const systemClock: Clock = { now: () => new Date(Date.now()).toISOString().replace(/\.\d{3}Z$/, 'Z') };

const reducer = makeReducer(formulary);

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  derived: Derived;
}

const StoreContext = createContext<StoreValue | null>(null);

const VIEWS: View[] = ['start', 'reconcile', 'history'];

function viewFromHash(hash: string): View | null {
  const m = /^#\/(\w+)/.exec(hash);
  const v = m?.[1] as View | undefined;
  return v && VIEWS.includes(v) ? v : null;
}

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, dispatch] = useReducer(reducer, initial ?? initialState());
  const derived = useMemo(
    () => derive({ sources: state.sources, history: state.history, resolutions: state.resolutions }),
    [state.sources, state.history, state.resolutions],
  );

  // URL hash -> view (a view that needs a case falls back to Start inside the reducer)
  useEffect(() => {
    const sync = () => {
      const v = viewFromHash(window.location.hash);
      if (v) dispatch({ type: 'SET_VIEW', view: v });
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // view -> URL hash
  useEffect(() => {
    const want = `#/${state.view}`;
    if (window.location.hash !== want) window.history.replaceState(null, '', want);
  }, [state.view]);

  const value = useMemo(() => ({ state, dispatch, derived }), [state, derived]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used within StoreProvider');
  return v;
}
