import { create } from "zustand";
import { modelService } from "@/services/models-service";
import { analytics } from "@/lib/analytics";

let fetchPromise: Promise<void> | null = null;

interface ModelState {
  models: Model[];
  modelDetail: ModelDetail;
  loading: boolean;
  getModels: () => Promise<void>;
  selectedModel: Model;
  setSelectedModel: (model: Model) => void;
  setModelDetail: (modelDetail: ModelDetail) => void;
}

export const useModels = create<ModelState>((set, get) => ({
  models: [],
  modelDetail: {} as ModelDetail,
  loading: false,
  selectedModel: {} as Model,
  getModels: async () => {
    if (fetchPromise) {
      return fetchPromise;
    }
    if (get().models.length > 0) {
      return;
    }
    fetchPromise = (async () => {
      try {
        set({ loading: true });
        const data = await modelService.getModels();
        set({ models: data.data });
      } catch (err) {
        console.error("Error fetching models:", err);
      } finally {
        set({ loading: false });
        fetchPromise = null;
      }
    })();
    return fetchPromise;
  },
  setSelectedModel: async (model: Model) => {
    const previousModel = get().selectedModel;
    set({ selectedModel: model });
    if (!model) return;

    if (previousModel?.id !== model.id) {
      const { useAuth } = await import("@/stores/auth-store");
      const isAuthenticated = useAuth.getState().isAuthenticated;
      analytics.capture("model_selected", {
        model: model.id,
        previous_model: previousModel?.id || null,
        user_status: analytics.getUserStatus(isAuthenticated),
      });
    }

    if (get().modelDetail.id === model.id) {
      return;
    }
    const modelDetail = await modelService.getModelDetail(model.id);
    set({ modelDetail: modelDetail });
  },
  setModelDetail: (modelDetail: ModelDetail) => set({ modelDetail }),
}));
