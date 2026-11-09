import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  afterEach(() => {
    delete window.Telegram;
  });

  it('degrades gracefully outside Telegram: no webApp, calls are no-ops, a sane colour scheme default', () => {
    delete window.Telegram;
    const service = new TelegramService();

    expect(service.isInsideTelegram).toBe(false);
    expect(['light', 'dark']).toContain(service.colorScheme());
    expect(() => service.setHeaderColor('#000')).not.toThrow();
    expect(() => service.disableVerticalSwipes()).not.toThrow();
    expect(() => service.notificationHaptic('success')).not.toThrow();
    expect(() => service.showBackButton(() => {})).not.toThrow();
  });

  it('reads colour scheme and safe areas from window.Telegram.WebApp when present', () => {
    window.Telegram = {
      WebApp: {
        colorScheme: 'dark',
        safeAreaInset: { top: 1, bottom: 2, left: 3, right: 4 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
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
      },
    };

    const service = new TelegramService();

    expect(service.isInsideTelegram).toBe(true);
    expect(service.colorScheme()).toBe('dark');
    expect(service.safeAreaInset()).toEqual({ top: 1, bottom: 2, left: 3, right: 4 });

    service.setHeaderColor('#0F1B2D');
    expect(window.Telegram.WebApp.setHeaderColor).toHaveBeenCalledWith('#0F1B2D');

    service.notificationHaptic('error');
    expect(window.Telegram.WebApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith('error');

    service.showBackButton(() => {});
    expect(window.Telegram.WebApp.BackButton.show).toHaveBeenCalled();
  });
});
