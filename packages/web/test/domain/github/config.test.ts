import { describe, expect, it } from '@jest/globals';

import { readGitHubConfig } from '@/domain/github/config';

const ALL = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_SLUG: 'plumbline',
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret',
  GITHUB_PRIVATE_KEY: 'key',
  GITHUB_WEBHOOK_SECRET: 'hook',
};

describe('readGitHubConfig', () => {
  it('reads the settings when every one is set', () => {
    expect(readGitHubConfig(ALL)).toEqual({
      appId: '1',
      slug: 'plumbline',
      clientId: 'id',
      clientSecret: 'secret',
      privateKey: 'key',
      webhookSecret: 'hook',
    });
  });

  it.each(Object.keys(ALL))('is null without %s', (name) => {
    expect(readGitHubConfig({ ...ALL, [name]: undefined })).toBeNull();
    expect(readGitHubConfig({ ...ALL, [name]: '' })).toBeNull();
  });
});
