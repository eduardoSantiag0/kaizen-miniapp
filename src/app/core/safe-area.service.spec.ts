import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SafeAreaService } from './safe-area.service';

describe('SafeAreaService', () => {
  afterEach(() => {
    delete window.Telegram;
  });

  it('writes contentSafeAreaInset as --kz-content-safe-* CSS variables on <html>', () => {
    const service = TestBed.inject(SafeAreaService);
    service.apply({ top: 44, bottom: 12, left: 0, right: 0 });

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--kz-content-safe-top').trim()).toBe('44px');
    expect(style.getPropertyValue('--kz-content-safe-bottom').trim()).toBe('12px');
    expect(style.getPropertyValue('--kz-content-safe-left').trim()).toBe('0px');
    expect(style.getPropertyValue('--kz-content-safe-right').trim()).toBe('0px');
  });

  it('writes viewportStableHeight as --kz-viewport-height in px', () => {
    const service = TestBed.inject(SafeAreaService);
    service.applyViewportHeight(760);

    expect(document.documentElement.style.getPropertyValue('--kz-viewport-height').trim()).toBe('760px');
  });

  it('leaves --kz-viewport-height at its CSS fallback (100dvh) when null (outside Telegram)', () => {
    const service = TestBed.inject(SafeAreaService);
    document.documentElement.style.removeProperty('--kz-viewport-height');

    service.applyViewportHeight(null);

    expect(document.documentElement.style.getPropertyValue('--kz-viewport-height').trim()).toBe('');
  });

  it('reflects a non-zero Telegram contentSafeAreaInset.top reactively', () => {
    window.Telegram = {
      WebApp: {
        initData: 'query_id=AAH&user=%7B%22id%22%3A1%7D', // non-empty: real Telegram, not the standalone script's stub
        colorScheme: 'dark',
        safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: { top: 56, bottom: 0, left: 0, right: 0 },
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
      },
    };

    TestBed.inject(SafeAreaService);
    TestBed.inject(ApplicationRef).tick();

    expect(document.documentElement.style.getPropertyValue('--kz-content-safe-top').trim()).toBe('56px');
  });
});
