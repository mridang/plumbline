import { describe, expect, it } from '@jest/globals';

import {
  NOTIFICATION_TOPICS,
  NotificationSettings,
} from '@/components/notifications/notification-settings';

import { html } from '../render';

describe('NotificationSettings', () => {
  it('says it is checking the browser until the browser has answered', () => {
    expect(html(<NotificationSettings />)).toContain('Checking this browser');
  });

  it('lists what a person will be told', () => {
    const markup = html(<NotificationSettings />);
    for (const topic of NOTIFICATION_TOPICS) {
      expect(markup).toContain(topic);
    }
  });
});
