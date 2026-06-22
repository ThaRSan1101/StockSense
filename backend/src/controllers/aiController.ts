import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { AiService } from '../services/aiService.js';

export const getDemandForecast = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const result = await AiService.getDemandForecast(days);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSmartDiscounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AiService.getSmartDiscounts();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockVelocity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const result = await AiService.getStockVelocity(days);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAprioriCombos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const support = parseFloat(req.query.support as string) || 0.005;
    const confidence = parseFloat(req.query.confidence as string) || 0.05;
    const result = await AiService.getAprioriCombos(support, confidence);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const runAiSync = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AiService.runAiSync();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
