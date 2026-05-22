/**
 * Import utility for EC Builder JSON files.
 * Reads an ECCloud structure and extracts injections for use as FRT core injections.
 */

import { checkSchemaVersion } from './importJson.ts';

export type ECImportInjection = {
  id: string;
  text: string;
  targetAssumptionText?: string;
};

export type ECImportResult =
  | { ok: true; cloudTitle: string; injections: ECImportInjection[] }
  | { ok: false; error: string };

function validateECCloud(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string') return false;
  if (!Array.isArray(obj.injections)) return false;
  if (!Array.isArray(obj.assumptions)) return false;
  for (const inj of obj.injections) {
    if (typeof inj !== 'object' || inj === null) return false;
    const i = inj as Record<string, unknown>;
    if (typeof i.id !== 'string' || typeof i.text !== 'string') return false;
  }
  return true;
}

export function importECFromFile(file: File): Promise<ECImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const schema = checkSchemaVersion(parsed);
        if (!schema.ok) {
          resolve({ ok: false, error: schema.error });
          return;
        }
        if (!validateECCloud(parsed)) {
          resolve({
            ok: false,
            error: 'File does not contain a valid EC cloud. Expected fields: id, assumptions (array), injections (array with id, text).',
          });
          return;
        }
        const assumptions = parsed.assumptions as Array<Record<string, unknown>>;
        const assumptionMap = new Map<string, string>();
        for (const a of assumptions) {
          assumptionMap.set(a.id as string, a.text as string);
        }

        const rawInjections = parsed.injections as Array<Record<string, unknown>>;
        if (rawInjections.length === 0) {
          resolve({
            ok: false,
            error: 'EC cloud contains no injections. Complete the EC analysis first.',
          });
          return;
        }

        const injections: ECImportInjection[] = rawInjections.map((inj) => ({
          id: inj.id as string,
          text: inj.text as string,
          targetAssumptionText: assumptionMap.get(inj.targetAssumptionId as string),
        }));

        resolve({
          ok: true,
          cloudTitle: (parsed.title as string) ?? 'Untitled EC',
          injections,
        });
      } catch {
        resolve({ ok: false, error: 'File is not valid JSON.' });
      }
    };
    reader.onerror = () => {
      resolve({ ok: false, error: 'Failed to read file.' });
    };
    reader.readAsText(file);
  });
}
