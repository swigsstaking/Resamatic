import { create } from 'zustand';
import { sitesApi } from '../services/api';

const useSiteStore = create((set, get) => ({
  sites: [],
  currentSite: null,
  loading: false,

  fetchSites: async () => {
    set({ loading: true });
    try {
      const { sites } = await sitesApi.getAll();
      set({ sites, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchSite: async (id) => {
    set({ loading: true });
    try {
      const { site } = await sitesApi.getOne(id);
      set({ currentSite: site, loading: false });
      return site;
    } catch {
      set({ loading: false });
    }
  },

  setCurrentSite: (site) => set({ currentSite: site }),

  createSite: async (data) => {
    const { site } = await sitesApi.create(data);
    set({ sites: [site, ...get().sites] });
    return site;
  },

  updateSite: async (id, data) => {
    const { site } = await sitesApi.update(id, data);
    set({
      currentSite: site,
      sites: get().sites.map(s => s._id === id ? site : s),
    });
    return site;
  },

  deleteSite: async (id) => {
    await sitesApi.delete(id);
    set({ sites: get().sites.filter(s => s._id !== id), currentSite: null });
  },
}));

export default useSiteStore;
