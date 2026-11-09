import { DiscountType, ApprovalStatus } from '@prisma/client';
import { SeededRandom } from './deterministic-random.js';
import { ProductCatalogItem } from './product-catalog.js';

export interface DiscountInput {
  id: string;
  name: string;
  type: DiscountType;
  discountValue: number;
  comboPrice: number | null;
  minBillAmount: number | null;
  label: string | null;
  startDate: Date | null;
  endDate: Date | null;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  applicableDate: Date | null;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
}

export interface DiscountProductInput {
  id: string;
  discountId: string;
  sku: string;
}

export interface DiscountComboItemInput {
  id: string;
  discountId: string;
  sku: string;
  minQty: number;
}

export function generateDiscounts(
  random: SeededRandom,
  products: ProductCatalogItem[]
) {
  const discounts: DiscountInput[] = [];
  const discountProducts: DiscountProductInput[] = [];
  const discountComboItems: DiscountComboItemInput[] = [];

  let dpCount = 0;
  let dciCount = 0;

  // Realistic annual campaigns spanning 2023, 2024, 2025 (strictly <= 2025-12-31)
  const years = [2023, 2024, 2025];

  years.forEach((year) => {
    // 1. Back to School Promotion (January 01 to January 22)
    // Percentage discount on stationery
    const schoolDiscountPct = year === 2023 ? 10 : year === 2024 ? 12 : 15;
    discounts.push({
      id: `disc-school-${year}`,
      name: `Back to School Bonanza ${year}`,
      type: DiscountType.SEASONAL,
      discountValue: schoolDiscountPct,
      comboPrice: null,
      minBillAmount: null,
      label: `SCHOOL${schoolDiscountPct}`,
      startDate: new Date(`${year}-01-01T00:00:00Z`),
      endDate: new Date(`${year}-01-22T23:59:59Z`),
      dailyStartTime: null,
      dailyEndTime: null,
      applicableDate: null,
      isActive: false,
      approvalStatus: ApprovalStatus.APPROVED,
    });

    // 2. Sinhala & Tamil New Year Avurudu Sale (April 04 to April 18)
    // Percentage discount on essentials and confectioneries
    const avuruduDiscountPct = year === 2023 ? 10 : year === 2024 ? 12 : 15;
    discounts.push({
      id: `disc-avurudu-${year}`,
      name: `Avurudu Festival Mega Offers ${year}`,
      type: DiscountType.SEASONAL,
      discountValue: avuruduDiscountPct,
      comboPrice: null,
      minBillAmount: null,
      label: `AVURUDU${avuruduDiscountPct}`,
      startDate: new Date(`${year}-04-04T00:00:00Z`),
      endDate: new Date(`${year}-04-18T23:59:59Z`),
      dailyStartTime: null,
      dailyEndTime: null,
      applicableDate: null,
      isActive: false,
      approvalStatus: ApprovalStatus.APPROVED,
    });

    // 3. Christmas & Year-End Baking Festival (November 20 to December 31)
    // Percentage discount on baking items and sweet treats
    const cakeDiscountPct = year === 2023 ? 15 : year === 2024 ? 18 : 20;
    discounts.push({
      id: `disc-cake-${year}`,
      name: `Christmas Baking & Festive Season ${year}`,
      type: DiscountType.SEASONAL,
      discountValue: cakeDiscountPct,
      comboPrice: null,
      minBillAmount: null,
      label: `XMAS${cakeDiscountPct}`,
      startDate: new Date(`${year}-11-20T00:00:00Z`),
      endDate: new Date(`${year}-12-31T23:59:59Z`),
      dailyStartTime: null,
      dailyEndTime: null,
      applicableDate: null,
      isActive: year === 2025,
      approvalStatus: ApprovalStatus.APPROVED,
    });

    // 4. Weekend Tea & Biscuits Combo
    // Fixed combo bundle price adjusted for annual inflation
    const teaComboPrice = year === 2023 ? 460 : year === 2024 ? 490 : 520;
    discounts.push({
      id: `disc-combo-teabiscuits-${year}`,
      name: `Ceylon Tea & Biscuit Weekend Combo ${year}`,
      type: DiscountType.COMBO,
      discountValue: 0,
      comboPrice: teaComboPrice,
      minBillAmount: null,
      label: `TEABISCUITS${year}`,
      startDate: new Date(`${year}-01-01T00:00:00Z`),
      endDate: new Date(`${year}-12-31T23:59:59Z`),
      dailyStartTime: null,
      dailyEndTime: null,
      applicableDate: null,
      isActive: year === 2025,
      approvalStatus: ApprovalStatus.APPROVED,
    });

    // 5. Weekend Beverage & Snacks Combo
    const drinkComboPrice = year === 2023 ? 360 : year === 2024 ? 380 : 400;
    discounts.push({
      id: `disc-combo-drinksnack-${year}`,
      name: `Weekend Refreshment Duo ${year}`,
      type: DiscountType.COMBO,
      discountValue: 0,
      comboPrice: drinkComboPrice,
      minBillAmount: null,
      label: `REFRESH${year}`,
      startDate: new Date(`${year}-01-01T00:00:00Z`),
      endDate: new Date(`${year}-12-31T23:59:59Z`),
      dailyStartTime: null,
      dailyEndTime: null,
      applicableDate: null,
      isActive: year === 2025,
      approvalStatus: ApprovalStatus.APPROVED,
    });

    // 6. Minimum Bill Discount (Spend threshold for fixed rupee savings)
    const minSpend = year === 2023 ? 4000 : 5000;
    const billDiscountValue = year === 2023 ? 400 : 500;
    discounts.push({
      id: `disc-bill-5000-${year}`,
      name: `Family Grocery Saver Reward ${year}`,
      type: DiscountType.BILL,
      discountValue: billDiscountValue,
      comboPrice: null,
      minBillAmount: minSpend,
      label: `SAVER${billDiscountValue}`,
      startDate: new Date(`${year}-01-01T00:00:00Z`),
      endDate: new Date(`${year}-12-31T23:59:59Z`),
      dailyStartTime: null,
      dailyEndTime: null,
      applicableDate: null,
      isActive: year === 2025,
      approvalStatus: ApprovalStatus.APPROVED,
    });
  });

  // Presentation Draft Discount
  discounts.push({
    id: 'disc-draft-test',
    name: 'Proposed Mid-Year Flash Promo',
    type: DiscountType.SEASONAL,
    discountValue: 15,
    comboPrice: null,
    minBillAmount: null,
    label: 'DRAFT15',
    startDate: new Date('2025-06-01T00:00:00Z'),
    endDate: new Date('2025-06-30T23:59:59Z'),
    dailyStartTime: null,
    dailyEndTime: null,
    applicableDate: null,
    isActive: false,
    approvalStatus: ApprovalStatus.DRAFT,
  });

  // Map products to seasonal discounts
  products.forEach((prod) => {
    // School items
    if (prod.seasonal === 'SCHOOL_JAN') {
      years.forEach((yr) => {
        discountProducts.push({
          id: `dp-${++dpCount}`,
          discountId: `disc-school-${yr}`,
          sku: prod.sku,
        });
      });
    }

    // Baking ingredients
    if (prod.seasonal === 'FESTIVAL_DEC') {
      years.forEach((yr) => {
        discountProducts.push({
          id: `dp-${++dpCount}`,
          discountId: `disc-cake-${yr}`,
          sku: prod.sku,
        });
      });
    }

    // General discount-sensitive products get added to Avurudu Sale
    if (prod.demandProfile === 'DISCOUNT_SENSITIVE') {
      years.forEach((yr) => {
        discountProducts.push({
          id: `dp-${++dpCount}`,
          discountId: `disc-avurudu-${yr}`,
          sku: prod.sku,
        });
      });
    }
  });

  // Map products to Combo items
  const teaProducts = products.filter((p) => p.sku.includes('WATA') || p.sku.includes('DILM'));
  const biscuitProducts = products.filter((p) => p.sku.includes('MUNC') || p.sku.includes('MALI'));
  const softDrinkProducts = products.filter((p) => p.sku.includes('COCA') || p.sku.includes('SPRI') || p.sku.includes('GNNG') || p.sku.includes('GING'));
  const snackProducts = products.filter((p) => p.sku.includes('SMAK') || p.sku.includes('LANK'));

  years.forEach((yr) => {
    const teaDiscId = `disc-combo-teabiscuits-${yr}`;
    if (teaProducts.length > 0 && biscuitProducts.length > 0) {
      discountComboItems.push({
        id: `dci-${++dciCount}`,
        discountId: teaDiscId,
        sku: teaProducts[0].sku,
        minQty: 1,
      });
      discountComboItems.push({
        id: `dci-${++dciCount}`,
        discountId: teaDiscId,
        sku: biscuitProducts[0].sku,
        minQty: 1,
      });
    }

    const drinkDiscId = `disc-combo-drinksnack-${yr}`;
    if (softDrinkProducts.length > 0 && snackProducts.length > 0) {
      discountComboItems.push({
        id: `dci-${++dciCount}`,
        discountId: drinkDiscId,
        sku: softDrinkProducts[0].sku,
        minQty: 1,
      });
      discountComboItems.push({
        id: `dci-${++dciCount}`,
        discountId: drinkDiscId,
        sku: snackProducts[0].sku,
        minQty: 1,
      });
    }
  });

  return {
    discounts,
    discountProducts,
    discountComboItems,
  };
}
