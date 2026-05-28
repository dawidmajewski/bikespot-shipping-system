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
 * @param {string} amount
 * @param {string} currencyCode
 * @returns {string}
 */
function formatPrice(amount, currencyCode) {
  const num = Number(amount);
  if (isNaN(num)) return amount;

  if (currencyCode === "PLN") {
    return num.toFixed(2).replace(".", ",") + " zł";
  }

  return num.toFixed(2) + " " + currencyCode;
}

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

  if (bikeLines.length === 0) return NO_CHANGES;

  const packagingPrice = (
    configuration.price * Number(input.presentmentCurrencyRate)
  ).toFixed(2);

  const operations = bikeLines.map((bikeLine) => {
    if (bikeLine.merchandise.__typename !== "ProductVariant") {
      return null;
    }

    const currencyCode =
      bikeLine.cost.amountPerQuantity.currencyCode ?? "PLN";

    const priceLabel = formatPrice(packagingPrice, currencyCode);

    return {
      lineExpand: {
        cartLineId: bikeLine.id,
        title: `Rower + pakowanie roweru (+${priceLabel})`,
        expandedCartItems: [
          {
            merchandiseId: bikeLine.merchandise.id,
            quantity: bikeLine.quantity,
            price: {
              adjustment: {
                fixedPricePerUnit: {
                  amount: bikeLine.cost.amountPerQuantity.amount,
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
            quantity: bikeLine.quantity,
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
    };
  }).filter(Boolean);

  if (operations.length === 0) return NO_CHANGES;

  return { operations };
}

/**
 * @param {string | null | undefined} value
 * @returns {{ price: number; packagingVariantId: string; bikeShippingCollectionIds: string[] } | null}
 */
function parseConfiguration(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") return null;

    const price = Number(parsed.bikeShippingPrice);
    const packagingVariantId = parsed.packagingVariantId;
    const collectionIdsRaw = parsed.bikeShippingCollectionIds;

    if (!Number.isFinite(price) || price <= 0) return null;
    if (typeof packagingVariantId !== "string" || !packagingVariantId) {
      return null;
    }

    if (
      !Array.isArray(collectionIdsRaw) ||
      collectionIdsRaw.length === 0
    ) {
      return null;
    }

    const bikeShippingCollectionIds = collectionIdsRaw.filter(
      (id) => typeof id === "string" && id.length > 0,
    );

    if (bikeShippingCollectionIds.length === 0) return null;

    return { price, packagingVariantId, bikeShippingCollectionIds };
  } catch {
    return null;
  }
}