import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  details: { type: String },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomMessage', default: null },
  messageContent: { type: String, default: null },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
  adminNote: { type: String, default: null },
}, { timestamps: true });

schema.index({ reporter: 1, reported: 1 });

export default mongoose.model('ClassroomReport', schema);
