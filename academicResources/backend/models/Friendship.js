import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomConversation' },
}, { timestamps: true });

schema.index({ users: 1 });

export default mongoose.model('Friendship', schema);
