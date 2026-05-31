import jwt from 'jsonwebtoken';
import ClassroomMessage from '../models/ClassroomMessage.js';
import ClassroomConversation from '../models/ClassroomConversation.js';

const SECRET = process.env.JWT_SECRET || 'academic-hub-secret-key';
const onlineUsers = new Map(); // userId -> socketId

export function initClassroomSocket(io) {
  const nsp = io.of('/classroom');

  nsp.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  nsp.on('connection', (socket) => {
    const uid = socket.userId;
    onlineUsers.set(uid, socket.id);
    nsp.emit('user:online', { userId: uid });

    // Update lastSeen in DB
    import('../models/User.js').then(({ default: User }) => {
      User.findByIdAndUpdate(uid, { lastSeen: new Date() }).catch(() => {});
    });

    socket.on('join:conversations', (conversationIds = []) => {
      conversationIds.forEach(id => socket.join(`conv:${id}`));
    });

    socket.on('join:conversation', (convId) => {
      socket.join(`conv:${convId}`);
    });

    socket.on('leave:conversation', (convId) => {
      socket.leave(`conv:${convId}`);
    });

    // Typing
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId: uid, conversationId });
    });
    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId: uid, conversationId });
    });

    // Message delivered
    socket.on('msg:delivered', async ({ messageId, conversationId }) => {
      try {
        const msg = await ClassroomMessage.findByIdAndUpdate(
          messageId,
          {
            $addToSet: { deliveredTo: { user: uid, at: new Date() } },
            $set: { status: 'delivered' },
          },
          { new: true }
        );
        if (msg) {
          nsp.to(`conv:${conversationId}`).emit('msg:delivered', { messageId, userId: uid, conversationId });
        }
      } catch {}
    });

    // Message seen
    socket.on('msg:seen', async ({ messageId, conversationId }) => {
      try {
        const msg = await ClassroomMessage.findByIdAndUpdate(
          messageId,
          {
            $addToSet: { seenBy: { user: uid, at: new Date() } },
            $set: { status: 'seen' },
          },
          { new: true }
        );
        if (msg) {
          nsp.to(`conv:${conversationId}`).emit('msg:seen', { messageId, userId: uid, conversationId });
        }
      } catch {}
    });

    // Bulk mark delivered (called when user connects / loads conversations)
    socket.on('msgs:delivered', async ({ conversationIds = [] }) => {
      try {
        for (const conversationId of conversationIds) {
          const updated = await ClassroomMessage.find({
            conversation: conversationId,
            sender: { $ne: uid },
            'deliveredTo.user': { $ne: uid },
          }).select('_id').lean();
          if (updated.length === 0) continue;
          await ClassroomMessage.updateMany(
            { _id: { $in: updated.map(m => m._id) } },
            { $addToSet: { deliveredTo: { user: uid, at: new Date() } }, $set: { status: 'delivered' } }
          );
          nsp.to(`conv:${conversationId}`).emit('msgs:delivered', { userId: uid, conversationId });
        }
      } catch {}
    });

    // Bulk mark seen
    socket.on('msgs:seen', async ({ conversationId }) => {
      try {
        await ClassroomMessage.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: uid },
            'seenBy.user': { $ne: uid },
          },
          { $addToSet: { seenBy: { user: uid, at: new Date() } }, $set: { status: 'seen' } }
        );
        nsp.to(`conv:${conversationId}`).emit('msgs:seen', { userId: uid, conversationId });
      } catch {}
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(uid);
      const lastSeen = new Date();
      import('../models/User.js').then(({ default: User }) => {
        User.findByIdAndUpdate(uid, { lastSeen }).catch(() => {});
      });
      nsp.emit('user:offline', { userId: uid, lastSeen });
    });
  });

  return nsp;
}

export function getOnlineUsers() { return onlineUsers; }

export function emitToUser(nsp, userId, event, data) {
  const sid = onlineUsers.get(String(userId));
  if (sid) nsp.to(sid).emit(event, data);
}
