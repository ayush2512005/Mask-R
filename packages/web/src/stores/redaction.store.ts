import { create } from 'zustand';
import { MaskingStyle } from '@redact/shared';
import type { PiiItem, RedactionRegion } from '@redact/shared';

interface RedactionState {
  detectedItems: PiiItem[];
  approvedItems: PiiItem[];
  regions: RedactionRegion[];
  maskingStyle: MaskingStyle;
  customTerms: string[];
  redactedBuffer: ArrayBuffer | null;
  setDetectedItems: (items: PiiItem[]) => void;
  approveItem: (itemId: string) => void;
  rejectItem: (itemId: string) => void;
  approveAll: () => void;
  approveHighConfidence: () => void;
  addRegion: (region: RedactionRegion) => void;
  removeRegion: (regionId: string) => void;
  setMaskingStyle: (style: MaskingStyle) => void;
  addCustomTerm: (term: string) => void;
  removeCustomTerm: (term: string) => void;
  setRedactedBuffer: (buffer: ArrayBuffer) => void;
  clearRedactedBuffer: () => void;
  clearRedaction: () => void;
}

const HIGH_CONFIDENCE_THRESHOLD = 90;

export const useRedactionStore = create<RedactionState>((set) => ({
  detectedItems: [],
  approvedItems: [],
  regions: [],
  maskingStyle: MaskingStyle.BLACK_BOX,
  customTerms: [],
  redactedBuffer: null,

  setDetectedItems: (items) =>
    set({
      detectedItems: items,
      approvedItems: items.filter((i) => i.confidence >= HIGH_CONFIDENCE_THRESHOLD),
    }),

  approveItem: (itemId) =>
    set((state) => ({
      detectedItems: state.detectedItems.map((item) =>
        item.id === itemId ? { ...item, approved: true } : item
      ),
      approvedItems: state.detectedItems
        .map((item) => (item.id === itemId ? { ...item, approved: true } : item))
        .filter((item) => item.approved),
    })),

  rejectItem: (itemId) =>
    set((state) => ({
      detectedItems: state.detectedItems.map((item) =>
        item.id === itemId ? { ...item, approved: false } : item
      ),
      approvedItems: state.approvedItems.filter((item) => item.id !== itemId),
    })),

  approveAll: () =>
    set((state) => {
      const all = state.detectedItems.map((item) => ({ ...item, approved: true }));
      return { detectedItems: all, approvedItems: all };
    }),

  approveHighConfidence: () =>
    set((state) => {
      const updated = state.detectedItems.map((item) => ({
        ...item,
        approved: item.confidence >= HIGH_CONFIDENCE_THRESHOLD,
      }));
      return {
        detectedItems: updated,
        approvedItems: updated.filter((i) => i.approved),
      };
    }),

  addRegion: (region) =>
    set((state) => ({ regions: [...state.regions, region] })),

  removeRegion: (regionId) =>
    set((state) => ({ regions: state.regions.filter((r) => r.id !== regionId) })),

  setMaskingStyle: (maskingStyle) => set({ maskingStyle }),

  addCustomTerm: (term) =>
    set((state) => ({
      customTerms: state.customTerms.includes(term) ? state.customTerms : [...state.customTerms, term],
    })),

  removeCustomTerm: (term) =>
    set((state) => ({ customTerms: state.customTerms.filter((t) => t !== term) })),

  setRedactedBuffer: (buffer) => set({ redactedBuffer: buffer }),

  clearRedactedBuffer: () => set({ redactedBuffer: null }),

  clearRedaction: () =>
    set({
      detectedItems: [],
      approvedItems: [],
      regions: [],
      customTerms: [],
      redactedBuffer: null,
    }),
}));

export { HIGH_CONFIDENCE_THRESHOLD };
