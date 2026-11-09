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

  it('reflects a non-zero Telegram contentSafeAreaInset.top reactively', () => {
    window.Telegram = {
      WebApp: {
        colorScheme: 'dark',
        safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: { top: 56, bottom: 0, left: 0, right: 0 },
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
