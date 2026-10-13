import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const defaultBackendUrl = process.env.NODE_ENV === "development"
      ? "http://localhost:4000"
      : "https://pet-protocols-backend.vercel.app";
    const backendUrl = process.env.BACKEND_INTERNAL_URL || defaultBackendUrl;
    const res = await fetch(`${backendUrl}/api/products/${id}`, { cache: "no-store" });
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

  const defaultBackendUrl = process.env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : "https://pet-protocols-backend.vercel.app";
  const backendUrl = process.env.BACKEND_INTERNAL_URL || defaultBackendUrl;
  const response = await fetch(`${backendUrl}/api/products/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) notFound();

  const data = await response.json();
  const product = data.product;

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
