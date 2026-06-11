import { describe, it, expect } from 'vitest';
import { runDetection } from '../pii-detector';
import { PiiType } from '@redact/shared';

// ── Email ────────────────────────────────────────────────────────────────────

describe('email detection', () => {
  it('detects a plain email address', () => {
    const items = runDetection('Contact us at support@example.com for help.');
    const emails = items.filter((i) => i.type === PiiType.EMAIL);
    expect(emails).toHaveLength(1);
    expect(emails[0]!.text).toBe('support@example.com');
    expect(emails[0]!.confidence).toBe(95);
  });

  it('detects multiple emails in one text', () => {
    const items = runDetection('From: alice@corp.io To: bob@mail.org');
    const emails = items.filter((i) => i.type === PiiType.EMAIL);
    expect(emails.map((e) => e.text)).toEqual(
      expect.arrayContaining(['alice@corp.io', 'bob@mail.org'])
    );
  });

  it('auto-approves emails (confidence >= 90)', () => {
    const [item] = runDetection('email@test.com').filter((i) => i.type === PiiType.EMAIL);
    expect(item!.approved).toBe(true);
  });
});

// ── Phone ────────────────────────────────────────────────────────────────────

describe('phone detection', () => {
  it('detects a US phone with dashes', () => {
    const items = runDetection('Call 555-123-4567 now.');
    const phones = items.filter((i) => i.type === PiiType.PHONE);
    expect(phones.length).toBeGreaterThanOrEqual(1);
    expect(phones[0]!.text).toContain('555');
  });

  it('detects a phone with parentheses', () => {
    const items = runDetection('Reach us at (800) 555-0199.');
    expect(items.some((i) => i.type === PiiType.PHONE)).toBe(true);
  });
});

// ── SSN ──────────────────────────────────────────────────────────────────────

describe('SSN detection', () => {
  it('detects a valid SSN', () => {
    const items = runDetection('SSN: 123-45-6789');
    const ssns = items.filter((i) => i.type === PiiType.SSN);
    expect(ssns).toHaveLength(1);
    expect(ssns[0]!.text).toBe('123-45-6789');
    expect(ssns[0]!.confidence).toBe(98);
    expect(ssns[0]!.approved).toBe(true);
  });
});

// ── Credit card ──────────────────────────────────────────────────────────────

describe('card number detection', () => {
  it('detects a card number with dashes', () => {
    const items = runDetection('Card: 4111-1111-1111-1111');
    const cards = items.filter((i) => i.type === PiiType.CARD_NUMBER);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.approved).toBe(true);
  });

  it('detects a card number with spaces', () => {
    const items = runDetection('Number: 4111 1111 1111 1111');
    expect(items.some((i) => i.type === PiiType.CARD_NUMBER)).toBe(true);
  });
});

// ── IP address ───────────────────────────────────────────────────────────────

describe('IP address detection', () => {
  it('detects a valid IPv4 address', () => {
    const items = runDetection('Server IP: 192.168.1.1');
    expect(items.some((i) => i.type === PiiType.IP_ADDRESS)).toBe(true);
  });

  it('does not flag invalid IP octets', () => {
    const items = runDetection('Invalid: 999.999.999.999');
    expect(items.filter((i) => i.type === PiiType.IP_ADDRESS)).toHaveLength(0);
  });
});

// ── Address ──────────────────────────────────────────────────────────────────

describe('address detection', () => {
  it('detects a street address', () => {
    const items = runDetection('Send mail to 123 Main Street, Springfield, IL 62701.');
    const addrs = items.filter((i) => i.type === PiiType.ADDRESS);
    expect(addrs.length).toBeGreaterThanOrEqual(1);
    expect(addrs[0]!.text).toContain('Main Street');
  });

  it('detects an avenue address', () => {
    const items = runDetection('Lives at 456 Oak Avenue, Chicago.');
    expect(items.some((i) => i.type === PiiType.ADDRESS)).toBe(true);
  });
});

// ── Date of birth ────────────────────────────────────────────────────────────

describe('date of birth detection', () => {
  it('detects a MM/DD/YYYY date', () => {
    const items = runDetection('Born on 03/15/1990.');
    const dobs = items.filter((i) => i.type === PiiType.DATE_OF_BIRTH);
    expect(dobs).toHaveLength(1);
    expect(dobs[0]!.text).toBe('03/15/1990');
  });

  it('detects a DOB: prefix pattern', () => {
    const items = runDetection('DOB: 07-04-1985');
    expect(items.some((i) => i.type === PiiType.DATE_OF_BIRTH)).toBe(true);
  });

  it('detects a written-out birth date', () => {
    const items = runDetection('Date of Birth: January 5, 1970');
    expect(items.some((i) => i.type === PiiType.DATE_OF_BIRTH)).toBe(true);
  });
});

// ── Names ────────────────────────────────────────────────────────────────────

describe('name detection', () => {
  it('detects a two-word person name', () => {
    const items = runDetection('The patient, John Smith, was admitted.');
    const names = items.filter((i) => i.type === PiiType.NAME);
    expect(names.length).toBeGreaterThanOrEqual(1);
    expect(names.some((n) => n.text.toLowerCase().includes('john smith'))).toBe(true);
  });

  it('assigns medium confidence to names', () => {
    const items = runDetection('Dr. Jane Doe signed the form.');
    const names = items.filter((i) => i.type === PiiType.NAME);
    if (names.length > 0) {
      expect(names[0]!.confidence).toBeLessThan(90);
      expect(names[0]!.confidence).toBeGreaterThanOrEqual(70);
      expect(names[0]!.approved).toBe(false);
    }
  });
});

// ── Custom terms ─────────────────────────────────────────────────────────────

describe('custom term detection', () => {
  it('detects a plain custom term case-insensitively', () => {
    const items = runDetection('Project: ACME Initiative', ['ACME']);
    const custom = items.filter((i) => i.type === PiiType.CUSTOM);
    expect(custom.length).toBeGreaterThanOrEqual(1);
    expect(custom[0]!.confidence).toBe(100);
    expect(custom[0]!.approved).toBe(true);
  });

  it('detects a regex custom term', () => {
    const items = runDetection('Order #ORD-1234 and ORD-5678', ['ORD-\\d+']);
    const custom = items.filter((i) => i.type === PiiType.CUSTOM);
    expect(custom.length).toBe(2);
  });
});

// ── enabledTypes filtering ───────────────────────────────────────────────────

describe('enabledTypes filtering', () => {
  it('only returns enabled types', () => {
    const text = 'Jane Doe — jane@example.com — SSN: 111-22-3333';
    const items = runDetection(text, [], [PiiType.EMAIL]);
    expect(items.every((i) => i.type === PiiType.EMAIL)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns nothing when enabledTypes is empty', () => {
    const items = runDetection('John Smith — john@test.com — 555-123-4567', [], []);
    expect(items).toHaveLength(0);
  });
});

// ── Deduplication ────────────────────────────────────────────────────────────

describe('deduplication', () => {
  it('does not return the same email twice', () => {
    const items = runDetection('dup@test.com and dup@test.com again');
    const emails = items.filter((i) => i.type === PiiType.EMAIL);
    expect(emails).toHaveLength(1);
  });

  it('keeps same text when it appears under different types (custom vs detected)', () => {
    const items = runDetection('test@example.com', ['test@example.com']);
    const emails = items.filter((i) => i.type === PiiType.EMAIL);
    const custom = items.filter((i) => i.type === PiiType.CUSTOM);
    expect(emails).toHaveLength(1);
    expect(custom).toHaveLength(1);
  });
});
