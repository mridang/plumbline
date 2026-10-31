import { describe, expect, it } from '@jest/globals';
import { DEFAULT_OUT, parseCommand, UsageError } from '../src/args.js';

describe('parseCommand', () => {
  it('asks for help when given nothing', () => {
    expect(parseCommand([])).toEqual({ kind: 'help' });
  });

  it.each([['--help'], ['-h']])('reads %s as help', (flag) => {
    expect(parseCommand([flag])).toEqual({ kind: 'help' });
  });

  it.each([['--version'], ['-v']])('reads %s as version', (flag) => {
    expect(parseCommand([flag])).toEqual({ kind: 'version' });
  });

  it('lets --help win over a mistake next to it', () => {
    expect(parseCommand(['nonsense', '--help'])).toEqual({ kind: 'help' });
  });

  it('fills in the scan defaults', () => {
    expect(parseCommand(['scan', 'example.com'])).toEqual({
      kind: 'scan',
      target: 'example.com',
      format: 'text',
      only: [],
      skip: [],
      groups: [],
      failOn: 'error',
      out: DEFAULT_OUT,
      browser: undefined,
      sandbox: true,
    });
  });

  it('reads every scan option', () => {
    expect(
      parseCommand([
        'scan',
        'https://example.com/',
        '--format',
        'json',
        '--only',
        'csp,hsts',
        '--only',
        'x-frame-options',
        '--skip',
        'tls-version',
        '-g',
        'owasp, tls',
        '--fail-on',
        'warning',
        '-o',
        'reports',
        '--browser',
        '/bin/chrome',
        '--no-sandbox',
      ]),
    ).toEqual({
      kind: 'scan',
      target: 'https://example.com/',
      format: 'json',
      only: ['csp', 'hsts', 'x-frame-options'],
      skip: ['tls-version'],
      groups: ['owasp', 'tls'],
      failOn: 'warning',
      out: 'reports',
      browser: '/bin/chrome',
      sandbox: false,
    });
  });

  it('drops empty entries from a list', () => {
    const command = parseCommand(['scan', 'a.test', '--only', 'csp,,']);
    expect(command).toMatchObject({ only: ['csp'] });
  });

  it('accepts the html format for scan', () => {
    expect(parseCommand(['scan', 'a.test', '-f', 'html'])).toMatchObject({
      format: 'html',
    });
  });

  it('accepts --fail-on none', () => {
    expect(parseCommand(['scan', 'a.test', '--fail-on', 'none'])).toMatchObject(
      { failOn: 'none' },
    );
  });

  it('refuses a scan without a target', () => {
    expect(() => parseCommand(['scan'])).toThrow(
      new UsageError('scan needs a URL or a domain to scan'),
    );
  });

  it('refuses a scan with two targets', () => {
    expect(() => parseCommand(['scan', 'a.test', 'b.test'])).toThrow(
      'scan takes one target (got also "b.test")',
    );
  });

  it('refuses an unknown format', () => {
    expect(() => parseCommand(['scan', 'a.test', '--format', 'xml'])).toThrow(
      '--format must be one of text, json, html (got "xml")',
    );
  });

  it('refuses an unknown --fail-on level', () => {
    expect(() => parseCommand(['scan', 'a.test', '--fail-on', 'hint'])).toThrow(
      '--fail-on must be one of error, warning, none (got "hint")',
    );
  });

  it('refuses an unknown option', () => {
    expect(() => parseCommand(['scan', 'a.test', '--bogus'])).toThrow(
      UsageError,
    );
  });

  it('refuses an option with its value missing', () => {
    expect(() => parseCommand(['scan', 'a.test', '--only'])).toThrow(
      UsageError,
    );
  });

  it('refuses an unknown command', () => {
    expect(() => parseCommand(['audit'])).toThrow('unknown command "audit"');
  });

  it('reads checks with its defaults', () => {
    expect(parseCommand(['checks'])).toEqual({
      kind: 'checks',
      groups: [],
      format: 'text',
    });
  });

  it('reads the checks options', () => {
    expect(
      parseCommand(['checks', '--group', 'tls,dns', '--format', 'json']),
    ).toEqual({ kind: 'checks', groups: ['tls', 'dns'], format: 'json' });
  });

  it('refuses the html format for checks', () => {
    expect(() => parseCommand(['checks', '--format', 'html'])).toThrow(
      '--format must be one of text, json (got "html")',
    );
  });

  it('refuses a scan option on checks', () => {
    expect(() => parseCommand(['checks', '--only', 'csp'])).toThrow(
      '--only only applies to scan',
    );
  });

  it('refuses an argument to checks', () => {
    expect(() => parseCommand(['checks', 'csp'])).toThrow(
      'checks takes no arguments (got "csp")',
    );
  });
});
