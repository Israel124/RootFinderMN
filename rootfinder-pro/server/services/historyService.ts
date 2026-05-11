import type { AppContext, CalculationRecord } from "../types.js";
import { AppError } from "../middleware/errorHandler.js";
import { sanitizeCalculationPayload, sanitizeText } from "../utils/sanitize.js";

/**
 * Servicio del historial de cálculos.
 */
export class HistoryService {
  private readonly context: AppContext;

  constructor(context: AppContext) {
    this.context = context;
  }

  /**
   * Lista el historial del usuario autenticado.
   */
  async listHistory(userId: string) {
    return this.context.storage.listHistory(userId);
  }

  /**
   * Guarda un cálculo normalizado.
   */
  async saveHistory(userId: string, payload: unknown) {
    const item = sanitizeCalculationPayload(payload);
    if (!item.id) {
      throw new AppError(400, "El cálculo debe incluir un identificador");
    }

    return this.context.storage.saveHistoryItem(userId, item);
  }

  /**
   * Actualiza total o parcialmente un cálculo.
   */
  async updateHistory(userId: string, id: string, payload: Record<string, unknown>) {
    const safeId = sanitizeText(id, 80);
    const currentItems = await this.context.storage.listHistory(userId);
    const current = currentItems.find((item) => item.id === safeId);

    if (!current) {
      throw new AppError(404, "Registro no encontrado");
    }

    let mergedItem: Partial<CalculationRecord> = {};
    const rawLabel = payload.label;
    const label = rawLabel === null ? null : sanitizeText(rawLabel, 200) || null;

    if ("method" in payload || "functionF" in payload || "functionF1" in payload || "fx" in payload) {
      mergedItem = {
        ...sanitizeCalculationPayload({
          ...current,
          ...payload,
          id: safeId,
        }),
        label,
      };
    } else if ("label" in payload) {
      mergedItem = { label };
    } else {
      throw new AppError(400, "No hay datos válidos para actualizar");
    }

    const updated = await this.context.storage.updateHistoryItem(userId, safeId, mergedItem);
    if (!updated) {
      throw new AppError(404, "Registro no encontrado");
    }

    return updated;
  }

  /**
   * Elimina un item del historial.
   */
  async deleteHistory(userId: string, id: string) {
    await this.context.storage.deleteHistoryItem(userId, sanitizeText(id, 80));
    return {
      success: true,
    };
  }

  /**
   * Borra todo el historial del usuario.
   */
  async clearHistory(userId: string) {
    await this.context.storage.clearHistory(userId);
    return {
      success: true,
    };
  }
}

