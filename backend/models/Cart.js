import mongoose from 'mongoose'

const CartItemSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String },
  price: { type: Number },
  image: { type: String },
  category: { type: String },
  type: { type: String },
  isAvailable: { type: Boolean },
  isFeatured: { type: Boolean },
  description: { type: String },
  quantity: { type: Number },
}, { _id: false })

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [CartItemSchema],
}, { timestamps: true })

export default mongoose.models.Cart || mongoose.model('Cart', CartSchema)