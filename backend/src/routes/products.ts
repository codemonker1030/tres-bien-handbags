import { Router, type IRouter } from "express";
import { eq, lte } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
  GetProductResponse,
  UpdateProductResponse,
  ListProductsResponse,
  ListLowStockProductsResponse,
} from "@workspace/schemas";

const router: IRouter = Router();

function mapProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    buyingPrice: p.buyingPrice != null ? Number(p.buyingPrice) : null,
    price: Number(p.price),
    expectedSellingPrice:
      p.expectedSellingPrice != null
        ? Number(p.expectedSellingPrice)
        : null,
    transportCost:
      p.transportCost != null
        ? Number(p.transportCost)
        : null,
    otherCosts:
      p.otherCosts != null
        ? Number(p.otherCosts)
        : null,
    purchaseDate:
      p.purchaseDate != null
        ? p.purchaseDate.toISOString()
        : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(productsTable.name);

  res.json(ListProductsResponse.parse(products.map(mapProduct)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    price,
    buyingPrice,
    expectedSellingPrice,
    transportCost,
    otherCosts,
    ...productData
  } = parsed.data;

  const [product] = await db
    .insert(productsTable)
    .values({
      ...productData,

      price: price.toFixed(2),

      buyingPrice:
        buyingPrice !== undefined
          ? buyingPrice.toFixed(2)
          : undefined,

      expectedSellingPrice:
        expectedSellingPrice !== undefined
          ? expectedSellingPrice.toFixed(2)
          : undefined,

      transportCost:
        transportCost !== undefined
          ? transportCost.toFixed(2)
          : undefined,

      otherCosts:
        otherCosts !== undefined
          ? otherCosts.toFixed(2)
          : undefined,
    })
    .returning();

  res.status(201).json(
    GetProductResponse.parse(mapProduct(product)),
  );
});

router.get("/products/low-stock", async (req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .where(
      lte(
        productsTable.stock,
        productsTable.lowStockThreshold,
      ),
    );

  res.json(
    ListLowStockProductsResponse.parse(
      products.map(mapProduct),
    ),
  );
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      eq(productsTable.id, params.data.id),
    );

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(
    GetProductResponse.parse(mapProduct(product)),
  );
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    price,
    buyingPrice,
    expectedSellingPrice,
    transportCost,
    otherCosts,
    ...productData
  } = parsed.data;

  const [product] = await db
    .update(productsTable)
    .set({
      ...productData,

      ...(price !== undefined
        ? { price: price.toFixed(2) }
        : {}),

      ...(buyingPrice !== undefined
        ? { buyingPrice: buyingPrice.toFixed(2) }
        : {}),

      ...(expectedSellingPrice !== undefined
        ? {
            expectedSellingPrice:
              expectedSellingPrice.toFixed(2),
          }
        : {}),

      ...(transportCost !== undefined
        ? { transportCost: transportCost.toFixed(2) }
        : {}),

      ...(otherCosts !== undefined
        ? { otherCosts: otherCosts.toFixed(2) }
        : {}),
    })
    .where(
      eq(productsTable.id, params.data.id),
    )
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(
    UpdateProductResponse.parse(mapProduct(product)),
  );
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(
      eq(productsTable.id, params.data.id),
    )
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;