import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface UiState {
  sidebarOpen: boolean;
  previewMode: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Notification[];
  setSidebarOpen: (open: boolean) => void;
  setPreviewMode: (enabled: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  previewMode: false,
  theme: 'system',
  notifications: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setPreviewMode: (previewMode) => set({ previewMode }),

  setTheme: (theme) => set({ theme }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: crypto.randomUUID() },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
