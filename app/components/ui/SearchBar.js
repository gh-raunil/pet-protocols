'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()
  const wrapperRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.products?.slice(0, 6) || [])
        setShowDropdown(true)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleSelect = (product) => {
    setQuery('')
    setShowDropdown(false)
    router.push(`/menu?search=${encodeURIComponent(product.name)}`)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setShowDropdown(false)
    router.push(`/menu?search=${encodeURIComponent(query)}`)
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-sm">

      {/* Search Input */}
      <form onSubmit={handleSearch}>
        <div className="flex items-center bg-brand-card border border-brand-border rounded-full px-4 py-2 gap-2 hover:border-brand-orange/50 transition focus-within:border-brand-orange">
          <Search size={16} className="text-brand-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search food..."
            className="bg-transparent text-white text-sm outline-none flex-1 placeholder-brand-muted"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setShowDropdown(false) }}>
              <X size={14} className="text-brand-muted hover:text-white transition" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute top-12 left-0 right-0 bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-2xl z-50">

          {loading ? (
            <div className="px-4 py-3 text-brand-muted text-sm text-center">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-brand-muted text-sm text-center">
              No results found
            </div>
          ) : (
            <>
              {results.map(product => (
                <button
                  key={product._id}
                  onClick={() => handleSelect(product)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-border transition text-left border-b border-brand-border last:border-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{product.name}</p>
                    <p className="text-brand-muted text-xs">{product.category} • ₹{product.price}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${product.type === 'veg'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                    }`}>
                    {product.type}
                  </span>
                </button>
              ))}

              {/* View all results */}
              <button
                onClick={handleSearch}
                className="w-full px-4 py-3 text-brand-orange text-sm font-medium hover:bg-brand-border transition text-center">
                View all results for "{query}" →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}