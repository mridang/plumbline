import { describe, expect, it } from '@jest/globals';

import { AccountMenuItems, Avatar } from '@/components/site/account-menu';
import { html } from '../render';

describe('AccountMenuItems', () => {
  const out = html(
    <AccountMenuItems
      email="ada@example.com"
      onNotifications={() => undefined}
      onSignOut={() => undefined}
    />,
  );

  it('says which account is signed in', () => {
    expect(out).toContain('ada@example.com');
  });

  it('holds the GitHub connection, connecting an assistant, notifications and sign out', () => {
    expect(out).toContain('href="/github"');
    expect(out).toContain('href="/connect"');
    expect(out).toContain('Connect MCP');
    expect(out).toContain('Notifications');
    expect(out).toContain('Sign out');
  });
});

describe('Avatar', () => {
  it('shows the photo, without a referrer', () => {
    const out = html(
      <Avatar name="Ada" picture="https://photos.example/a.jpg" />,
    );
    expect(out).toContain('src="https://photos.example/a.jpg"');
    expect(out).toContain('referrerPolicy="no-referrer"');
  });

  it('shows the first letter when there is no photo', () => {
    expect(html(<Avatar name="ada" />)).toContain('>A<');
  });
});
