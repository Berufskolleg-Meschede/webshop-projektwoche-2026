import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('server runtime imports', () => {
  it('loads server/app.ts with native Node type stripping', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "await import('./server/app.ts')"],
      { encoding: 'utf8', timeout: 25000 }
    );

    expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    expect(result.status).toBe(0);
  }, 30000);
});
