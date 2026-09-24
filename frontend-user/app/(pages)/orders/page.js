import OrdersClient from './OrdersClient'

export const metadata = {
  title: 'My Orders',
  description: 'View your order history and track deliveries.',
}

export default function OrdersPage() {
  return <OrdersClient />
}