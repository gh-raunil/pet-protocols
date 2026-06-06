'use client'
import ProductCard from "@/app/components/products/ProductCard";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function MenuContent() {
  const searchParams = useSearchParams()
  const categoryFromUrl = searchParams.get('category') || 'All'
  const searchFromUrl = searchParams.get('search') || ''

  const [products, setProducts] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSelectedCategory(categoryFromUrl)
  }, [categoryFromUrl])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        let url = '/api/products?'
        if (selectedCategory !== 'All') url += `category=${selectedCategory}&`
        if (searchFromUrl) url += `search=${encodeURIComponent(searchFromUrl)}`
        const res = await fetch(url)
        const data = await res.json()
        setProducts(data.products || [])
      } catch (error) {
        console.log(error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [selectedCategory, searchFromUrl])

  const categories = ["All", "Burger", "Pizza", "Fries", "Momos", "Cold Drinks"]

  return (
    <main className="min-h-screen pt-32 pb-20 px-6">
      <div className="text-center mb-14">
        {searchFromUrl ? (
          <>
            <h1 className="text-5xl md:text-6xl font-bold">
              Results for <span className="text-brand-orange">"{searchFromUrl}"</span>
            </h1>
            <p className="text-brand-muted mt-4 text-lg">
              {loading ? 'Searching...' : `${products.length} item${products.length !== 1 ? 's' : ''} found`}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-5xl md:text-6xl font-bold">
              Our <span className="text-brand-orange">Menu</span>
            </h1>
            <p className="text-brand-muted mt-4 text-lg">Fresh food. Zero compromises.</p>
          </>
        )}
      </div>

      {!searchFromUrl && (
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {categories.map((category) => (
            <button key={category} onClick={() => setSelectedCategory(category)}
              className={`px-6 py-3 rounded-full border transition duration-300
                ${selectedCategory === category
                  ? "bg-brand-orange text-black border-brand-orange"
                  : "border-brand-border text-white hover:border-brand-orange"
                }`}>
              {category}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-brand-card rounded-3xl overflow-hidden border border-brand-border animate-pulse">
              <div className="h-52 bg-brand-border" />
              <div className="p-5 space-y-3">
                <div className="h-3 bg-brand-border rounded-full w-1/3" />
                <div className="h-5 bg-brand-border rounded-full w-3/4" />
                <div className="h-3 bg-brand-border rounded-full w-full" />
                <div className="h-3 bg-brand-border rounded-full w-2/3" />
                <div className="h-10 bg-brand-border rounded-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-6xl">🍽️</p>
          <h2 className="text-2xl font-bold text-white">
            {searchFromUrl ? 'No results found' : 'No products available'}
          </h2>
          <p className="text-brand-muted text-center max-w-sm">
            {searchFromUrl
              ? `We couldn't find anything matching "${searchFromUrl}". Try a different search.`
              : 'Check back later for new items!'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}

export default function MenuClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-brand-muted text-xl animate-pulse">Loading menu...</p>
      </div>
    }>
      <MenuContent />
    </Suspense>
  )
}