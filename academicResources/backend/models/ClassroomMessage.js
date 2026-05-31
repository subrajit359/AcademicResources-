import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
  emoji: String,
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  url: String,
  type: { type: String, enum: ['image', 'file', 'voice'] },
  name: String,
  size: Number,
  mimeType: String,
  duration: Number,
}, { _id: false });

const schema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomConversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: [attachmentSchema],
  reactions: [reactionSchema],
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomMessage', default: null },
  status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
  seenBy: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }],
  deliveredTo: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }],
  edited: { type: Boolean, default: false },
  editedAt: { type: Date },
  editHistory: [{ text: String, editedAt: Date }],
  deletedForEveryone: { type: Boolean, default: false },
  disappearAt: { type: Date },
  type: { type: String, enum: ['text', 'system', 'groupInvite'], default: 'text' },
  groupInvite: {
    groupId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomConversation' },
    groupName: String,
    inviteCode: String,
  },
}, { timestamps: true });

schema.index({ conversation: 1, createdAt: -1 });
schema.index({ disappearAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('ClassroomMessage', schema);
