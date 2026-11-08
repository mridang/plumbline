import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import ts from 'typescript';

import { INTERACTIVE_SHARDS } from '@/domain/scan/run';
import { SCAN_DEAD_LETTER_NAME, SCAN_QUEUE_NAME } from '@/domain/suite/queue';

interface Wrangler {
  containers: {
    class_name: string;
    max_instances: number;
    instance_type?: string;
    image: string;
  }[];
  durable_objects: { bindings: { name: string; class_name: string }[] };
  migrations: { tag: string; new_sqlite_classes?: string[] }[];
  vars: Record<string, string>;
  queues: {
    producers: { binding: string; queue: string }[];
    consumers: {
      queue: string;
      max_concurrency?: number;
      max_batch_size?: number;
      dead_letter_queue?: string;
    }[];
  };
}

const config = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8'),
).config as Wrangler;

const consumer = config.queues.consumers.find(
  (entry) => entry.queue === SCAN_QUEUE_NAME,
);

describe('wrangler.jsonc, the scan queue', () => {
  it('has the producer binding the code sends through', () => {
    expect(config.queues.producers).toEqual([
      { binding: 'SCAN_QUEUE', queue: SCAN_QUEUE_NAME },
    ]);
  });

  it('runs no more jobs at once, with the page scans, than containers may run', () => {
    const max = config.containers[0]?.max_instances ?? 0;
    expect(
      (consumer?.max_concurrency ?? Infinity) + INTERACTIVE_SHARDS,
    ).toBeLessThanOrEqual(max);
  });

  it('takes one job for each consumer invocation and dead-letters to the queue that is logged', () => {
    expect(consumer?.max_batch_size).toBe(1);
    expect(consumer?.dead_letter_queue).toBe(SCAN_DEAD_LETTER_NAME);
    expect(
      config.queues.consumers.some(
        (entry) => entry.queue === SCAN_DEAD_LETTER_NAME,
      ),
    ).toBe(true);
  });
});

describe('wrangler.jsonc, the probe scanner', () => {
  const probe = config.containers.find(
    (entry) => entry.class_name === 'ProbeScanner',
  );

  it('keeps the probe on the smallest instance type, built from the probe image', () => {
    expect(probe?.instance_type).toBe('lite');
    expect(probe?.image).toBe('../../probe/Dockerfile');
  });

  it('runs no more jobs at once, with the page scans, than probe containers may run', () => {
    expect(
      (consumer?.max_concurrency ?? Infinity) + INTERACTIVE_SHARDS,
    ).toBeLessThanOrEqual(probe?.max_instances ?? 0);
  });

  it('binds the object the code picks and creates its class', () => {
    expect(config.durable_objects.bindings).toContainEqual({
      name: 'PROBE',
      class_name: 'ProbeScanner',
    });
    expect(
      config.migrations.some((entry) =>
        entry.new_sqlite_classes?.includes('ProbeScanner'),
      ),
    ).toBe(true);
  });

  it('picks the engine by a setting that is one of the two it knows', () => {
    expect(['container', 'worker']).toContain(config.vars['SCAN_ENGINE']);
  });
});
