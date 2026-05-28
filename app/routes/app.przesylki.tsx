import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

const BIKE_SHIPPING_PRICE_FIELD = "bike-shipping-price";
const BIKE_SHIPPING_COLLECTION_ID_FIELD = "bike-shipping-collection-id";
const ACTION_INTENT_FIELD = "intent";
const BIKE_SHIPPING_INTENT = "bike-shipping";
const LOCATION_SHIPPING_TIME_INTENT = "location-shipping-time";
const LOCATION_ID_FIELD = "location-id";
const SHIPPING_TIME_DAYS_FIELD = "shipping-time-days";
const SHIPPING_TIME_LABEL_FIELD = "shipping-time-label";
const LOCATION_SHIPPING_TIMES_FIELD = "location-shipping-times";
const BIKE_SHIPPING_PRICE_PATTERN = /^\d+(?:[,.]\d{1,2})?$/;
const SHIPPING_TIME_DAYS_PATTERN = /^\d+$/;
const BIKE_SHIPPING_METAFIELD_NAMESPACE = "bike_shipping";
const BIKE_SHIPPING_PRICE_KEY = "price";
const BIKE_SHIPPING_COLLECTION_ID_KEY = "collection_id";
const BIKE_SHIPPING_PACKAGING_VARIANT_ID_KEY = "packaging_variant_id";
const LOCATION_SHIPPING_TIMES_KEY = "location_shipping_times";
const BIKE_SHIPPING_CART_TRANSFORM_HANDLE = "bike-shipping-packaging-fee";
const BIKE_SHIPPING_FUNCTION_CONFIGURATION_NAMESPACE = "$app:bike-shipping";
const BIKE_SHIPPING_FUNCTION_CONFIGURATION_KEY = "function-configuration";
const BIKE_SHIPPING_COLLECTION_IDS_VARIABLE = "bikeShippingCollectionIds";
const BIKE_SHIPPING_PACKAGING_PRODUCT_TITLE = "Dopłata za pakowanie roweru";

type CollectionNode = {
  id: string;
  handle: string;
  title: string;
};

type CollectionOption = {
  id: string;
  uid: string;
  name: string;
};

type LocationNode = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type LocationShippingTimeSetting = {
  shippingTimeDays: string;
  shippingTimeLabel: string;
};

type LocationShippingTimeSettings = Record<
  string,
  LocationShippingTimeSetting
>;

type BikeShippingSettings = {
  bikeShippingPrice: string;
  bikeShippingCollectionId: string;
};

type GraphQLUserError = {
  field?: string[] | null;
  message: string;
  code?: string | null;
};

type GraphQLError = {
  message: string;
};

type MetafieldValue = {
  value: string;
};

type CollectionsQueryResponse = {
  data?: {
    collections?: {
      nodes?: CollectionNode[];
    };
  };
};

type LocationsConnection = {
  nodes?: LocationNode[];
};

type CollectionQueryResponse = {
  data?: {
    collection?: CollectionNode | null;
    currentAppInstallation?: {
      id: string;
      packagingVariantId?: MetafieldValue | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type BikeShippingSettingsQueryResponse = {
  data?: {
    locations?: LocationsConnection;
    currentAppInstallation?: {
      id: string;
      price?: MetafieldValue | null;
      collectionId?: MetafieldValue | null;
      locationShippingTimes?: MetafieldValue | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type LocationShippingTimesQueryResponse = {
  data?: {
    locations?: LocationsConnection;
    currentAppInstallation?: {
      id: string;
      locationShippingTimes?: MetafieldValue | null;
    } | null;
  };
  errors?: GraphQLError[];
};

type MetafieldsSetResponse = {
  data?: {
    metafieldsSet?: {
      userErrors: GraphQLUserError[];
    } | null;
  };
  errors?: GraphQLError[];
};

type ProductVariantNode = {
  id: string;
};

type ProductVariantQueryResponse = {
  data?: {
    node?: ProductVariantNode | null;
  };
  errors?: GraphQLError[];
};

type PackagingProductCreateResponse = {
  data?: {
    productCreate?: {
      product?: {
        variants?: {
          nodes?: ProductVariantNode[];
        } | null;
      } | null;
      userErrors: GraphQLUserError[];
    } | null;
  };
  errors?: GraphQLError[];
};

type CartTransformNode = {
  id: string;
  functionId: string;
};

type CartTransformsQueryResponse = {
  data?: {
    cartTransforms?: {
      nodes?: CartTransformNode[];
    } | null;
  };
  errors?: GraphQLError[];
};

type CartTransformCreateResponse = {
  data?: {
    cartTransformCreate?: {
      cartTransform?: CartTransformNode | null;
      userErrors: GraphQLUserError[];
    } | null;
  };
  errors?: GraphQLError[];
};

type AdminApiContext = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

type PriceParseResult =
  | { success: true; price: string }
  | { success: false; error: string };

type ShippingTimeDaysParseResult =
  | { success: true; days: string }
  | { success: false; error: string };

type BikeShippingActionErrors = {
  bikeShippingPrice?: string;
  bikeShippingCollection?: string;
};

type LocationShippingTimeActionErrors = {
  location?: string;
  shippingTimeDays?: string;
  shippingTimeLabel?: string;
};

type BikeShippingActionData =
  | {
      intent: typeof BIKE_SHIPPING_INTENT;
      success: true;
      price: string;
      collectionId: string;
      collection: CollectionOption;
      errors: BikeShippingActionErrors;
    }
  | {
      intent: typeof BIKE_SHIPPING_INTENT;
      success: false;
      price: string;
      collectionId: string;
      collection: null;
      errors: BikeShippingActionErrors;
    };

type LocationShippingTimeActionData =
  | {
      intent: typeof LOCATION_SHIPPING_TIME_INTENT;
      success: true;
      locationId: string;
      location: LocationOption;
      values: LocationShippingTimeSetting;
      settings: LocationShippingTimeSettings;
      errors: LocationShippingTimeActionErrors;
    }
  | {
      intent: typeof LOCATION_SHIPPING_TIME_INTENT;
      success: false;
      locationId: string;
      location: LocationOption | null;
      values: LocationShippingTimeSetting;
      errors: LocationShippingTimeActionErrors;
    };

type ActionData = BikeShippingActionData | LocationShippingTimeActionData;

const normalizePrice = (value: string) => value.trim().replace(",", ".");

const toCollectionOption = (collection: CollectionNode): CollectionOption => ({
  id: collection.id,
  uid: collection.handle,
  name: collection.title,
});

const toLocationOption = (location: LocationNode): LocationOption => ({
  id: location.id,
  name: location.name,
});

const emptyBikeShippingSettings: BikeShippingSettings = {
  bikeShippingPrice: "",
  bikeShippingCollectionId: "",
};

const emptyLocationShippingTimeSetting: LocationShippingTimeSetting = {
  shippingTimeDays: "",
  shippingTimeLabel: "",
};

const parseLocationShippingTimeSettings = (
  value?: string | null,
): LocationShippingTimeSettings => {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed as Record<string, unknown>).reduce(
      (settings, [locationId, rawSetting]) => {
        if (
          !rawSetting ||
          typeof rawSetting !== "object" ||
          Array.isArray(rawSetting)
        ) {
          return settings;
        }

        const setting = rawSetting as Record<string, unknown>;

        settings[locationId] = {
          shippingTimeDays:
            typeof setting.shippingTimeDays === "string"
              ? setting.shippingTimeDays
              : "",
          shippingTimeLabel:
            typeof setting.shippingTimeLabel === "string"
              ? setting.shippingTimeLabel
              : "",
        };

        return settings;
      },
      {} as LocationShippingTimeSettings,
    );
  } catch (error) {
    console.error("Unable to parse location shipping time settings", error);

    return {};
  }
};

const serializeLocationShippingTimeSettings = (
  settings: LocationShippingTimeSettings,
) => JSON.stringify(settings);

const reconcileLocationShippingTimeSettings = (
  locations: LocationOption[],
  savedSettings: LocationShippingTimeSettings,
): LocationShippingTimeSettings => {
  return locations.reduce<LocationShippingTimeSettings>((settings, location) => {
    const savedSetting = savedSettings[location.id];

    settings[location.id] = {
      shippingTimeDays:
        savedSetting?.shippingTimeDays ??
        emptyLocationShippingTimeSetting.shippingTimeDays,
      shippingTimeLabel:
        savedSetting?.shippingTimeLabel ??
        emptyLocationShippingTimeSetting.shippingTimeLabel,
    };

    return settings;
  }, {});
};

const parseBikeShippingPrice = (value: string): PriceParseResult => {
  const normalizedValue = normalizePrice(value);

  if (!normalizedValue) {
    return { success: false, error: "Podaj koszt przesyłki roweru." };
  }

  if (!BIKE_SHIPPING_PRICE_PATTERN.test(value.trim())) {
    return {
      success: false,
      error: "Podaj poprawną kwotę z maksymalnie 2 miejscami po przecinku.",
    };
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { success: false, error: "Koszt przesyłki nie może być ujemny." };
  }

  return { success: true, price: numericValue.toFixed(2) };
};

const parseShippingTimeDays = (value: string): ShippingTimeDaysParseResult => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { success: false, error: "Podaj czas przesyłki w dniach." };
  }

  if (!SHIPPING_TIME_DAYS_PATTERN.test(trimmedValue)) {
    return { success: false, error: "Podaj poprawną liczbę dni." };
  }

  const numericValue = Number(trimmedValue);

  if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
    return { success: false, error: "Czas przesyłki nie może być ujemny." };
  }

  return { success: true, days: String(numericValue) };
};

const getGraphQLErrorMessage = (
  userErrors: GraphQLUserError[] = [],
  graphQLErrors: GraphQLError[] = [],
) => userErrors[0]?.message ?? graphQLErrors[0]?.message;

const buildBikeShippingFunctionConfiguration = ({
  price,
  collectionId,
  packagingVariantId,
}: {
  price: string;
  collectionId: string;
  packagingVariantId: string;
}) =>
  JSON.stringify({
    bikeShippingPrice: price,
    packagingVariantId,
    [BIKE_SHIPPING_COLLECTION_IDS_VARIABLE]: [collectionId],
  });

const getPackagingVariantId = async (
  admin: AdminApiContext,
  appInstallationId: string,
  savedVariantId?: string | null,
  price?: string,
) => {
  let variantId: string | undefined;
  let productId: string | undefined;

  if (savedVariantId) {
    const response = await admin.graphql(
      `#graphql
        query BikeShippingPackagingVariant($id: ID!) {
          node(id: $id) {
            ... on ProductVariant {
              id
              product {
                id
              }
            }
          }
        }`,
      {
        variables: {
          id: savedVariantId,
        },
      },
    );
    const responseJson = (await response.json()) as ProductVariantQueryResponse;

    if (responseJson.data?.node?.id) {
      variantId = responseJson.data.node.id;
      productId =
        (responseJson.data.node as { product?: { id: string } }).product?.id;
    }

    if (responseJson.errors?.length) {
      console.error("Unable to verify bike shipping packaging variant", {
        graphQLErrors: responseJson.errors,
      });
    }
  }

  if (!variantId) {
    const createResponse = await admin.graphql(
      `#graphql
        mutation BikeShippingPackagingProductCreate($title: String!, $iconDataUri: String!) {
          productCreate(
            product: {
              title: $title
              vendor: "BikeSpot"
              productType: "Shipping fee"
              status: ACTIVE
              tags: ["bike-shipping-packaging-fee"]
              images: [{ src: $iconDataUri }]
            }
          ) {
            product {
              id
              variants(first: 1) {
                nodes {
                  id
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          title: BIKE_SHIPPING_PACKAGING_PRODUCT_TITLE,
          iconDataUri:
            "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pg0KPCEtLSBVcGxvYWRlZCB0bzogU1ZHIFJlcG8sIHd3dy5zdmdyZXBvLmNvbSwgR2VuZXJhdG9yOiBTVkcgUmVwbyBNaXhlciBUb29scyAtLT4NCjxzdmcgaGVpZ2h0PSI4MDBweCIgd2lkdGg9IjgwMHB4IiB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiANCgkgdmlld0JveD0iMCAwIDQ2MCA0NjAiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPGcgaWQ9IlhNTElEXzExMzVfIj4NCgk8cG9seWdvbiBpZD0iWE1MSURfMTEzNl8iIHN0eWxlPSJmaWxsOiNGQjk5MkQ7IiBwb2ludHM9IjIwMC4wMDIsMjEwIDIzMC4wMDIsNDYwIDQzMC4wMDIsMzQ1IDQzMC4wMDIsMTE1IAkiLz4NCgk8cG9seWdvbiBpZD0iWE1MSURfMTEzN18iIHN0eWxlPSJmaWxsOiNGRkI3Mzk7IiBwb2ludHM9IjIzMC4wMDEsMjAwIDIzMC4wMDEsNDYwIDMwLjAwMSwzNDUgMzAuMDAxLDExNSAJIi8+DQoJPHBvbHlnb24gaWQ9IlhNTElEXzExMzhfIiBzdHlsZT0iZmlsbDojRkI5OTJEOyIgcG9pbnRzPSIyOS45OTgsMTE1IDk5LjkxMywxNTUuMTk5IDIzMi4zNzMsMTE2LjI4IDI5OS45MDcsNDAuMTkzIDIyOS45OTgsMCAJIi8+DQoJPHBvbHlnb24gaWQ9IlhNTElEXzExMzlfIiBzdHlsZT0iZmlsbDojRjY3QTIxOyIgcG9pbnRzPSIxNjAuMDk2LDE4OS44MDQgMjI5Ljk5OCwyMzAgNDI5Ljk5OCwxMTUgMzYwLjA5OCw3NC43OTggMjI2LjY1NywxMTQuMjc5IA0KCQkJIi8+DQoJPHBvbHlnb24gaWQ9IlhNTElEXzExNDBfIiBzdHlsZT0iZmlsbDojRkVFQUMzOyIgcG9pbnRzPSIxNjAuMDk2LDI4OS44MDMgOTkuOTEzLDI1NS4xOTkgOTkuOTEzLDE1NS4xOTkgMTU3LjkyNCwxNTkuNzMgDQoJCTE2MC4wOTYsMTg5LjgwNCAJIi8+DQoJPHBvbHlnb24gaWQ9IlhNTElEXzExNDFfIiBzdHlsZT0iZmlsbDojRkZENDg4OyIgcG9pbnRzPSI5OS45MTMsMTU1LjE5OSAyOTkuOTA3LDQwLjE5MyAzNjAuMDk4LDc0Ljc5OCAxNjAuMDk2LDE4OS44MDQgCSIvPg0KPC9nPg0KPC9zdmc+",
        },
      },
    );
    const createJson =
      (await createResponse.json()) as PackagingProductCreateResponse;
    const createErrors = createJson.data?.productCreate?.userErrors ?? [];
    const createErrorMessage = getGraphQLErrorMessage(
      createErrors,
      createJson.errors,
    );
    variantId =
      createJson.data?.productCreate?.product?.variants?.nodes?.[0]?.id;
    productId = createJson.data?.productCreate?.product?.id;

    if (createErrorMessage || !variantId) {
      console.error("Unable to create bike shipping packaging product", {
        graphQLErrors: createJson.errors,
        userErrors: createErrors,
      });

      throw new Error(
        createErrorMessage ??
          "Nie udało się utworzyć produktu dla opakowania roweru.",
      );
    }

    const saveResponse = await admin.graphql(
      `#graphql
        mutation BikeShippingPackagingVariantSave(
          $metafields: [MetafieldsSetInput!]!
        ) {
          metafieldsSet(metafields: $metafields) {
            userErrors {
              field
              message
              code
            }
          }
        }`,
      {
        variables: {
          metafields: [
            {
              namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
              key: BIKE_SHIPPING_PACKAGING_VARIANT_ID_KEY,
              ownerId: appInstallationId,
              type: "single_line_text_field",
              value: variantId,
            },
          ],
        },
      },
    );
    const saveJson = (await saveResponse.json()) as MetafieldsSetResponse;
    const saveErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];
    const saveErrorMessage = getGraphQLErrorMessage(saveErrors, saveJson.errors);

    if (saveErrorMessage || !saveJson.data?.metafieldsSet) {
      console.error("Unable to save bike shipping packaging variant", {
        graphQLErrors: saveJson.errors,
        userErrors: saveErrors,
      });

      throw new Error(
        saveErrorMessage ??
          "Nie udało się zapisać produktu dla opakowania roweru.",
      );
    }
  }

  if (price && productId) {
    const formattedPrice = Number(price).toFixed(2).replace(".", ",");
    const newTitle = `Dopłata za pakowanie roweru (+${formattedPrice} zł)`;
    await admin.graphql(
      `#graphql
        mutation BikeShippingProductUpdate($id: ID!, $title: String!) {
          productUpdate(input: { id: $id, title: $title }) {
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          id: productId,
          title: newTitle,
        },
      },
    );
  }

  return variantId;
};

const saveCartTransformConfiguration = async (
  admin: AdminApiContext,
  configurationValue: string,
) => {
  const metafields = [
    {
      namespace: BIKE_SHIPPING_FUNCTION_CONFIGURATION_NAMESPACE,
      key: BIKE_SHIPPING_FUNCTION_CONFIGURATION_KEY,
      type: "json",
      value: configurationValue,
    },
  ];
  const queryResponse = await admin.graphql(
    `#graphql
      query BikeShippingCartTransforms {
        cartTransforms(first: 10) {
          nodes {
            id
            functionId
          }
        }
      }`,
  );
  const queryJson =
    (await queryResponse.json()) as CartTransformsQueryResponse;

  if (queryJson.errors?.length) {
    console.error("Unable to load bike shipping cart transforms", {
      graphQLErrors: queryJson.errors,
    });

    throw new Error(
      queryJson.errors[0]?.message ??
        "Nie udało się odczytać konfiguracji funkcji koszyka.",
    );
  }

  const cartTransform = queryJson.data?.cartTransforms?.nodes?.[0] ?? null;

  if (!cartTransform) {
    const createResponse = await admin.graphql(
      `#graphql
        mutation BikeShippingCartTransformCreate(
          $functionHandle: String!
          $metafields: [MetafieldInput!]
        ) {
          cartTransformCreate(
            functionHandle: $functionHandle
            blockOnFailure: false
            metafields: $metafields
          ) {
            cartTransform {
              id
              functionId
            }
            userErrors {
              field
              message
              code
            }
          }
        }`,
      {
        variables: {
          functionHandle: BIKE_SHIPPING_CART_TRANSFORM_HANDLE,
          metafields,
        },
      },
    );
    const createJson =
      (await createResponse.json()) as CartTransformCreateResponse;
    const createErrors = createJson.data?.cartTransformCreate?.userErrors ?? [];
    const createErrorMessage = getGraphQLErrorMessage(
      createErrors,
      createJson.errors,
    );

    if (
      createErrorMessage ||
      !createJson.data?.cartTransformCreate?.cartTransform
    ) {
      console.error("Unable to create bike shipping cart transform", {
        graphQLErrors: createJson.errors,
        userErrors: createErrors,
      });

      throw new Error(
        createErrorMessage ??
          "Nie udało się aktywować opłaty za opakowanie roweru.",
      );
    }

    return;
  }

  const saveResponse = await admin.graphql(
    `#graphql
      mutation BikeShippingCartTransformConfigurationSave(
        $metafields: [MetafieldsSetInput!]!
      ) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
            code
          }
        }
      }`,
    {
      variables: {
        metafields: metafields.map((metafield) => ({
          ...metafield,
          ownerId: cartTransform.id,
        })),
      },
    },
  );
  const saveJson = (await saveResponse.json()) as MetafieldsSetResponse;
  const saveErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];
  const saveErrorMessage = getGraphQLErrorMessage(saveErrors, saveJson.errors);

  if (saveErrorMessage || !saveJson.data?.metafieldsSet) {
    console.error("Unable to save bike shipping cart transform configuration", {
      graphQLErrors: saveJson.errors,
      userErrors: saveErrors,
    });

    throw new Error(
      saveErrorMessage ??
        "Nie udało się zapisać konfiguracji opłaty za opakowanie roweru.",
    );
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query BikeShippingCollections {
        collections(first: 50, sortKey: TITLE) {
          nodes {
            id
            handle
            title
          }
        }
      }`,
  );
  const responseJson = (await response.json()) as CollectionsQueryResponse;
  let settings = emptyBikeShippingSettings;
  let locations: LocationOption[] = [];
  let locationShippingTimeSettings: LocationShippingTimeSettings = {};

  try {
    const settingsResponse = await admin.graphql(
      `#graphql
        query BikeShippingSettings(
          $namespace: String!
          $priceKey: String!
          $collectionIdKey: String!
          $locationShippingTimesKey: String!
        ) {
          locations(first: 250) {
            nodes {
              id
              name
            }
          }
          currentAppInstallation {
            id
            price: metafield(namespace: $namespace, key: $priceKey) {
              value
            }
            collectionId: metafield(namespace: $namespace, key: $collectionIdKey) {
              value
            }
            locationShippingTimes: metafield(
              namespace: $namespace
              key: $locationShippingTimesKey
            ) {
              value
            }
          }
        }`,
      {
        variables: {
          namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
          priceKey: BIKE_SHIPPING_PRICE_KEY,
          collectionIdKey: BIKE_SHIPPING_COLLECTION_ID_KEY,
          locationShippingTimesKey: LOCATION_SHIPPING_TIMES_KEY,
        },
      },
    );
    const settingsJson =
      (await settingsResponse.json()) as BikeShippingSettingsQueryResponse;

    if (settingsJson.errors?.length) {
      console.error(
        "Unable to load bike shipping app-data metafields",
        settingsJson.errors,
      );
    }

    settings = {
      bikeShippingPrice:
        settingsJson.data?.currentAppInstallation?.price?.value ?? "",
      bikeShippingCollectionId:
        settingsJson.data?.currentAppInstallation?.collectionId?.value ?? "",
    };

    locations =
      settingsJson.data?.locations?.nodes?.map(toLocationOption) ?? [];

    const appInstallationId = settingsJson.data?.currentAppInstallation?.id;
    const savedLocationShippingTimeSettings =
      parseLocationShippingTimeSettings(
        settingsJson.data?.currentAppInstallation?.locationShippingTimes?.value,
      );

    locationShippingTimeSettings = reconcileLocationShippingTimeSettings(
      locations,
      savedLocationShippingTimeSettings,
    );

    const currentLocationShippingTimeSettingsValue =
      settingsJson.data?.currentAppInstallation?.locationShippingTimes?.value ??
      "";
    const nextLocationShippingTimeSettingsValue =
      serializeLocationShippingTimeSettings(locationShippingTimeSettings);

    if (
      appInstallationId &&
      currentLocationShippingTimeSettingsValue !==
        nextLocationShippingTimeSettingsValue
    ) {
      const saveResponse = await admin.graphql(
        `#graphql
          mutation LocationShippingTimeSettingsReconcile(
            $metafields: [MetafieldsSetInput!]!
          ) {
            metafieldsSet(metafields: $metafields) {
              userErrors {
                field
                message
                code
              }
            }
          }`,
        {
          variables: {
            metafields: [
              {
                namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
                key: LOCATION_SHIPPING_TIMES_KEY,
                ownerId: appInstallationId,
                type: "json",
                value: nextLocationShippingTimeSettingsValue,
              },
            ],
          },
        },
      );
      const saveJson = (await saveResponse.json()) as MetafieldsSetResponse;
      const saveErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];
      const saveErrorMessage =
        saveErrors[0]?.message ?? saveJson.errors?.[0]?.message;

      if (saveErrorMessage || !saveJson.data?.metafieldsSet) {
        console.error("Unable to reconcile location shipping time settings", {
          graphQLErrors: saveJson.errors,
          userErrors: saveErrors,
        });
      }
    }
  } catch (error) {
    console.error("Unable to load bike shipping app-data metafields", error);
  }

  return {
    collections:
      responseJson.data?.collections?.nodes?.map(toCollectionOption) ?? [],
    locations,
    settings,
    locationShippingTimeSettings,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionData> => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(
    formData.get(ACTION_INTENT_FIELD) ?? BIKE_SHIPPING_INTENT,
  );

  if (intent === LOCATION_SHIPPING_TIME_INTENT) {
    const locationId = String(formData.get(LOCATION_ID_FIELD) ?? "");
    const shippingTimeDaysValue = String(
      formData.get(SHIPPING_TIME_DAYS_FIELD) ?? "",
    );
    const shippingTimeLabelValue = String(
      formData.get(SHIPPING_TIME_LABEL_FIELD) ?? "",
    );
    const submittedLocationShippingTimeSettings =
      formData.has(LOCATION_SHIPPING_TIMES_FIELD)
        ? parseLocationShippingTimeSettings(
            String(formData.get(LOCATION_SHIPPING_TIMES_FIELD) ?? ""),
          )
        : null;
    const parsedShippingTimeDays = parseShippingTimeDays(
      shippingTimeDaysValue,
    );
    const shippingTimeLabel = shippingTimeLabelValue.trim();
    const values: LocationShippingTimeSetting = {
      shippingTimeDays: parsedShippingTimeDays.success
        ? parsedShippingTimeDays.days
        : shippingTimeDaysValue,
      shippingTimeLabel: shippingTimeLabelValue,
    };
    const locationError = locationId
      ? undefined
      : "Nie udało się odczytać lokalizacji.";
    const labelError = shippingTimeLabel
      ? undefined
      : "Podaj etykietę czasu przesyłki.";

    if (!parsedShippingTimeDays.success || labelError || locationError) {
      return {
        intent: LOCATION_SHIPPING_TIME_INTENT,
        success: false,
        locationId,
        location: null,
        values,
        errors: {
          location: locationError,
          shippingTimeDays: parsedShippingTimeDays.success
            ? undefined
            : parsedShippingTimeDays.error,
          shippingTimeLabel: labelError,
        },
      };
    }

    const normalizedValues: LocationShippingTimeSetting = {
      shippingTimeDays: parsedShippingTimeDays.days,
      shippingTimeLabel,
    };

    try {
      const response = await admin.graphql(
        `#graphql
          query LocationShippingTimeSaveData(
            $namespace: String!
            $locationShippingTimesKey: String!
          ) {
            locations(first: 250) {
              nodes {
                id
                name
              }
            }
            currentAppInstallation {
              id
              locationShippingTimes: metafield(
                namespace: $namespace
                key: $locationShippingTimesKey
              ) {
                value
              }
            }
          }`,
        {
          variables: {
            namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
            locationShippingTimesKey: LOCATION_SHIPPING_TIMES_KEY,
          },
        },
      );
      const responseJson =
        (await response.json()) as LocationShippingTimesQueryResponse;

      if (responseJson.errors?.length) {
        console.error(
          "Unable to load location shipping time settings",
          responseJson.errors,
        );
      }

      const locations =
        responseJson.data?.locations?.nodes?.map(toLocationOption) ?? [];
      const location =
        locations.find((currentLocation) => currentLocation.id === locationId) ??
        null;
      const appInstallationId = responseJson.data?.currentAppInstallation?.id;

      if (!location) {
        return {
          intent: LOCATION_SHIPPING_TIME_INTENT,
          success: false,
          locationId,
          location: null,
          values: normalizedValues,
          errors: {
            location: "Wybrana lokalizacja nie istnieje.",
          },
        };
      }

      if (!appInstallationId) {
        return {
          intent: LOCATION_SHIPPING_TIME_INTENT,
          success: false,
          locationId,
          location,
          values: normalizedValues,
          errors: {
            location:
              "Nie udało się odczytać instalacji aplikacji. Spróbuj ponownie.",
          },
        };
      }

      const savedLocationShippingTimeSettings =
        parseLocationShippingTimeSettings(
          responseJson.data?.currentAppInstallation?.locationShippingTimes
            ?.value,
        );
      const baseLocationShippingTimeSettings =
        submittedLocationShippingTimeSettings ??
        savedLocationShippingTimeSettings;
      const nextLocationShippingTimeSettings = {
        ...reconcileLocationShippingTimeSettings(
          locations,
          baseLocationShippingTimeSettings,
        ),
        [location.id]: normalizedValues,
      };

      const saveResponse = await admin.graphql(
        `#graphql
          mutation LocationShippingTimeSettingsSave(
            $metafields: [MetafieldsSetInput!]!
          ) {
            metafieldsSet(metafields: $metafields) {
              userErrors {
                field
                message
                code
              }
            }
          }`,
        {
          variables: {
            metafields: [
              {
                namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
                key: LOCATION_SHIPPING_TIMES_KEY,
                ownerId: appInstallationId,
                type: "json",
                value: serializeLocationShippingTimeSettings(
                  nextLocationShippingTimeSettings,
                ),
              },
            ],
          },
        },
      );
      const saveJson = (await saveResponse.json()) as MetafieldsSetResponse;
      const saveErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];
      const saveErrorMessage =
        saveErrors[0]?.message ?? saveJson.errors?.[0]?.message;

      if (saveErrorMessage || !saveJson.data?.metafieldsSet) {
        console.error("Unable to save location shipping time settings", {
          graphQLErrors: saveJson.errors,
          userErrors: saveErrors,
        });

        return {
          intent: LOCATION_SHIPPING_TIME_INTENT,
          success: false,
          locationId,
          location,
          values: normalizedValues,
          errors: {
            location: saveErrorMessage ?? "Nie udało się zapisać ustawień.",
          },
        };
      }

      return {
        intent: LOCATION_SHIPPING_TIME_INTENT,
        success: true,
        locationId,
        location,
        values: normalizedValues,
        settings: nextLocationShippingTimeSettings,
        errors: {},
      };
    } catch (error) {
      console.error("Unable to save location shipping time settings", error);

      return {
        intent: LOCATION_SHIPPING_TIME_INTENT,
        success: false,
        locationId,
        location: null,
        values: normalizedValues,
        errors: {
          location: "Nie udało się zapisać ustawień. Spróbuj ponownie.",
        },
      };
    }
  }

  const priceValue = String(formData.get(BIKE_SHIPPING_PRICE_FIELD) ?? "");
  const collectionId = String(
    formData.get(BIKE_SHIPPING_COLLECTION_ID_FIELD) ?? "",
  );
  const parsedPrice = parseBikeShippingPrice(priceValue);
  const collectionError = collectionId
    ? undefined
    : "Wybierz kolekcję dla przesyłki roweru.";

  if (!parsedPrice.success || collectionError) {
    return {
      intent: BIKE_SHIPPING_INTENT,
      success: false,
      price: priceValue,
      collectionId,
      collection: null,
      errors: {
        bikeShippingPrice: parsedPrice.success ? undefined : parsedPrice.error,
        bikeShippingCollection: collectionError,
      },
    };
  }

  const response = await admin.graphql(
    `#graphql
      query BikeShippingCollection(
        $id: ID!
        $namespace: String!
        $packagingVariantIdKey: String!
      ) {
        collection(id: $id) {
          id
          handle
          title
        }
        currentAppInstallation {
          id
          packagingVariantId: metafield(
            namespace: $namespace
            key: $packagingVariantIdKey
          ) {
            value
          }
        }
      }`,
    {
      variables: {
        id: collectionId,
        namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
        packagingVariantIdKey: BIKE_SHIPPING_PACKAGING_VARIANT_ID_KEY,
      },
    },
  );
  const responseJson = (await response.json()) as CollectionQueryResponse;
  const collection = responseJson.data?.collection;
  const appInstallationId = responseJson.data?.currentAppInstallation?.id;
  const savedPackagingVariantId =
    responseJson.data?.currentAppInstallation?.packagingVariantId?.value;

  if (!collection) {
    return {
      intent: BIKE_SHIPPING_INTENT,
      success: false,
      price: parsedPrice.price,
      collectionId,
      collection: null,
      errors: {
        bikeShippingCollection: "Wybierz poprawną kolekcję.",
      },
    };
  }

  if (!appInstallationId) {
    return {
      intent: BIKE_SHIPPING_INTENT,
      success: false,
      price: parsedPrice.price,
      collectionId,
      collection: null,
      errors: {
        bikeShippingCollection:
          "Nie udało się odczytać instalacji aplikacji. Spróbuj ponownie.",
      },
    };
  }

  const selectedCollection = toCollectionOption(collection);

  try {
    const packagingVariantId = await getPackagingVariantId(
      admin,
      appInstallationId,
      savedPackagingVariantId,
      parsedPrice.price,
    );
    const cartTransformConfigurationValue =
      buildBikeShippingFunctionConfiguration({
        price: parsedPrice.price,
        collectionId: selectedCollection.id,
        packagingVariantId,
      });
    const saveResponse = await admin.graphql(
      `#graphql
        mutation BikeShippingSettingsSave($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors {
              field
              message
              code
            }
          }
        }`,
      {
        variables: {
          metafields: [
            {
              namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
              key: BIKE_SHIPPING_PRICE_KEY,
              ownerId: appInstallationId,
              type: "single_line_text_field",
              value: parsedPrice.price,
            },
            {
              namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
              key: BIKE_SHIPPING_COLLECTION_ID_KEY,
              ownerId: appInstallationId,
              type: "single_line_text_field",
              value: selectedCollection.id,
            },
            {
              namespace: BIKE_SHIPPING_METAFIELD_NAMESPACE,
              key: BIKE_SHIPPING_PACKAGING_VARIANT_ID_KEY,
              ownerId: appInstallationId,
              type: "single_line_text_field",
              value: packagingVariantId,
            },
          ],
        },
      },
    );
    const saveJson = (await saveResponse.json()) as MetafieldsSetResponse;
    const saveErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];
    const saveErrorMessage = getGraphQLErrorMessage(
      saveErrors,
      saveJson.errors,
    );

    if (saveErrorMessage || !saveJson.data?.metafieldsSet) {
      console.error("Unable to save bike shipping app-data metafields", {
        graphQLErrors: saveJson.errors,
        userErrors: saveErrors,
      });

      return {
        intent: BIKE_SHIPPING_INTENT,
        success: false,
        price: parsedPrice.price,
        collectionId: selectedCollection.id,
        collection: null,
        errors: {
          bikeShippingCollection:
            saveErrorMessage ?? "Nie udało się zapisać ustawień.",
        },
      };
    }

    await saveCartTransformConfiguration(admin, cartTransformConfigurationValue);
  } catch (error) {
    console.error("Unable to save bike shipping app-data metafields", error);
    const errorMessage = error instanceof Error ? error.message : null;

    return {
      intent: BIKE_SHIPPING_INTENT,
      success: false,
      price: parsedPrice.price,
      collectionId: selectedCollection.id,
      collection: null,
      errors: {
        bikeShippingCollection:
          errorMessage ?? "Nie udało się zapisać ustawień. Spróbuj ponownie.",
      },
    };
  }

  return {
    intent: BIKE_SHIPPING_INTENT,
    success: true,
    price: parsedPrice.price,
    collectionId: selectedCollection.id,
    collection: selectedCollection,
    errors: {},
  };
};

export default function PrzesylkiPage() {
  const {
    collections,
    locations,
    settings,
    locationShippingTimeSettings: loadedLocationShippingTimeSettings,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const bikeShippingActionData =
    actionData?.intent === BIKE_SHIPPING_INTENT ? actionData : undefined;
  const locationShippingTimeActionData =
    actionData?.intent === LOCATION_SHIPPING_TIME_INTENT
      ? actionData
      : undefined;
  const [bikeShippingPrice, setBikeShippingPrice] = useState(
    bikeShippingActionData?.price ?? settings.bikeShippingPrice,
  );
  const [bikeShippingCollectionId, setBikeShippingCollectionId] = useState(
    bikeShippingActionData?.collectionId ?? settings.bikeShippingCollectionId,
  );
  const [locationShippingTimeSettings, setLocationShippingTimeSettings] =
    useState(loadedLocationShippingTimeSettings);
  const submittingIntent = String(
    navigation.formData?.get(ACTION_INTENT_FIELD) ?? "",
  );
  const submittingLocationId = String(
    navigation.formData?.get(LOCATION_ID_FIELD) ?? "",
  );
  const isSubmitting = navigation.state === "submitting";
  const isBikeShippingSubmitting =
    isSubmitting &&
    (!submittingIntent || submittingIntent === BIKE_SHIPPING_INTENT);
  const bikeShippingPriceError =
    bikeShippingActionData?.success === false
      ? bikeShippingActionData.errors.bikeShippingPrice
      : undefined;
  const bikeShippingCollectionError =
    bikeShippingActionData?.success === false
      ? bikeShippingActionData.errors.bikeShippingCollection
      : undefined;
  const savedCollection = bikeShippingActionData?.success
    ? bikeShippingActionData.collection
    : bikeShippingActionData
      ? null
      : collections.find(
          (collection) => collection.id === settings.bikeShippingCollectionId,
        ) ?? null;

  useEffect(() => {
    if (!actionData) return;

    if (actionData.intent === BIKE_SHIPPING_INTENT) {
      setBikeShippingPrice(actionData.price);
      setBikeShippingCollectionId(actionData.collectionId);

      if (actionData.success) {
        shopify.toast.show(
          `Koszt przesyłki zapisany dla kolekcji ${actionData.collection.name}`,
        );
      }

      return;
    }

    if (actionData.success) {
      setLocationShippingTimeSettings(actionData.settings);
      shopify.toast.show(
        `Czas przesyłki zapisany dla lokalizacji ${actionData.location.name}`,
      );

      return;
    }

    if (actionData.locationId) {
      setLocationShippingTimeSettings((currentSettings) => ({
        ...currentSettings,
        [actionData.locationId]: actionData.values,
      }));
    }
  }, [actionData, shopify]);

  return (
    <s-page heading="Przesyłki">
      <s-section heading="Koszty przesyłki">
        <Form method="post">
          <input
            type="hidden"
            name={ACTION_INTENT_FIELD}
            value={BIKE_SHIPPING_INTENT}
          />
          <s-stack direction="block" gap="base">
            <s-number-field
              name={BIKE_SHIPPING_PRICE_FIELD}
              label="Koszt przesyłki roweru"
              value={bikeShippingPrice}
              placeholder="0.00"
              inputMode="decimal"
              step={0.01}
              min={0}
              required
              autocomplete="off"
              error={bikeShippingPriceError}
              onChange={(event) => {
                setBikeShippingPrice(event.currentTarget.value);
              }}
              onBlur={() => {
                const parsedPrice = parseBikeShippingPrice(bikeShippingPrice);

                if (parsedPrice.success) {
                  setBikeShippingPrice(parsedPrice.price);
                }
              }}
            ></s-number-field>
            <s-select
              name={BIKE_SHIPPING_COLLECTION_ID_FIELD}
              label="Kolekcja dla przesyłki roweru"
              placeholder="Wybierz kolekcję"
              value={bikeShippingCollectionId}
              icon="collection"
              required
              disabled={collections.length === 0}
              error={bikeShippingCollectionError}
              onChange={(event) => {
                setBikeShippingCollectionId(event.currentTarget.value);
              }}
            >
              {collections.map((collection) => (
                <s-option key={collection.id} value={collection.id}>
                  {collection.name}
                </s-option>
              ))}
            </s-select>
            <s-button
              type="submit"
              {...(isBikeShippingSubmitting ? { loading: true } : {})}
            >
              Zapisz
            </s-button>
          </s-stack>
        </Form>
        {savedCollection && (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-paragraph>
                <s-text>ID: </s-text>
                <s-text>{savedCollection.id}</s-text>
              </s-paragraph>
              <s-paragraph>
                <s-text>UID: </s-text>
                <s-text>{savedCollection.uid}</s-text>
              </s-paragraph>
              <s-paragraph>
                <s-text>Nazwa: </s-text>
                <s-text>{savedCollection.name}</s-text>
              </s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>
      <s-section heading="Czas przesyłki wg lokalizacji">
        {locations.length === 0 ? (
          <s-paragraph>Brak lokalizacji do skonfigurowania.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {locations.map((location) => {
              const setting =
                locationShippingTimeSettings[location.id] ??
                emptyLocationShippingTimeSetting;
              const locationActionData =
                locationShippingTimeActionData?.locationId === location.id
                  ? locationShippingTimeActionData
                  : undefined;
              const isLocationSubmitting =
                isSubmitting &&
                submittingIntent === LOCATION_SHIPPING_TIME_INTENT &&
                submittingLocationId === location.id;

              return (
                <s-box
                  key={location.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                >
                  <Form method="post">
                    <input
                      type="hidden"
                      name={ACTION_INTENT_FIELD}
                      value={LOCATION_SHIPPING_TIME_INTENT}
                    />
                    <input
                      type="hidden"
                      name={LOCATION_ID_FIELD}
                      value={location.id}
                    />
                    <input
                      type="hidden"
                      name={LOCATION_SHIPPING_TIMES_FIELD}
                      value={serializeLocationShippingTimeSettings(
                        locationShippingTimeSettings,
                      )}
                    />
                    <s-stack direction="block" gap="base">
                      <s-heading>{location.name}</s-heading>
                      {locationActionData?.success === false &&
                        locationActionData.errors.location && (
                          <s-paragraph>
                            {locationActionData.errors.location}
                          </s-paragraph>
                        )}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                          gap: "1rem",
                          alignItems: "start",
                        }}
                      >
                        <s-number-field
                          name={SHIPPING_TIME_DAYS_FIELD}
                          label="czas przesyłki(dni)"
                          value={setting.shippingTimeDays}
                          inputMode="numeric"
                          step={1}
                          min={0}
                          required
                          autocomplete="off"
                          error={
                            locationActionData?.success === false
                              ? locationActionData.errors.shippingTimeDays
                              : undefined
                          }
                          onChange={(event) => {
                            const value = event.currentTarget.value;

                            setLocationShippingTimeSettings(
                              (currentSettings) => ({
                                ...currentSettings,
                                [location.id]: {
                                  ...(currentSettings[location.id] ??
                                    emptyLocationShippingTimeSetting),
                                  shippingTimeDays: value,
                                },
                              }),
                            );
                          }}
                        ></s-number-field>
                        <s-text-field
                          name={SHIPPING_TIME_LABEL_FIELD}
                          label="czas przesłki - label"
                          value={setting.shippingTimeLabel}
                          required
                          autocomplete="off"
                          error={
                            locationActionData?.success === false
                              ? locationActionData.errors.shippingTimeLabel
                              : undefined
                          }
                          onChange={(event) => {
                            const value = event.currentTarget.value;

                            setLocationShippingTimeSettings(
                              (currentSettings) => ({
                                ...currentSettings,
                                [location.id]: {
                                  ...(currentSettings[location.id] ??
                                    emptyLocationShippingTimeSetting),
                                  shippingTimeLabel: value,
                                },
                              }),
                            );
                          }}
                        ></s-text-field>
                      </div>
                      <s-button
                        type="submit"
                        {...(isLocationSubmitting ? { loading: true } : {})}
                      >
                        Zapisz
                      </s-button>
                    </s-stack>
                  </Form>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
