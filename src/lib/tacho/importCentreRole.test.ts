import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

describe('tachograph Import Centre role', () => {
  const importCentre = readRepoFile('src/components/manager/tachograph/TachoImportCentre.tsx');
  const uploadZone = readRepoFile('src/components/manager/tachograph/TachoUploadZone.tsx');
  const helperPanel = readRepoFile('src/components/manager/tachograph/TachoReaderHelperPanel.tsx');
  const workspace = readRepoFile('src/components/manager/tachograph/TachoComplianceWorkspace.tsx');

  it('keeps VU and manual driver-card file import as the primary path', () => {
    expect(importCentre).toContain('Import Centre: VU Downloads And Manual Tacho Files');
    expect(importCentre).toContain('Primary Upload: VU And Manual Files');
    expect(uploadZone).toContain('Vehicle unit download / VU file');
    expect(uploadZone).toContain('Driver card file / fallback card upload');
  });

  it('routes normal live card work to Driver Card Analysis', () => {
    expect(importCentre).toContain('Normal live driver-card reading and automatic analysis routing belong in Driver Card Analysis');
    expect(workspace).toContain('Live driver-card reading and card analysis');
    expect(importCentre).not.toContain('Advanced: live driver-card reader helper');
  });

  it('contains helper support in technical-only mode and leaves VU live reading deferred', () => {
    expect(importCentre).toContain('Technical diagnostics: desktop helper setup and probing');
    expect(importCentre).toContain('<TachoReaderHelperPanel technicalOnly');
    expect(helperPanel).toContain('technicalOnly = false');
    expect(helperPanel).toContain('This panel does not start or route live card reads');
    expect(importCentre).toContain('Vehicle-unit live reading remains deferred until its helper/download path is production-ready');
  });
});
