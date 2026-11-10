import type { TelegramWebApp } from './telegram-webapp';
import { TelegramService } from './telegram.service';

/**
 * Telegram's official script (loaded unconditionally in index.html) always
 * creates window.Telegram.WebApp, even outside real Telegram — standalone/
 * browser loads get a real object back with empty initData and its own
 * defaults (colorScheme defaults to 'light' there), never `undefined`.
 * `delete window.Telegram` doesn't model that; this does.
 */
function mockWebApp(overrides: Partial<TelegramWebApp> = {}): TelegramWebApp {
  return {
    initData: '',
    colorScheme: 'light',
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    viewportHeight: 600,
    viewportStableHeight: 600,
    HapticFeedback: { notificationOccurred: jasmine.createSpy(), impactOccurred: jasmine.createSpy() },
    BackButton: {
      isVisible: false,
      show: jasmine.createSpy(),
      hide: jasmine.createSpy(),
      onClick: jasmine.createSpy(),
      offClick: jasmine.createSpy(),
    },
    onEvent: jasmine.createSpy(),
    offEvent: jasmine.createSpy(),
    setHeaderColor: jasmine.createSpy(),
    setBackgroundColor: jasmine.createSpy(),
    disableVerticalSwipes: jasmine.createSpy(),
    enableVerticalSwipes: jasmine.createSpy(),
    ready: jasmine.createSpy(),
    expand: jasmine.createSpy(),
    ...overrides,
  };
}

/** A real Telegram launch always has non-empty initData — the actual "inside Telegram" signal. */
const REAL_INIT_DATA = 'query_id=AAH&user=%7B%22id%22%3A1%7D';

describe('TelegramService', () => {
  afterEach(() => {
    delete window.Telegram;
  });

  it('degrades to defaults outside real Telegram, even though the standalone script still creates WebApp (regression)', () => {
    // The actual failure mode: webApp is NOT null/undefined here (the script
    // ran), and its stub colorScheme is 'light' — isInsideTelegram and the
    // dark default must come from initData being empty, not from webApp
    // being absent, or this degrades to whatever the stub happens to report.
    window.Telegram = { WebApp: mockWebApp({ colorScheme: 'light' }) };
    const service = new TelegramService();

    expect(service.isInsideTelegram).toBe(false);
    expect(service.colorScheme()).toBe('dark');
    expect(service.safeAreaInset()).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(service.viewportStableHeight()).toBeNull();
    expect(() => service.setHeaderColor('#000')).not.toThrow();
    expect(() => service.disableVerticalSwipes()).not.toThrow();
    expect(() => service.notificationHaptic('success')).not.toThrow();
    expect(() => service.showBackButton(() => {})).not.toThrow();
  });

  it('also degrades to defaults with no window.Telegram at all (e.g. the script failed to load)', () => {
    delete window.Telegram;
    const service = new TelegramService();

    expect(service.isInsideTelegram).toBe(false);
    expect(service.colorScheme()).toBe('dark');
  });

  it('ignores the OS/browser prefers-color-scheme outside real Telegram (regression: used to leak light mode through)', () => {
    window.Telegram = { WebApp: mockWebApp({ colorScheme: 'light' }) };
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true }) as MediaQueryList; // OS says "light"

    const service = new TelegramService();
    expect(service.colorScheme()).toBe('dark');

    window.matchMedia = originalMatchMedia;
  });

  it('reads colour scheme and safe areas from window.Telegram.WebApp when actually inside Telegram (non-empty initData)', () => {
    window.Telegram = {
      WebApp: mockWebApp({
        initData: REAL_INIT_DATA,
        colorScheme: 'dark',
        safeAreaInset: { top: 1, bottom: 2, left: 3, right: 4 },
        viewportStableHeight: 600,
      }),
    };

    const service = new TelegramService();

    expect(service.isInsideTelegram).toBe(true);
    expect(service.colorScheme()).toBe('dark');
    expect(service.safeAreaInset()).toEqual({ top: 1, bottom: 2, left: 3, right: 4 });
    expect(service.viewportStableHeight()).toBe(600);
    // Mobile Telegram opens minimized by default; the rest of the app assumes
    // the maximized height, so this must happen unprompted on construction.
    expect(window.Telegram!.WebApp.expand).toHaveBeenCalled();

    service.setHeaderColor('#0F1B2D');
    expect(window.Telegram!.WebApp.setHeaderColor).toHaveBeenCalledWith('#0F1B2D');

    service.notificationHaptic('error');
    expect(window.Telegram!.WebApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith('error');

    service.showBackButton(() => {});
    expect(window.Telegram!.WebApp.BackButton.show).toHaveBeenCalled();
  });

  it('viewportStableHeight defaults to null outside real Telegram (CSS dvh is the fallback there)', () => {
    window.Telegram = { WebApp: mockWebApp() };
    const service = new TelegramService();

    expect(service.viewportStableHeight()).toBeNull();
  });

  it('updates viewportStableHeight from the stable value on viewportChanged, ignoring the continuously-updating one', () => {
    let viewportChangedHandler: () => void = () => {};
    window.Telegram = {
      WebApp: mockWebApp({
        initData: REAL_INIT_DATA,
        onEvent: (eventType: string, callback: () => void) => {
          if (eventType === 'viewportChanged') viewportChangedHandler = callback;
        },
      }),
    };

    const service = new TelegramService();
    expect(service.viewportStableHeight()).toBe(600);

    // Simulate a transient resize (e.g. keyboard opening): viewportHeight dips mid-gesture,
    // viewportStableHeight ignores that and only reflects the settled value.
    window.Telegram.WebApp.viewportHeight = 380;
    window.Telegram.WebApp.viewportStableHeight = 560;
    viewportChangedHandler();

    expect(service.viewportStableHeight()).toBe(560);
  });
});
