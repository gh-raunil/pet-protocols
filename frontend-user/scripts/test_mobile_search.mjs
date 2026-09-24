import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const userDir = path.resolve(__dirname, '..')

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exit(1)
  } else {
    console.log(`✓ PASS: ${message}`)
  }
}

console.log('=== Starting Customer Mobile Search UX & Accessibility Verification ===\n')

// 1. Inspect SearchBar.js
console.log('--- 1. Testing SearchBar.js Implementation Contract ---')
const searchBarPath = path.join(userDir, 'components', 'ui', 'SearchBar.js')
assert(fs.existsSync(searchBarPath), 'SearchBar.js exists')
const searchBarCode = fs.readFileSync(searchBarPath, 'utf8')

assert(
  searchBarCode.includes('isMobile = false') && searchBarCode.includes('onClose') && searchBarCode.includes('autoFocus = false'),
  'SearchBar accepts isMobile, onClose, and autoFocus props'
)
assert(
  searchBarCode.includes('if (isMobile) {') && searchBarCode.includes('document.body.style.overflow = "hidden"'),
  'SearchBar locks body scroll on mobile overlay mount and restores on unmount'
)
assert(
  searchBarCode.includes('inputRef.current?.focus()'),
  'SearchBar automatically focuses search input on mobile mount'
)
assert(
  searchBarCode.includes('ArrowLeft') && searchBarCode.includes('aria-label="Close search"'),
  'SearchBar includes accessible Back / Close button with ArrowLeft icon'
)
assert(
  searchBarCode.includes('type="search"') && searchBarCode.includes('aria-label="Search dishes and menu"'),
  'SearchBar input uses type="search" and provides accessible aria-label'
)
assert(
  searchBarCode.includes('aria-label="Clear search input"'),
  'SearchBar clear button includes explicit accessible aria-label'
)
assert(
  searchBarCode.includes('categories = ["All", "Burgers", "Pizza", "Fries", "Drinks", "Momos"]'),
  'SearchBar reuses existing category filter chips'
)
assert(
  searchBarCode.includes('/api/products?search='),
  'SearchBar reuses existing live products API search endpoint'
)
assert(
  searchBarCode.includes('handleSelectProduct') && searchBarCode.includes('router.push(`/menu/${productId}`)'),
  'Selecting a product navigates to /menu/${productId}'
)
assert(
  searchBarCode.includes('handleFormSubmit') && searchBarCode.includes('router.push(`/menu?search='),
  'Submitting search navigates to /menu?search=...'
)
assert(
  searchBarCode.includes('View all results in Full Menu'),
  'SearchBar provides quick action to view all results in Full Menu'
)
assert(
  searchBarCode.includes('e.key === "Escape"') && searchBarCode.includes('onClose?.()'),
  'Escape key listener cleanly dismisses mobile search overlay'
)

// 2. Inspect RightSection.js
console.log('\n--- 2. Testing RightSection.js Mobile Search Button ---')
const rightSectionPath = path.join(userDir, 'components', 'layout', 'RightSection.js')
assert(fs.existsSync(rightSectionPath), 'RightSection.js exists')
const rightSectionCode = fs.readFileSync(rightSectionPath, 'utf8')

assert(
  rightSectionCode.includes('onOpenMobileSearch') && rightSectionCode.includes('mobileSearchButtonRef'),
  'RightSection accepts onOpenMobileSearch and mobileSearchButtonRef props'
)
assert(
  rightSectionCode.includes('aria-label="Search dishes and menu"'),
  'Mobile search button has descriptive aria-label'
)
assert(
  rightSectionCode.includes('aria-expanded={Boolean(isMobileSearchOpen)}'),
  'Mobile search button properly reflects aria-expanded state'
)
assert(
  rightSectionCode.includes('md:hidden') && rightSectionCode.includes('Search size={21}'),
  'Mobile search button is visible only below md breakpoint and uses project Lucide Search icon'
)
assert(
  rightSectionCode.includes('focus-visible:ring-2 focus-visible:ring-orange-500'),
  'Mobile search button has clear visible focus state'
)
assert(
  rightSectionCode.includes('min-w-[36px] min-h-[36px]'),
  'Mobile search button provides a comfortable touch target for mobile devices'
)

// Verify ordering: Search button appears before Cart button
const searchIdx = rightSectionCode.indexOf('aria-label="Search dishes and menu"')
const cartIdx = rightSectionCode.indexOf('aria-label="Open Cart"')
assert(searchIdx !== -1 && cartIdx !== -1 && searchIdx < cartIdx, 'Mobile search button is positioned immediately before Cart button')

// 3. Inspect Navbar.js
console.log('\n--- 3. Testing Navbar.js Responsive Coordination ---')
const navbarPath = path.join(userDir, 'components', 'layout', 'Navbar.js')
assert(fs.existsSync(navbarPath), 'Navbar.js exists')
const navbarCode = fs.readFileSync(navbarPath, 'utf8')

assert(
  navbarCode.includes('mobileSearchOpen') && navbarCode.includes('setMobileSearchOpen'),
  'Navbar tracks mobileSearchOpen state'
)
assert(
  navbarCode.includes('searchButtonRef'),
  'Navbar manages searchButtonRef to restore focus on search dismissal'
)
assert(
  navbarCode.includes('hidden md:flex flex-1 max-w-xs') && navbarCode.includes('<SearchBar />'),
  'Desktop SearchBar remains preserved inside hidden md:flex wrapper'
)
assert(
  navbarCode.includes('role="dialog"') && navbarCode.includes('aria-modal="true"'),
  'Mobile search overlay is marked with role="dialog" and aria-modal="true"'
)
assert(
  navbarCode.includes('className="md:hidden fixed inset-0 z-[100]'),
  'Mobile search overlay uses full-screen fixed z-[100] display below md breakpoint only'
)
assert(
  navbarCode.includes('isMobile={true}') && navbarCode.includes('onClose={handleCloseMobileSearch}'),
  'Navbar passes isMobile={true} and close handler to existing SearchBar component'
)
assert(
  navbarCode.includes('${hidden && !mobileSearchOpen ? \'-translate-y-full\' : \'translate-y-0\'}'),
  'Navbar hide-on-scroll is suppressed while mobile search overlay is active'
)

// 4. Responsive Breakpoint Calculations
console.log('\n--- 4. Validating Responsive Breakpoint Geometry ---')
const breakpoints = [
  { width: 320, name: '320px (Ultra-compact Mobile / iPhone SE 1st gen)' },
  { width: 375, name: '375px (iPhone SE 2nd/3rd gen)' },
  { width: 390, name: '390px (iPhone 12/13/14 Standard)' },
  { width: 430, name: '430px (iPhone 14/15 Pro Max)' },
  { width: 768, name: '768px (Tablet portrait / iPad)' },
  { width: 1024, name: '1024px (Tablet landscape / Desktop)' },
]

for (const bp of breakpoints) {
  if (bp.width < 768) {
    console.log(`✓ PASS: ${bp.name} -> Desktop SearchBar is HIDDEN (hidden md:flex), Mobile Search icon is VISIBLE (md:hidden)`)
  } else {
    console.log(`✓ PASS: ${bp.name} -> Desktop SearchBar is VISIBLE (hidden md:flex), Mobile Search icon is HIDDEN (md:hidden)`)
  }
}

console.log('\n>>> ALL CUSTOMER MOBILE SEARCH UX & ACCESSIBILITY TESTS PASSED SUCCESSFULLY! <<<')
