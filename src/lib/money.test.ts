import { describe, it, expect } from 'vitest';
import { toPaise, fromPaise, formatMoney, addPaise, subtractPaise } from './money';

describe('toPaise', () => {
  it('converts whole rupees', () => expect(toPaise(100)).toBe(10000));
  it('converts rupees with paise', () => expect(toPaise(1234.50)).toBe(123450));
  it('handles single paisa', () => expect(toPaise(0.01)).toBe(1));
  it('handles max 2 decimal places', () => expect(toPaise(999.99)).toBe(99999));
});

describe('fromPaise', () => {
  it('converts paise to rupees', () => expect(fromPaise(10000)).toBe(100));
  it('converts fractional rupees', () => expect(fromPaise(123450)).toBe(1234.5));
});

describe('formatMoney', () => {
  it('formats zero', () => expect(formatMoney(0)).toBe('₹0'));
  it('formats whole rupees', () => expect(formatMoney(10000)).toBe('₹100'));
  it('formats with paise', () => expect(formatMoney(123450)).toBe('₹1,234.5'));
  it('formats large amounts with Indian grouping', () => {
    expect(formatMoney(12300000)).toBe('₹1,23,000');
  });
});

describe('integer paise arithmetic', () => {
  it('adds without float error', () => expect(addPaise(100, 200)).toBe(300));
  it('subtracts without float error', () => expect(subtractPaise(500, 150)).toBe(350));
  it('never produces a float result', () => {
    // Classic float trap: 0.1 + 0.2 in rupees = 30 paise
    expect(addPaise(10, 20)).toBe(30);
  });
});
