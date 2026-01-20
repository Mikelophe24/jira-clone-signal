import { signalStore, withState, withMethods, patchState, withHooks } from '@ngrx/signals';
import { effect } from '@angular/core';

type ThemeState = {
  isDark: boolean;
};

const initialState: ThemeState = {
  isDark: false, // Default to Light mode
};

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    toggleTheme: () => {
      patchState(store, { isDark: !store.isDark() });
    },
    setTheme: (isDark: boolean) => {
      patchState(store, { isDark });
    },
  })),
  withHooks({
    onInit(store) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        patchState(store, { isDark: true });
      } else if (savedTheme === 'light') {
        patchState(store, { isDark: false });
      }

      effect(() => {
        const isDark = store.isDark();
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        if (isDark) {
          document.documentElement.classList.add('dark-theme');
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark-theme');
          document.documentElement.setAttribute('data-theme', 'light');
        }
      });
    },
  }),
);
