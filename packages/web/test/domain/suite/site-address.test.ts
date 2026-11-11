import { describe, expect, it } from '@jest/globals';

import { siteAddress } from '@/domain/suite/site-address';

describe('siteAddress', () => {
  it('takes the host of an https address, and of a bare host name', () => {
    expect(siteAddress('https://Marshall.Apps.Mrida.ng/path?x=1')).toEqual({
      ok: true,
      host: 'marshall.apps.mrida.ng',
    });
    expect(siteAddress('mrida.ng')).toEqual({ ok: true, host: 'mrida.ng' });
  });

  it('refuses an address that is not https', () => {
    expect(siteAddress('http://site.example.com')).toEqual({
      ok: false,
      reason: 'is not an https address',
    });
    expect(siteAddress('ftp://site.example.com')).toMatchObject({ ok: false });
  });

  it('refuses a GitHub address: an Actions job page is not the site that was deployed', () => {
    expect(
      siteAddress('https://github.com/mridang/plumbline/actions/runs/1/job/2'),
    ).toEqual({ ok: false, reason: 'is not a site (GitHub or a registry)' });
    expect(siteAddress('https://mridang.github.io/x')).toMatchObject({
      ok: false,
    });
  });

  it('refuses a package registry or app store', () => {
    expect(siteAddress('https://www.npmjs.com/package/x')).toMatchObject({
      ok: false,
    });
  });

  it('refuses what is not a public domain name', () => {
    expect(siteAddress('https://localhost/')).toMatchObject({ ok: false });
    expect(siteAddress('https://10.0.0.1/')).toMatchObject({ ok: false });
    expect(siteAddress('https://user:pass@site.example.com/')).toMatchObject({
      ok: false,
    });
  });

  it('refuses a value that is not an address at all', () => {
    expect(siteAddress('')).toMatchObject({ ok: false });
    expect(siteAddress(' '.repeat(3))).toMatchObject({ ok: false });
    expect(siteAddress(42)).toMatchObject({ ok: false });
    expect(siteAddress(undefined)).toMatchObject({ ok: false });
  });
});
