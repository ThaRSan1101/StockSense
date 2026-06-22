import { api } from './axiosInstance';

export interface AiForecastItem {
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  forecastedDemand: number;
  suggestedQty: number;
  urgency: 'Critical' | 'Warning' | 'Normal';
}

export interface AiDiscountItem {
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  originalPrice: number;
  suggestedDiscount: number;
  promoPrice: number;
  reason: string;
  suggestedAction: string;
}

export interface AiVelocityItem {
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  unitsSold: number;
  saleEvents: number;
  avgUnitsPerDay: number;
  daysInactive: number;
  costValue: number;
  status: 'Fast Moving' | 'Normal' | 'Slow Moving' | 'Dead Stock';
}

export interface AiComboItem {
  name: string;
  sku_a: string;
  sku_b: string;
  product_a: string;
  product_b: string;
  price_a: number;
  price_b: number;
  originalPrice: number;
  discountValue: number;
  comboPrice: number;
  reason: string;
  support: number;
  confidence: number;
  lift: number;
  isClearingSlow: boolean;
}

export const AiService = {
  getDemandForecast: async (days = 30): Promise<{ success: boolean; data: AiForecastItem[] }> => {
    const response = await api.get(`/ai/forecast?days=${days}`);
    return response.data;
  },

  getSmartDiscounts: async (): Promise<{ success: boolean; data: AiDiscountItem[] }> => {
    const response = await api.get('/ai/discounts');
    return response.data;
  },

  getStockVelocity: async (days = 30): Promise<{ success: boolean; data: AiVelocityItem[] }> => {
    const response = await api.get(`/ai/velocity?days=${days}`);
    return response.data;
  },

  getAprioriCombos: async (support = 0.005, confidence = 0.05): Promise<{ success: boolean; data: AiComboItem[] }> => {
    const response = await api.get(`/ai/combos?support=${support}&confidence=${confidence}`);
    return response.data;
  },

  runAiSync: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/ai/sync');
    return response.data;
  }
};
