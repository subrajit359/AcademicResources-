import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
}, { timestamps: true });

schema.index({ from: 1, to: 1 }, { unique: true });
schema.index({ to: 1, status: 1 });

export default mongoose.model('FriendRequest', schema);
