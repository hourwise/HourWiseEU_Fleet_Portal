import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/index.css', 'utf8');
const rotaWorkspace = readFileSync('src/components/manager/RotaPlanningWorkspace.tsx', 'utf8');
const loginForm = readFileSync('src/components/auth/LoginForm.tsx', 'utf8');

describe('Batch 24 visual and form-control foundation', () => {
  it('defines semantic control tokens and an explicit shared input contract', () => {
    expect(styles).toContain('--hw-control-bg:');
    expect(styles).toContain('--hw-control-border:');
    expect(styles).toContain('--hw-control-placeholder:');
    expect(styles).toContain('--hw-control-focus:');
    expect(styles).toContain('.input,');
    expect(styles).toContain('.hw-select,');
    expect(styles).toContain('.hw-textarea {');
  });

  it('provides a low-specificity fallback for fragmented legacy controls', () => {
    expect(styles).toContain(':where(');
    expect(styles).toContain("input:not([type='button'])");
    expect(styles).toContain('select,');
    expect(styles).toContain('textarea');
    expect(styles).toContain('color-scheme: dark;');
  });

  it('covers interaction, status, autofill and native option states', () => {
    expect(styles).toContain(':hover:not(:disabled):not([readonly])');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('.input:disabled');
    expect(styles).toContain('.input[readonly]');
    expect(styles).toContain(".input[aria-invalid='true']");
    expect(styles).toContain('.hw-control-success');
    expect(styles).toContain(':-webkit-autofill');
    expect(styles).toContain('select.input option');
  });

  it('keeps dense staffing-pattern controls permanently identifiable', () => {
    expect(rotaWorkspace).toContain('className="hw-field-label">Pattern name');
    expect(rotaWorkspace).toContain('className="hw-field-label">Cycle length');
    expect(rotaWorkspace).toContain('className="hw-field-label mb-0">Cycle day');
    expect(rotaWorkspace).toContain('aria-label="People required"');
    expect(rotaWorkspace).toContain('className="hw-field-label">Run date');
    expect(rotaWorkspace).toContain('className="hw-field-label">Availability type');
  });

  it('adopts the autofill-safe contract on the dark authentication form', () => {
    expect(loginForm.match(/className="input /g)).toHaveLength(3);
  });
});
