import React from 'react'
import Image from 'next/image'

const Logo = () => {
  return (
    <div className='text-brand-orange font-bold text-xl w-10 h-10 rounded-full overflow-hidden relative'>
      <Image src='/images/logo1.png' alt='Logo' width={40} height={40} className='rounded-full w-full h-full object-cover'/>
    </div>
  )
}

export default Logo