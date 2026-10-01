import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:4000";
    const res = await fetch(`${backendUrl}/api/products/${id}`, { cache: "no-store" });
    if (!res.ok) return { title: "Dish Details | Pet Protocols" };
    const data = await res.json();
    return {
      title: `${data.product?.name || "Dish"} | Pet Protocols`,
      description: data.product?.description || "Order fresh food on Pet Protocols.",
    };
  } catch {
    return { title: "Dish Details | Pet Protocols" };
  }
}

export default async function ProductPage({ params }) {
  const { id } = await params;

  const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:4000";
  const response = await fetch(`${backendUrl}/api/products/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) notFound();

  const data = await response.json();
  const product = data.product;

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
