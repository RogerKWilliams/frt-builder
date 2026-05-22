import { describe, it, expect } from 'vitest';
import { importTreeFromFile, checkSchemaVersion } from './importJson.ts';
import { importCRTFromFile } from './importCRT.ts';
import { importECFromFile } from './importEC.ts';

const baseTree = {
  id: 'tree-1',
  title: 'Test FRT',
  goal: 'Goal',
  nodes: [],
  edges: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const baseCRT = {
  id: 'crt-1',
  name: 'Test CRT',
  scopeStatement: 'Scope',
  nodes: [
    { id: 'u1', type: 'ude', text: 'UDE 1', position: { x: 0, y: 0 } },
  ],
  edges: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const baseEC = {
  id: 'cloud-1',
  title: 'Test EC',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  objective: 'A',
  requirementB: 'B',
  requirementC: 'C',
  prerequisiteD: 'D',
  prerequisiteDPrime: "D'",
  conflict: { description: 'conflict' },
  assumptions: [
    { id: 'a1', arrowId: 'A-B', text: 'a1', challenged: false, valid: null, challengeNotes: '' },
  ],
  injections: [
    { id: 'i1', targetAssumptionId: 'a1', text: 'injection 1', feasibilityNotes: '', sufficiencyNotes: '' },
  ],
};

function jsonFile(payload: unknown, name = 'file.json'): File {
  return new File([JSON.stringify(payload)], name, { type: 'application/json' });
}

describe('checkSchemaVersion', () => {
  it('accepts missing schemaVersion as v1 (back-compat)', () => {
    expect(checkSchemaVersion({ id: 'x' }).ok).toBe(true);
  });

  it('accepts schemaVersion: 1', () => {
    expect(checkSchemaVersion({ schemaVersion: 1 }).ok).toBe(true);
  });

  it('rejects schemaVersion: 2 with the descriptive error', () => {
    const result = checkSchemaVersion({ schemaVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('rejects non-numeric schemaVersion', () => {
    const result = checkSchemaVersion({ schemaVersion: '1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/must be a number/i);
  });
});

describe('importTreeFromFile schemaVersion handling', () => {
  it('accepts a file with no schemaVersion (back-compat)', async () => {
    const result = await importTreeFromFile(jsonFile(baseTree));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tree.schemaVersion).toBe(1);
  });

  it('accepts a file with schemaVersion: 1', async () => {
    const result = await importTreeFromFile(jsonFile({ ...baseTree, schemaVersion: 1 }));
    expect(result.ok).toBe(true);
  });

  it('rejects schemaVersion: 2 with the descriptive error', async () => {
    const result = await importTreeFromFile(jsonFile({ ...baseTree, schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('rejects non-numeric schemaVersion', async () => {
    const result = await importTreeFromFile(jsonFile({ ...baseTree, schemaVersion: '1' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/must be a number/i);
  });
});

describe('importCRTFromFile cross-tool schemaVersion handling', () => {
  it('accepts a CRT file with no schemaVersion (back-compat)', async () => {
    const result = await importCRTFromFile(jsonFile(baseCRT));
    expect(result.ok).toBe(true);
  });

  it('accepts a CRT file with schemaVersion: 1', async () => {
    const result = await importCRTFromFile(jsonFile({ ...baseCRT, schemaVersion: 1 }));
    expect(result.ok).toBe(true);
  });

  it('rejects a CRT file with schemaVersion: 2', async () => {
    const result = await importCRTFromFile(jsonFile({ ...baseCRT, schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });
});

describe('importECFromFile cross-tool schemaVersion handling', () => {
  it('accepts an EC file with no schemaVersion (back-compat)', async () => {
    const result = await importECFromFile(jsonFile(baseEC));
    expect(result.ok).toBe(true);
  });

  it('accepts an EC file with schemaVersion: 1', async () => {
    const result = await importECFromFile(jsonFile({ ...baseEC, schemaVersion: 1 }));
    expect(result.ok).toBe(true);
  });

  it('rejects an EC file with schemaVersion: 2', async () => {
    const result = await importECFromFile(jsonFile({ ...baseEC, schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });
});
