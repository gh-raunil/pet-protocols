'use client'

import Link from 'next/link'
import Image from 'next/image'

import {
  Minus,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import useCartStore from '@/lib/cartStore'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const CartDrawer = () => {
  const {
    items,
    isOpen,
    closeCart,
    increaseQty,
    decreaseQty,
    removeItem,
    getTotalPrice,
  } = useCartStore()

  const { data: session } = useSession()
  const router = useRouter()

  const handleCheckout = () => {
    if (!session) {
      router.push('/auth/login')
      return
    }
    router.push('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={closeCart}
        className={`
          fixed inset-0 bg-black/60 backdrop-blur-sm z-40
          transition-all duration-300
          ${isOpen
            ? 'opacity-100 visible'
            : 'opacity-0 invisible'}
        `}
      />

      {/* Drawer */}
      <div
        className={`
          fixed
          top-0
          right-0
          h-screen
          w-full
          sm:w-[420px]
          bg-black
          border-l
          border-brand-border
          z-50
          flex
          flex-col
          transition-all
          duration-300
          ease-in-out
          ${isOpen
            ? 'translate-x-0'
            : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-3xl font-bold">
            Your Cart
          </h2>

          <button
            onClick={closeCart}
            className="
              w-10 h-10
              rounded-full
              bg-brand-card
              border
              border-brand-orange/40
              flex items-center justify-center
              hover:bg-brand-border
              transition
            "
          >
            <X size={18} />
          </button>
        </div>

        {/* Empty Cart */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <h3 className="text-2xl font-bold mb-2">
              Your cart is empty 🍔
            </h3>

            <p className="text-brand-muted mb-6">
              Add something delicious
            </p>

            <Link
              href="/menu"
              onClick={closeCart}
              className="
                bg-brand-orange
                text-black
                px-6
                py-3
                rounded-full
                font-semibold
              "
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.map((item) => (
                <div
                  key={item._id || item.productId}
                  className="
                    bg-brand-card
                    border border-brand-border
                    rounded-2xl
                    p-4
                    flex gap-4
                  "
                >
                  {/* Image */}
                  <Image
                    src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500"}
                    alt={item.name}
                    width={80}
                    height={80}
                    className="
                      w-20 h-20
                      rounded-xl
                      object-cover
                    "
                  />

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {item.name}
                        </h3>

                        <p className="text-brand-orange font-bold mt-1">
                          ₹{item.price}
                        </p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(item._id)}
                        className="text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => decreaseQty(item._id)}
                        className="
                          w-8 h-8
                          rounded-full
                          border border-brand-border
                          flex items-center justify-center
                        "
                      >
                        <Minus size={14} />
                      </button>

                      <span className="font-semibold">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => increaseQty(item._id)}
                        className="
                          w-8 h-8
                          rounded-full
                          bg-brand-orange
                          text-black
                          flex items-center justify-center
                        "
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-brand-border p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="text-brand-muted">
                  Total
                </span>

                <h2 className="text-3xl font-bold text-brand-orange">
                  ₹{getTotalPrice()}
                </h2>
              </div>

              <Link
                href="/cart"
                onClick={closeCart}
                className="
                  w-full
                  bg-brand-orange
                  text-black
                  py-4
                  rounded-2xl
                  font-bold
                  text-center
                  block
                  hover:scale-[1.02]
                  transition
                "
              >
                View Full Cart →
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default CartDrawer