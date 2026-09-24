import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';

// GET — List all saved addresses for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select('addresses');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      addresses: user.addresses || [],
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST — Add a new saved address
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { label, fullName, phone, street, city, state, pincode, isDefault } = body;

    if (!fullName || !phone || !street || !city || !state || !pincode) {
      return NextResponse.json(
        { success: false, message: 'All address fields (Full Name, Phone, Street, City, State, Pincode) are required.' },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if (!user.addresses) user.addresses = [];

    // If this is the user's first address or requested as default, mark as default
    const shouldBeDefault = isDefault || user.addresses.length === 0;

    if (shouldBeDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    const newAddress = {
      label: label ? label.trim() : 'Home',
      fullName: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault: shouldBeDefault,
    };

    user.addresses.push(newAddress);
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Address saved successfully',
      addresses: user.addresses,
      address: user.addresses[user.addresses.length - 1],
    });
  } catch (error) {
    console.error('Error saving address:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT — Update an existing address or set default
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { addressId, action, label, fullName, phone, street, city, state, pincode, isDefault } = body;

    if (!addressId) {
      return NextResponse.json({ success: false, message: 'Address ID is required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const targetAddr = user.addresses?.id(addressId);
    if (!targetAddr) {
      return NextResponse.json({ success: false, message: 'Address not found' }, { status: 404 });
    }

    // Set Default action
    if (action === 'set_default' || isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = addr._id.toString() === addressId.toString();
      });
    }

    // Update details if provided
    if (label !== undefined) targetAddr.label = label.trim();
    if (fullName !== undefined) targetAddr.fullName = fullName.trim();
    if (phone !== undefined) targetAddr.phone = phone.trim();
    if (street !== undefined) targetAddr.street = street.trim();
    if (city !== undefined) targetAddr.city = city.trim();
    if (state !== undefined) targetAddr.state = state.trim();
    if (pincode !== undefined) targetAddr.pincode = pincode.trim();

    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Address updated successfully',
      addresses: user.addresses,
    });
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE — Remove an address by ID
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get('id');

    if (!addressId) {
      return NextResponse.json({ success: false, message: 'Address ID is required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const wasDefault = user.addresses.id(addressId)?.isDefault;
    user.addresses.pull({ _id: addressId });

    // If we deleted the default address, make the first remaining address default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
      addresses: user.addresses,
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
