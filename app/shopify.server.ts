import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

function normalizeAppUrl(rawUrl?: string) {
  const trimmed = rawUrl?.trim().replace(/\/$/, "") || "";
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const appUrl =
  normalizeAppUrl(process.env.SHOPIFY_APP_URL) ||
  normalizeAppUrl(process.env.RAILWAY_STATIC_URL) ||
  normalizeAppUrl(process.env.RAILWAY_PUBLIC_DOMAIN);

console.log("[shopify.server] Starting initialization");
console.log("[shopify.server] NODE_ENV:", process.env.NODE_ENV);
console.log("[shopify.server] HOST:", process.env.HOST);
console.log("[shopify.server] PORT:", process.env.PORT);
console.log("[shopify.server] SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL);
console.log("[shopify.server] appUrl resolved:", appUrl);
console.log("[shopify.server] SHOPIFY_API_KEY set:", Boolean(process.env.SHOPIFY_API_KEY));
console.log("[shopify.server] SHOPIFY_API_SECRET set:", Boolean(process.env.SHOPIFY_API_SECRET));
console.log("[shopify.server] SCOPES:", process.env.SCOPES);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

console.log("[shopify.server] ShopAuthModule initialized, authPathPrefix: /auth");

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
