'use client'

import React, { useState } from 'react'
import { Hamburger, Menu, X } from 'lucide-react'
import NavLinks from './NavLinks'

const HamburgerIcon = () => {

  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className='md:hidden'>

      {/* Button */}
      <button onClick={() => setIsOpen(!isOpen)}>

        {isOpen ? <X size={30} /> : <Hamburger size={30} />}

      </button>

      {/* Mobile Menu */}
      {isOpen && (
        <div className='absolute top-20 right-0 w-full h-30 bg-brand-dark flex flex-col items-center gap-5 p-5 border-t border-brand-border'>

          <NavLinks />

        </div>
      )}

    </div>
  )
}

export default HamburgerIcon