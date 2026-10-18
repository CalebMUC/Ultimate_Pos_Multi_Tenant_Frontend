// Application/Production/Dtos/ProductionDtos.cs
import type { ProductionCostType } from '../enums';
import type { DateTimeString, Guid } from './common';

export interface CreateFormulaLineRequestDto { ingredientProductId: Guid; unitOfMeasureId: Guid; quantity: number }
export interface CreateFormulaRequestDto {
  productId: Guid; outputQuantity: number; outputUnitOfMeasureId: Guid; notes: string | null; lines: CreateFormulaLineRequestDto[];
}
export interface FormulaLineDto {
  formulaLineId: Guid; ingredientProductId: Guid; ingredientName: string; ingredientSku: string; unitOfMeasureId: Guid; quantity: number;
}
export interface FormulaDto {
  formulaId: Guid; productId: Guid; productName: string; productSku: string; versionNumber: number;
  outputQuantity: number; outputUnitOfMeasureId: Guid; notes: string | null; isActive: boolean; createdAt: DateTimeString;
  lines: FormulaLineDto[];
}

export interface ProductionCostRequestDto { costType: ProductionCostType; description: string | null; amount: number }
export interface CreateProductionRunRequestDto {
  formulaId: Guid;
  quantityToProduce: number;
  unitOfMeasureId: Guid;
  actualQuantityProduced: number | null;
  notes: string | null;
  additionalCosts: ProductionCostRequestDto[] | null;
}
export interface ProductionRequirementDto {
  ingredientProductId: Guid; ingredientName: string; ingredientSku: string; unitOfMeasureId: Guid;
  requiredQuantity: number; requiredInBaseUnits: number; availableInBaseUnits: number; shortfallInBaseUnits: number;
  unitCostPerBaseUnit: number; estimatedCost: number;
}
export interface ProductionPriceCheckDto { priceType: string; price: number; margin: number; marginPercent: number | null }
export interface ProductionPreviewDto {
  formulaId: Guid; formulaVersion: number; productId: Guid; productName: string;
  quantityToProduce: number; unitOfMeasureId: Guid; canProduce: boolean; requirements: ProductionRequirementDto[];
  estimatedMaterialCost: number; additionalCost: number; estimatedTotalCost: number; estimatedCostPerUnit: number;
  costComplete: boolean; priceChecks: ProductionPriceCheckDto[];
}
export interface ProductionRunInputDto {
  ingredientProductId: Guid; unitOfMeasureId: Guid; quantityConsumed: number; quantityConsumedInBaseUnits: number;
  unitCostPerBaseUnit: number; totalCost: number;
}
export interface ProductionRunCostDto { costType: string; description: string | null; amount: number }
export interface ProductionRunDto {
  productionRunId: Guid; runNumber: string; formulaId: Guid; formulaVersion: number; productId: Guid; productName: string;
  unitOfMeasureId: Guid; quantityPlanned: number; quantityProduced: number; yieldPercentage: number; notes: string | null;
  createdAt: DateTimeString; inputs: ProductionRunInputDto[];
  materialCost: number; additionalCost: number; totalCost: number; costPerBaseUnit: number; costPerUnit: number;
  additionalCosts: ProductionRunCostDto[];
}
