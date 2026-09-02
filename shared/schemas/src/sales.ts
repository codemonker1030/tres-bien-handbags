import * as zod from "zod";

const saleShape = {
  id: zod.number(),
  productId: zod.number(),
  exactSellingPrice: zod.number(),
  paymentMethod: zod.enum(["cash", "mpesa"]),
  debtAmount: zod.number().nullish(),
  customerName: zod.string().nullish(),
  // Links to the customer_debts row created for this sale (if it was
  // partial/credit); debtRemaining is the LIVE unpaid balance, kept in sync
  // automatically when a payment is recorded on the Debts page.
  debtId: zod.number().nullish(),
  debtRemaining: zod.number().nullish(),
  notes: zod.string().nullish(),
  soldAt: zod.string(),
  createdAt: zod.string(),
};

export const ListProductSalesParams = zod.object({ id: zod.coerce.number() });
export const ListProductSalesResponseItem = zod.object(saleShape);
export const ListProductSalesResponse = zod.array(ListProductSalesResponseItem);

export const ListAllSalesResponseItem = zod.object({
  ...saleShape,
  productName: zod.string(),
  productImageUrl: zod.string().nullish(),
});
export const ListAllSalesResponse = zod.array(ListAllSalesResponseItem);

export const CreateSaleParams = zod.object({ id: zod.coerce.number() });
export const CreateSaleBody = zod.object({
  exactSellingPrice: zod.number().min(0),
  paymentMethod: zod.enum(["cash", "mpesa"]),
  debtAmount: zod.number().min(0).optional(),
  customerName: zod.string().optional(),
  notes: zod.string().optional(),
});

export const DeleteSaleParams = zod.object({ id: zod.coerce.number() });
