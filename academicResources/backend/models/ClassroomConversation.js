import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  type: { type: String, enum: ['direct', 'group'], required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  name: { type: String },
  avatar: { type: String },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  inviteCode: { type: String, unique: true, sparse: true },
  disappearAfter: { type: Number, default: 86400000 },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomMessage' },
  lastActivity: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clearedAt: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }],
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedBy: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, until: { type: Date, default: null } }],
  pinnedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomMessage', default: null },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.index({ participants: 1 });
schema.index({ inviteCode: 1 });

export default mongoose.model('ClassroomConversation', schema);
