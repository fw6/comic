import { useMemo, useState } from '@lynx-js/react';

export type Screen =
    | { name: 'main' } // drawer + library tabs
    | { name: 'sources' }
    | { name: 'search' }
    | { name: 'result'; keyword: string; sources: string[] }
    | { name: 'detail'; comicId: string }
    | {
          name: 'reader';
          comicId: string;
          chapterIndex: number;
          mode: 'page' | 'stream';
      }
    | { name: 'settings' }
    | { name: 'about' }
    | { name: 'backup' }
    | { name: 'chapters'; comicId: string }
    | { name: 'readerConfig' }
    | { name: 'sourceDetail'; sourceId: string }
    | { name: 'category'; sourceId: string; category: string }
    | { name: 'tagEditor'; comicId: string }
    | { name: 'eventSettings'; mode: 'page' | 'stream' }
    | { name: 'task'; comicId: string };

export interface NavState {
    stack: Screen[];
}

export interface NavApi {
    screen: Screen;
    push: (s: Screen) => void;
    pop: () => void;
    reset: (s: Screen) => void;
}

const INITIAL: NavState = { stack: [{ name: 'main' }] };

export function useNavigation(): NavApi {
    const [state, setState] = useState<NavState>(INITIAL);

    const api = useMemo<NavApi>(
        () => ({
            screen: state.stack[state.stack.length - 1],
            push: (s) => setState((prev) => ({ stack: [...prev.stack, s] })),
            pop: () =>
                setState((prev) =>
                    prev.stack.length > 1
                        ? { stack: prev.stack.slice(0, -1) }
                        : prev,
                ),
            reset: (s) => setState({ stack: [s] }),
        }),
        [state],
    );

    return api;
}
