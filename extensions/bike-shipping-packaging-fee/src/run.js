// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 * @typedef {import("../generated/api").Operation} Operation
 */

/** @type {CartTransformRunResult} */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {RunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const configuration = parseConfiguration(
    input.cartTransform.configuration?.value,
  );

  if (!configuration) return NO_CHANGES;

  const bikeLines = input.cart.lines.filter((line) => {
    const { merchandise } = line;

    return (
      merchandise.__typename === "ProductVariant" &&
      merchandise.id !== configuration.packagingVariantId &&
      merchandise.product.inBikeShippingCollection
    );
  });

  const bikeQuantity = bikeLines.reduce(
    (quantity, line) => quantity + line.quantity,
    0,
  );

  if (bikeQuantity === 0) return NO_CHANGES;

  const sourceLine = bikeLines[0];

  if (sourceLine.merchandise.__typename !== "ProductVariant") {
    return NO_CHANGES;
  }

  const packagingPrice = (
    configuration.price * Number(input.presentmentCurrencyRate)
  ).toFixed(2);

  return {
    operations: [
      {
        lineExpand: {
          cartLineId: sourceLine.id,
          title: "Rower (z dopłatą za pakowanie)",
          expandedCartItems: [
            {
              merchandiseId: sourceLine.merchandise.id,
              quantity: sourceLine.quantity,
              price: {
                adjustment: {
                  fixedPricePerUnit: {
                    amount: sourceLine.cost.amountPerQuantity.amount,
                  },
                },
              },
            },
            {
              attributes: [
                {
                  key: "_bike_shipping_packaging_fee",
                  value: "true",
                },
              ],
              merchandiseId: configuration.packagingVariantId,
              quantity: bikeQuantity,
              price: {
                adjustment: {
                  fixedPricePerUnit: {
                    amount: packagingPrice,
                  },
                },
              },
            },
          ],
        },
      },
    ],
  };
}

/**
 * @param {string | null | undefined} value
 * @returns {{ price: number; packagingVariantId: string } | null}
 */
function parseConfiguration(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") return null;

    const price = Number(parsed.bikeShippingPrice);
    const packagingVariantId = parsed.packagingVariantId;

    if (!Number.isFinite(price) || price <= 0) return null;
    if (typeof packagingVariantId !== "string" || !packagingVariantId) {
      return null;
    }

    return { price, packagingVariantId };
  } catch {
    return null;
  }
}
