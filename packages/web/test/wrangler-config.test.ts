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
  migrations: {
    tag: string;
    new_sqlite_classes?: string[];
    deleted_classes?: string[];
  }[];
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

const probe = config.containers.find(
  (entry) => entry.class_name === 'ProbeScanner',
);

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
    const max = probe?.max_instances ?? 0;
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

describe('wrangler.jsonc, the scanner', () => {
  it('has one container, the probe, on a small instance type (CPU, not memory, is its limit), built from the probe image', () => {
    expect(config.containers).toHaveLength(1);
    expect(probe?.instance_type).toBe('basic');
    expect(probe?.image).toBe('../../probe/Dockerfile');
  });

  it('binds the object the code uses, creates its class and deletes the class of the old scanner container', () => {
    expect(
      config.durable_objects.bindings.map((entry) => entry.name).sort(),
    ).toEqual(['PROBE', 'USER_HUB']);
    expect(config.durable_objects.bindings).toContainEqual({
      name: 'PROBE',
      class_name: 'ProbeScanner',
    });
    expect(
      config.migrations.some((entry) =>
        entry.new_sqlite_classes?.includes('ProbeScanner'),
      ),
    ).toBe(true);
    expect(
      config.migrations.some((entry) =>
        entry.deleted_classes?.includes('ScannerContainer'),
      ),
    ).toBe(true);
  });
});
