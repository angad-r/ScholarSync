import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock Notification API for jsdom
class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = async () => 'granted';
  constructor(public title: string, public options?: any) {}
}

(window as any).Notification = MockNotification;
