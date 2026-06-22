import { Response } from 'express';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export class AiService {
  /**
   * Helper to perform fetch requests to the Python AI service
   */
  private static async callAiService(path: string, method: 'GET' | 'POST' = 'GET', body?: any) {
    try {
      const url = `${AI_SERVICE_URL}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      console.log(`[AI-Service-Client] Calling AI Service: ${method} ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI service responded with status ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error(`[AI-Service-Client] Error connecting to Python FastAPI service at ${AI_SERVICE_URL}:`, err.message);
      throw new Error(`Failed to communicate with AI optimization engine. Make sure FastAPI server is running. (Error: ${err.message})`);
    }
  }

  /**
   * Fetch demand forecast details from Python forecaster
   */
  static async getDemandForecast(days: number = 30) {
    return this.callAiService(`/api/predict/demand?days=${days}`);
  }

  /**
   * Fetch smart discounts recommendations from Python
   */
  static async getSmartDiscounts() {
    return this.callAiService('/api/predict/discounts');
  }

  /**
   * Fetch stock velocity classification from Python
   */
  static async getStockVelocity(days: number = 30) {
    return this.callAiService(`/api/predict/velocity?days=${days}`);
  }

  /**
   * Fetch Apriori combos from Python mining service
   */
  static async getAprioriCombos(support: number = 0.005, confidence: number = 0.05) {
    return this.callAiService(`/api/predict/combos?support=${support}&confidence=${confidence}`);
  }

  /**
   * Run the full AI synchronization pipeline (creates draft campaigns and notifications)
   */
  static async runAiSync() {
    return this.callAiService('/api/run-ai-sync', 'POST');
  }
}
