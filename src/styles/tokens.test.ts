/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf-8');

function declarations(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--BKM_WebShop-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    result[match[1]] = match[2];
  }
  return result;
}

const lightTokens = declarations(css.slice(0, css.indexOf('@media')));
const darkBlock = css.slice(css.indexOf(':root.dark {'));
const darkTokens = { ...lightTokens, ...declarations(darkBlock) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: Array<[string, string]> = [
  ['danger-ink', 'bg'],
  ['danger-ink', 'card-bg'],
  ['on-amber', 'amber'],
  ['on-green', 'green'],
  ['placeholder', 'input-bg'],
  ['on-primary', 'primary'],
  ['warning-ink', 'warning-bg'],
  ['ink', 'done-bg'],
  ['ink', 'locked-bg'],
  ['disabled-ink', 'disabled-bg'],
];

// Non-text UI boundaries (WCAG 1.4.11, 3:1). The dashed locked border keeps the mockup value and is not asserted.
const uiPairs: Array<[string, string]> = [['input-border', 'input-bg']];

const productColors = {
  'product-red': '#c62828',
  'product-silver': '#aeb4ba',
  'product-black': '#1c1c1c',
  'product-blue': '#2563eb',
  'product-green': '#2e8b3e',
};

describe('tokens.css text contrast (WCAG AA 4.5:1)', () => {
  for (const [themeName, tokens] of [
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as const) {
    for (const [fg, bg] of pairs) {
      it(`${fg} on ${bg} in ${themeName}`, () => {
        expect(tokens[fg]).toBeDefined();
        expect(tokens[bg]).toBeDefined();
        expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const [themeName, tokens] of [
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as const) {
    for (const [fg, bg] of uiPairs) {
      it(`${fg} on ${bg} in ${themeName} (UI, 3:1)`, () => {
        expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3);
      });
    }

    it(`keeps the fixed product colours in ${themeName}`, () => {
      for (const [name, hex] of Object.entries(productColors)) {
        expect(tokens[name]).toBe(hex);
      }
    });
  }

  it('declares color-scheme for both themes', () => {
    expect(css).toMatch(/:root \{\s*color-scheme: light;/);
    expect(css).toMatch(/:root:not\(\.light\) \{\s*color-scheme: dark;/);
    expect(css).toMatch(/:root\.dark \{\s*color-scheme: dark;/);
  });
});
