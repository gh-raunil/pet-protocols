import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const defaultBackendUrl =
      process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:4000"
        : "https://pet-protocols-backend.vercel.app";
    const backendUrl = process.env.BACKEND_INTERNAL_URL || defaultBackendUrl;
    const res = await fetch(`${backendUrl}/api/products/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { title: "Dish Details | पेट Protocols" };
    const data = await res.json();
    return {
      title: `${data.product?.name || "Dish"} | पेट Protocols`,
      description: data.product?.description || "Order fresh food on पेट Protocols.",
    };
  } catch {
    return { title: "Dish Details | पेट Protocols" };
  }
}

export default async function ProductPage({ params }) {
  const { id } = await params;

  const defaultBackendUrl =
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:4000"
      : "https://pet-protocols-backend.vercel.app";
  const backendUrl = process.env.BACKEND_INTERNAL_URL || defaultBackendUrl;

  let response;
  try {
    response = await fetch(`${backendUrl}/api/products/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error(`ProductPage SSR: Network error or timeout fetching product "${id}":`, err?.message || err);
    throw new Error("Unable to connect to kitchen service. Please check your connection and try again.");
  }

  // If item is truly not found or ID is malformed (404 or 400), render Next.js notFound page
  if (response.status === 404 || response.status === 400) {
    notFound();
  }

  // If backend returned a 5xx server error, trigger Next.js error boundary rather than pretending it's 404
  if (!response.ok) {
    console.error(`ProductPage SSR: Server responded with status ${response.status} for product "${id}"`);
    throw new Error(`Kitchen service error (${response.status}). Please try again later.`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error(`ProductPage SSR: Failed to parse JSON response for product "${id}":`, err?.message || err);
    throw new Error("Invalid response received from kitchen service.");
  }

  const product = data?.product;
  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
