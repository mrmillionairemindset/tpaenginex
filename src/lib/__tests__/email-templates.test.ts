import { describe, it, expect } from 'vitest';
import { interpolate } from '../email-templates';

describe('interpolate', () => {
  it('replaces simple {{key}} placeholders', () => {
    const result = interpolate('Hello {{name}}!', { name: 'Alice' });
    expect(result).toBe('Hello Alice!');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const result = interpolate('{{name}} and {{name}} again', { name: 'Bob' });
    expect(result).toBe('Bob and Bob again');
  });

  it('handles multiple different placeholders', () => {
    const result = interpolate('{{a}} + {{b}} = {{c}}', { a: '1', b: '2', c: '3' });
    expect(result).toBe('1 + 2 = 3');
  });

  it('leaves unknown placeholders unchanged', () => {
    const result = interpolate('Hello {{unknown}}!', { other: 'value' });
    expect(result).toBe('Hello {{unknown}}!');
  });

  it('handles empty template', () => {
    expect(interpolate('', { name: 'X' })).toBe('');
  });

  it('handles template with no placeholders', () => {
    expect(interpolate('Static content', { name: 'X' })).toBe('Static content');
  });

  it('handles empty vars object', () => {
    expect(interpolate('Hello {{name}}!', {})).toBe('Hello {{name}}!');
  });

  it('preserves HTML content around placeholders', () => {
    const template = '<p>Hi <strong>{{name}}</strong></p>';
    expect(interpolate(template, { name: 'Alice' })).toBe(
      '<p>Hi <strong>Alice</strong></p>'
    );
  });

  it('handles values with special characters (no HTML escaping applied — that is caller responsibility)', () => {
    // interpolate is a plain string substitute. Callers must HTML-escape before
    // putting user input into email HTML — document this behavior.
    const result = interpolate('Name: {{name}}', { name: '<script>' });
    expect(result).toBe('Name: <script>');
  });

  it('handles numeric keys', () => {
    // Our regex is \w+ which matches digits, but typical use is string keys.
    expect(interpolate('{{field1}}', { field1: 'value' })).toBe('value');
  });

  it('does NOT recursively interpolate (injected vars containing {{other}} stay literal)', () => {
    const result = interpolate('{{a}}', { a: '{{b}}', b: 'injected' });
    expect(result).toBe('{{b}}');
  });
});
