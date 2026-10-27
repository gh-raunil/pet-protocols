import OrderDetailClient from "./OrderDetailClient";

export async function generateMetadata({ params }) {
  const resolvedParams = params ? await params : {};
  const { id } = resolvedParams;
  const shortId = id ? (id.length === 24 ? `#${id.slice(-6).toUpperCase()}` : `#${id}`) : "";
  return {
    title: shortId ? `Order ${shortId} Details | पेट Protocols` : "Order Details | पेट Protocols",
    description: "View itemized receipt, kitchen status, live tracking, and fulfillment details for your order.",
  };
}

export default async function OrderDetailPage({ params }) {
  const resolvedParams = params ? await params : {};
  const { id } = resolvedParams;
  return <OrderDetailClient orderId={id} />;
}
