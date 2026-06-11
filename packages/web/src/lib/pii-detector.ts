import nlp from 'compromise';
import { PiiType } from '@redact/shared';
import type { PiiItem } from '@redact/shared';
import { v4 as uuidv4 } from 'uuid';

// ── Regex patterns ──────────────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Matches US-style phones: (555) 123-4567, +1 800 555-1234, 555.123.4567
const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?(?:\d{3})\)?[-.\s]?\d{3}[-.\s]\d{4}/g;

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

// 16-digit card numbers with optional separators
const CARD_RE = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;

// Valid IPv4 (0–255 in each octet)
const IP_RE =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;

// Street address: starts with a number, followed by a road-type keyword
const ADDRESS_RE =
  /\b\d+\s+[A-Za-z][A-Za-z\s]{2,40}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter|Parkway|Pkwy|Highway|Hwy)\b(?:[^\n]{0,50}(?:,\s*[A-Za-z][A-Za-z\s]{2,30})?(?:,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?)?/gi;

// Common date-of-birth patterns: MM/DD/YYYY, Month DD YYYY, "DOB:" prefixes
const DOB_PATTERNS: RegExp[] = [
  /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
  /\bDOB\s*[:\-]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
  /\bDate\s+of\s+Birth\s*[:\-]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
];

// Passport numbers: 1–2 uppercase letters + 6–9 digits (US, UK, EU formats)
const PASSPORT_RE = /\b[A-Z]{1,2}\d{7,9}\b/g;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(type: PiiType, text: string, confidence: number): PiiItem {
  return {
    id: uuidv4(),
    type,
    text: text.trim(),
    confidence,
    approved: confidence >= 90,
  };
}

function detectByRegex(
  text: string,
  re: RegExp,
  type: PiiType,
  confidence: number,
): PiiItem[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const pattern = new RegExp(re.source, flags);
  const items: PiiItem[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[0].trim();
    if (value) items.push(makeItem(type, value, confidence));
  }
  return items;
}

function detectCustomTerms(text: string, terms: string[]): PiiItem[] {
  const items: PiiItem[] = [];
  for (const term of terms) {
    const pattern = new RegExp(term, 'gi');
    for (const match of text.matchAll(pattern)) {
      if (match[0]) items.push(makeItem(PiiType.CUSTOM, match[0], 100));
    }
  }
  return items;
}

// Uses compromise NLP to extract person names.
// Returns medium-confidence (78) items so they land in the review bucket.
function detectNames(text: string): PiiItem[] {
  const doc = nlp(text);
  const raw = doc.people().out('array') as string[];
  const seen = new Set<string>();
  const items: PiiItem[] = [];
  for (const name of raw) {
    const normalized = name.trim();
    const key = normalized.toLowerCase();
    // Require at least 2 words, max 5, length 4–60
    const words = normalized.split(/\s+/);
    if (words.length < 2 || words.length > 5 || normalized.length < 4 || normalized.length > 60) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(makeItem(PiiType.NAME, normalized, 78));
  }
  return items;
}

// Deduplicates by (type, lowercased text) — keeps first occurrence.
function dedup(items: PiiItem[]): PiiItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export const ALL_PII_TYPES = Object.values(PiiType);

/**
 * Runs all PII detectors against `text` and returns deduplicated items.
 * Pass `enabledTypes` to restrict which detectors run (used by profiles).
 */
export function runDetection(
  text: string,
  customTerms: string[] = [],
  enabledTypes: PiiType[] = ALL_PII_TYPES,
): PiiItem[] {
  const enabled = new Set(enabledTypes);
  const items: PiiItem[] = [];

  if (enabled.has(PiiType.NAME)) items.push(...detectNames(text));
  if (enabled.has(PiiType.EMAIL)) items.push(...detectByRegex(text, EMAIL_RE, PiiType.EMAIL, 95));
  if (enabled.has(PiiType.PHONE)) items.push(...detectByRegex(text, PHONE_RE, PiiType.PHONE, 85));
  if (enabled.has(PiiType.SSN)) items.push(...detectByRegex(text, SSN_RE, PiiType.SSN, 98));
  if (enabled.has(PiiType.CARD_NUMBER)) items.push(...detectByRegex(text, CARD_RE, PiiType.CARD_NUMBER, 90));
  if (enabled.has(PiiType.IP_ADDRESS)) items.push(...detectByRegex(text, IP_RE, PiiType.IP_ADDRESS, 80));
  if (enabled.has(PiiType.ADDRESS)) items.push(...detectByRegex(text, ADDRESS_RE, PiiType.ADDRESS, 72));
  if (enabled.has(PiiType.DATE_OF_BIRTH)) {
    for (const re of DOB_PATTERNS) {
      items.push(...detectByRegex(text, re, PiiType.DATE_OF_BIRTH, 88));
    }
  }
  if (enabled.has(PiiType.PASSPORT)) items.push(...detectByRegex(text, PASSPORT_RE, PiiType.PASSPORT, 65));
  if (customTerms.length > 0) items.push(...detectCustomTerms(text, customTerms));

  return dedup(items);
}

// Re-export for worker
export { detectByRegex, detectNames, detectCustomTerms };
