import { PiiType } from '@redact/shared';
import type { PiiItem } from '@redact/shared';

// ── Name pools (entirely fictional) ─────────────────────────────────────────

const FIRST = [
  'Aria','Blake','Casey','Dana','Emery','Finley','Gray','Harper','Indigo',
  'Jordan','Kendall','Logan','Morgan','Nova','Oakley','Parker','Quinn',
  'Reese','Sage','Taylor','Avery','Bailey','Charlie','Drew','Ellis','Fern',
  'Glenn','Hayden','Ira','Jules','Kit','Lane','Marlowe','Noel','Onyx',
  'Peyton','River','Sloane','Tatum','Uma',
];

const LAST = [
  'Alderton','Bramfield','Coldwell','Dunmire','Esterbrook','Fairweather',
  'Grantham','Holloway','Irvington','Kesterby','Larchmont','Millbrook',
  'Northgate','Oakmoor','Pinehurst','Redwood','Stanfield','Thistledown',
  'Underhill','Wychwood','Aberstone','Brindlewood','Cheswick','Dalmore',
  'Elmsford','Ferndale','Grenwick','Hartwell','Ivywood','Jasperfield',
  'Kestwick','Larkmoor','Mapleton','Netherwood','Overstone','Pembrook',
  'Quelton','Ridgefield','Somerford','Thornbury',
];

// Fictional street names for address replacement
const STREETS = [
  '42 Elmwood Court','7 Birchfield Lane','19 Mapleton Drive',
  '83 Cedargrove Way','56 Willowbrook Ave','31 Heatherfield Rd',
  '12 Ashbury Circle','74 Pinecrest Blvd','9 Oakdale Terrace',
  '45 Maplewood St','68 Larkspur Drive','23 Crestwood Lane',
  '50 Thornberry Way','16 Silverpine Court','37 Brookhaven Ave',
];

// ── Deterministic helpers ────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

// ── Per-type generators ──────────────────────────────────────────────────────

function fakeName(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  return `${pick(FIRST, h)} ${pick(LAST, h + 7)}`;
}

// All synthetic emails use @example.org (RFC 2606 reserved — never real)
function fakeEmail(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  const user = `${pick(FIRST, h).toLowerCase()}.${pick(LAST, h + 3).toLowerCase()}`;
  return `${user}@example.org`;
}

// 555-XXXX is the NANP entertainment reserved range — guaranteed non-real
function fakePhone(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  const mid = String(100 + (h % 900)).slice(0, 3);
  const end = String(1000 + ((h >> 4) % 9000)).slice(0, 4);
  return `(555) ${mid}-${end}`;
}

// SSN area "000" is permanently invalid per SSA rules
function fakeSSN(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  const g2 = String(10 + (h % 90)).padStart(2, '0');
  const g3 = String(1000 + ((h >> 4) % 9000)).padStart(4, '0');
  return `000-${g2}-${g3}`;
}

// BIN 0000 is never assigned to any card network
function fakeCard(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  const g2 = String(1000 + (h % 9000)).padStart(4, '0');
  const g3 = String(1000 + ((h >> 4) % 9000)).padStart(4, '0');
  const g4 = String(1000 + ((h >> 8) % 9000)).padStart(4, '0');
  return `0000-${g2}-${g3}-${g4}`;
}

// 203.0.113.0/24 is TEST-NET-3 (RFC 5737) — reserved for docs, never routable
function fakeIP(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  return `203.0.113.${1 + (h % 254)}`;
}

function fakeAddress(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  return pick(STREETS, h);
}

// Shift the year component so the date looks plausible but is definitively wrong
function fakeDOB(original: string, idx: number): string {
  const h = hashStr(original) + idx * 17;
  const shift = 5 + (h % 10); // 5–14 year shift
  return original.replace(/\b(19|20)(\d{2})\b/, (_, century, yr) => {
    const shifted = (parseInt(yr, 10) + shift) % 100;
    return `${century}${String(shifted).padStart(2, '0')}`;
  });
}

// Fictional passport format using letters that are visually unambiguous
function fakePassport(original: string, idx: number): string {
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
  const h = hashStr(original) + idx * 17;
  const l1 = LETTERS[h % LETTERS.length]!;
  const l2 = LETTERS[(h + 5) % LETTERS.length]!;
  const digits = String(1000000 + (h % 9000000)).slice(0, 7);
  return `${l1}${l2}${digits}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

type FakeFn = (original: string, idx: number) => string;

const GENERATORS: Record<PiiType, FakeFn> = {
  [PiiType.NAME]: fakeName,
  [PiiType.EMAIL]: fakeEmail,
  [PiiType.PHONE]: fakePhone,
  [PiiType.SSN]: fakeSSN,
  [PiiType.CARD_NUMBER]: fakeCard,
  [PiiType.IP_ADDRESS]: fakeIP,
  [PiiType.ADDRESS]: fakeAddress,
  [PiiType.DATE_OF_BIRTH]: fakeDOB,
  [PiiType.PASSPORT]: fakePassport,
  // India-specific — use structured fake values
  [PiiType.AADHAAR]: (_o, i) => `${2000 + (i % 8000)} ${1000 + (i % 9000)} ${1000 + (i * 17 % 9000)}`,
  [PiiType.PAN]: (_o, i) => `XXXXX${String(1000 + i * 7).slice(0, 4)}X`,
  [PiiType.VEHICLE_NUMBER]: (_o, i) => `XX${String(10 + i % 90).slice(0, 2)}XX${String(1000 + i % 9000)}`,
  [PiiType.IFSC]: (_o, i) => `XXXX0${String(100000 + i * 3).slice(0, 6)}`,
  [PiiType.UPI_ID]: (_o, i) => `user${i}@upi`,
  [PiiType.GST]: (_o, i) => `${String(10 + i % 28).slice(0, 2)}XXXXX${String(1000 + i % 9000)}X${i % 9}Z${i % 10}`,
  [PiiType.CUSTOM]: fakeName,
};

/**
 * Builds a stable original→fake map from approved PII items.
 * The same original text always maps to the same fake value within a document,
 * satisfying the internal consistency requirement (FR-11).
 */
export function buildFakeDataMap(items: PiiItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  const typeIdx: Partial<Record<PiiType, number>> = {};

  for (const item of items) {
    if (item.text in map) continue;
    const idx = typeIdx[item.type] ?? 0;
    typeIdx[item.type] = idx + 1;
    map[item.text] = (GENERATORS[item.type] ?? fakeName)(item.text, idx);
  }

  return map;
}
