'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NavLinks = () => {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Home' },
    { href: '/menu', label: 'Menu' },
    { href: '/offers', label: 'Offers' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ]

  return (
    <div className='flex gap-10'>
      {links.map(link => (
        <Link key={link.href} href={link.href}
          className={`transition hover:text-white ${
            pathname === link.href
              ? 'text-white font-semibold'
              : 'text-brand-muted'
          }`}>
          {link.label}
        </Link>
      ))}
    </div>
  )
}
export default NavLinks