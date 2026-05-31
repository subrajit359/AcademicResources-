import express from 'express';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { verifyToken } from '../middleware/auth.js';
import ClassroomConversation from '../models/ClassroomConversation.js';
import ClassroomMessage from '../models/ClassroomMessage.js';
import FriendRequest from '../models/FriendRequest.js';
import Friendship from '../models/Friendship.js';
import ClassroomBlock from '../models/ClassroomBlock.js';
import ClassroomReport from '../models/ClassroomReport.js';
import User from '../models/User.js';

export default (upload, getIO) => {
  const router = express.Router();
  router.use(verifyToken);

  const me = (req) => req.userId;

  // ── helpers ──────────────────────────────────────────────────────────────
  const isBlocked = async (a, b) => {
    const block = await ClassroomBlock.findOne({
      $or: [{ blocker: a, blocked: b }, { blocker: b, blocked: a }],
    });
    return !!block;
  };

  const isFriend = async (a, b) => {
    const f = await Friendship.findOne({ users: { $all: [a, b] } });
    return !!f;
  };

  const emitToConv = (convId, event, data) => {
    try { getIO()?.of('/classroom').to(`conv:${convId}`).emit(event, data); } catch {}
  };

  const populateMsg = (q) =>
    q
      .populate('sender', 'name avatar role')
      .populate('replyTo', 'text sender attachments')
      .populate('seenBy.user', '_id')
      .populate('deliveredTo.user', '_id');

  // ── User Search ───────────────────────────────────────────────────────────
  router.get('/users/search', async (req, res) => {
    try {
      const q = req.query.q?.trim();
      if (!q) return res.json([]);
      const blocks = await ClassroomBlock.find({
        $or: [{ blocker: me(req) }, { blocked: me(req) }],
      });
      const blockedIds = blocks.map(b =>
        String(b.blocker) === me(req) ? b.blocked : b.blocker
      );
      const users = await User.find({
        _id: { $ne: me(req), $nin: blockedIds },
        $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
      }).select('name avatar role email').limit(20);
      res.json(users);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ── Friends ───────────────────────────────────────────────────────────────
  router.get('/friends', async (req, res) => {
    try {
      const friendships = await Friendship.find({ users: me(req) }).populate(
        'users', 'name avatar role lastSeen'
      );
      const friends = friendships.map(f => {
        const other = f.users.find(u => String(u._id) !== me(req));
        return { ...other?.toObject(), conversationId: f.conversationId };
      });
      res.json(friends);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.post('/friends/request', async (req, res) => {
    try {
      const { toUserId } = req.body;
      if (String(toUserId) === me(req)) return res.status(400).json({ message: 'Cannot friend yourself' });
      const target = await User.findById(toUserId);
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (['admin', 'teacher'].includes(target.role)) return res.status(400).json({ message: 'No request needed for staff' });
      if (await isBlocked(me(req), toUserId)) return res.status(403).json({ message: 'Blocked' });
      if (await isFriend(me(req), toUserId)) return res.status(400).json({ message: 'Already friends' });
      const existing = await FriendRequest.findOne({ from: me(req), to: toUserId });
      if (existing) return res.status(400).json({ message: 'Request already sent' });
      const fr = await FriendRequest.create({ from: me(req), to: toUserId });
      const io = getIO()?.of('/classroom');
      const { emitToUser } = await import('../socket/classroomSocket.js');
      const sender = await User.findById(me(req)).select('name avatar');
      emitToUser(io, toUserId, 'friend-request:new', { request: fr, from: sender });
      res.status(201).json(fr);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.get('/friends/requests', async (req, res) => {
    try {
      const requests = await FriendRequest.find({ to: me(req), status: 'pending' })
        .populate('from', 'name avatar role');
      res.json(requests);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.get('/friends/sent', async (req, res) => {
    try {
      const requests = await FriendRequest.find({ from: me(req), status: 'pending' })
        .populate('to', 'name avatar role');
      res.json(requests);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.put('/friends/request/:id/accept', async (req, res) => {
    try {
      const fr = await FriendRequest.findOne({ _id: req.params.id, to: me(req), status: 'pending' });
      if (!fr) return res.status(404).json({ message: 'Request not found' });
      fr.status = 'accepted';
      await fr.save();
      let conv = await ClassroomConversation.findOne({ type: 'direct', participants: { $all: [me(req), fr.from] } });
      if (!conv) {
        conv = await ClassroomConversation.create({ type: 'direct', participants: [me(req), fr.from], createdBy: me(req) });
      }
      const friendship = await Friendship.create({ users: [me(req), fr.from], conversationId: conv._id });
      const io = getIO()?.of('/classroom');
      const { emitToUser } = await import('../socket/classroomSocket.js');
      const accepter = await User.findById(me(req)).select('name avatar');
      emitToUser(io, fr.from, 'friend-request:accepted', { friendship, by: accepter, conversationId: conv._id });
      res.json({ friendship, conversationId: conv._id });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.put('/friends/request/:id/decline', async (req, res) => {
    try {
      const fr = await FriendRequest.findOneAndUpdate(
        { _id: req.params.id, to: me(req), status: 'pending' },
        { status: 'declined' }, { new: true }
      );
      if (!fr) return res.status(404).json({ message: 'Not found' });
      res.json(fr);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.delete('/friends/:userId', async (req, res) => {
    try {
      const otherId = req.params.userId;
      await Friendship.deleteOne({ users: { $all: [me(req), otherId] } });

      // Notify both parties so their UIs update in real-time
      const io = getIO()?.of('/classroom');
      const { emitToUser } = await import('../socket/classroomSocket.js');
      emitToUser(io, otherId,    'friend:removed', { by: me(req) });
      emitToUser(io, me(req),   'friend:removed', { by: otherId });

      res.json({ message: 'Unfriended' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ── Block / Unblock ───────────────────────────────────────────────────────
  router.post('/block/:userId', async (req, res) => {
    try {
      const target = await User.findById(req.params.userId);
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (target.role === 'admin') return res.status(403).json({ message: 'Cannot block admin' });
      await ClassroomBlock.findOneAndUpdate(
        { blocker: me(req), blocked: req.params.userId },
        { blocker: me(req), blocked: req.params.userId },
        { upsert: true }
      );
      await Friendship.deleteOne({ users: { $all: [me(req), req.params.userId] } });
      res.json({ message: 'Blocked' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.delete('/block/:userId', async (req, res) => {
    try {
      await ClassroomBlock.deleteOne({ blocker: me(req), blocked: req.params.userId });
      res.json({ message: 'Unblocked' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.get('/blocks', async (req, res) => {
    try {
      const blocks = await ClassroomBlock.find({ blocker: me(req) }).populate('blocked', 'name avatar role');
      res.json(blocks);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ── Report ────────────────────────────────────────────────────────────────
  router.post('/report', async (req, res) => {
    try {
      const { reportedId, reason, details, messageId, messageContent } = req.body;
      const target = await User.findById(reportedId);
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (target.role === 'admin') return res.status(403).json({ message: 'Cannot report admin' });
      const report = await ClassroomReport.create({
        reporter: me(req), reported: reportedId, reason,
        details: details || null,
        messageId: messageId || null,
        messageContent: messageContent || null,
      });
      res.status(201).json(report);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ── Conversations ─────────────────────────────────────────────────────────
  router.get('/conversations', async (req, res) => {
    try {
      const uid = String(me(req));
      const convs = await ClassroomConversation.find({ participants: me(req), hiddenFor: { $ne: me(req) } })
        .populate('participants', 'name avatar role lastSeen')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } })
        .populate({ path: 'pinnedMessage', select: 'text sender attachments', populate: { path: 'sender', select: 'name' } })
        .sort({ lastActivity: -1 });

      const result = convs.map(conv => {
        const obj = conv.toObject();
        const clearedEntry = (obj.clearedAt || []).find(c => String(c.user) === uid);
        if (clearedEntry?.at && obj.lastMessage?.createdAt &&
            new Date(obj.lastMessage.createdAt) <= new Date(clearedEntry.at)) {
          obj.lastMessage = null;
        }
        return obj;
      });

      res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Open / create direct DM — students must be friends first; staff can DM anyone
  router.post('/conversations/direct', async (req, res) => {
    try {
      const { userId } = req.body;
      const [target, requester] = await Promise.all([
        User.findById(userId).select('name role'),
        User.findById(me(req)).select('role'),
      ]);
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (await isBlocked(me(req), userId)) return res.status(403).json({ message: 'Blocked' });

      // Student → student requires friendship
      const bothStudents = requester?.role === 'student' && target.role === 'student';
      if (bothStudents && !(await isFriend(me(req), userId))) {
        return res.status(403).json({ message: 'Send a friend request first to start chatting' });
      }

      let conv = await ClassroomConversation.findOne({ type: 'direct', participants: { $all: [me(req), userId] } });
      if (!conv) {
        conv = await ClassroomConversation.create({ type: 'direct', participants: [me(req), userId], createdBy: me(req) });
      }
      await conv.populate('participants', 'name avatar role lastSeen');
      res.json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Create group
  router.post('/conversations/group', async (req, res) => {
    try {
      const { name, participantIds = [] } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Group name required' });
      const inviteCode = nanoid(10);
      const allParticipants = [...new Set([me(req), ...participantIds])];
      const conv = await ClassroomConversation.create({
        type: 'group', name: name.trim(), participants: allParticipants,
        admins: [me(req)], inviteCode, createdBy: me(req),
      });
      await conv.populate('participants', 'name avatar role lastSeen');

      // Notify every added participant so their sidebar updates immediately
      const { emitToUser } = await import('../socket/classroomSocket.js');
      const io = getIO()?.of('/classroom');
      const creator = await User.findById(me(req)).select('name avatar');
      for (const uid of allParticipants) {
        if (String(uid) !== me(req)) {
          emitToUser(io, uid, 'group:added', { conversation: conv, addedBy: creator });
        }
      }

      res.status(201).json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Join group via invite code
  router.post('/conversations/join', async (req, res) => {
    try {
      const { inviteCode } = req.body;
      const conv = await ClassroomConversation.findOne({ inviteCode });
      if (!conv) return res.status(404).json({ message: 'Invalid invite code' });
      if (conv.participants.includes(me(req))) return res.json(conv);
      conv.participants.push(me(req));
      await conv.save();
      await conv.populate('participants', 'name avatar role lastSeen');
      const sysMsgText = `joined via invite link`;
      const sysMsg = await ClassroomMessage.create({ conversation: conv._id, sender: me(req), text: sysMsgText, type: 'system' });
      emitToConv(conv._id, 'msg:new', { message: sysMsg, conversationId: conv._id });
      res.json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Add member directly to group (any group member can add their friends/staff)
  router.post('/conversations/:id/members', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, type: 'group', participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in group' });
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: 'userId required' });
      if (conv.participants.map(String).includes(userId))
        return res.status(400).json({ message: 'Already a member' });
      conv.participants.push(userId);
      await conv.save();
      await conv.populate('participants', 'name avatar role lastSeen');
      const [adder, added] = await Promise.all([
        User.findById(me(req)).select('name avatar'),
        User.findById(userId).select('name avatar'),
      ]);
      const sysMsg = await ClassroomMessage.create({
        conversation: conv._id, sender: me(req),
        text: `${adder?.name || 'Someone'} added ${added?.name || 'a user'}`, type: 'system',
      });
      const populated = await populateMsg(ClassroomMessage.findById(sysMsg._id));
      emitToConv(conv._id, 'msg:new', { message: populated, conversationId: conv._id });
      emitToConv(conv._id, 'conv:updated', { conversationId: conv._id, participants: conv.participants });
      // Notify the newly added user so their sidebar updates
      const { emitToUser } = await import('../socket/classroomSocket.js');
      const io = getIO()?.of('/classroom');
      emitToUser(io, userId, 'group:added', { conversation: conv, addedBy: adder });
      res.json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Send a group invite DM — bypasses friendship requirement (invite, not a chat)
  router.post('/conversations/:id/invite-user', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: 'userId required' });

      // Requester must be in the group
      const group = await ClassroomConversation.findOne({ _id: req.params.id, type: 'group', participants: me(req) });
      if (!group) return res.status(403).json({ message: 'Not in group' });

      // Target must not already be a member
      if (group.participants.map(String).includes(userId))
        return res.status(400).json({ message: 'Already a member' });

      const target = await User.findById(userId).select('name avatar role');
      if (!target) return res.status(404).json({ message: 'User not found' });

      // Find or create a DM without any friendship check (invite only, not general messaging)
      let dm = await ClassroomConversation.findOne({ type: 'direct', participants: { $all: [me(req), userId] } });
      if (!dm) {
        dm = await ClassroomConversation.create({ type: 'direct', participants: [me(req), userId], createdBy: me(req) });
      }

      // Send the groupInvite message directly (bypass the message-send friendship gate)
      const msg = await ClassroomMessage.create({
        conversation: dm._id,
        sender: me(req),
        text: `You've been invited to join "${group.name}"`,
        type: 'groupInvite',
        groupInvite: { groupId: group._id, groupName: group.name, inviteCode: group.inviteCode },
        disappearAt: dm.disappearAfter ? new Date(Date.now() + dm.disappearAfter) : undefined,
      });
      dm.lastMessage = msg._id;
      dm.lastActivity = new Date();
      await dm.save();

      await dm.populate('participants', 'name avatar role lastSeen');
      const populated = await populateMsg(ClassroomMessage.findById(msg._id));
      emitToConv(dm._id, 'msg:new', { message: populated, conversationId: dm._id });

      // Push the DM + invite to the target user's sidebar in real-time
      const { emitToUser } = await import('../socket/classroomSocket.js');
      const io = getIO()?.of('/classroom');
      emitToUser(io, userId, 'group:invite', { dm, inviteMsg: populated });

      res.json({ ok: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  router.get('/conversations/:id', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) })
        .populate('participants', 'name avatar role lastSeen');
      if (!conv) return res.status(404).json({ message: 'Not found' });
      res.json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Update group
  router.put('/conversations/:id', upload.single('avatar'), async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id });
      if (!conv) return res.status(404).json({ message: 'Group not found' });
      const myId = String(me(req));
      const canEdit = req.userRole === 'admin'
        || conv.admins.map(String).includes(myId)
        || String(conv.createdBy) === myId;
      if (!canEdit) return res.status(403).json({ message: 'Only the group creator or admin can edit this group' });
      const { name, disappearAfter, removeAvatar } = req.body;
      if (name?.trim()) conv.name = name.trim();
      if (disappearAfter !== undefined) conv.disappearAfter = disappearAfter ? Number(disappearAfter) : null;
      if (removeAvatar === 'true') conv.avatar = '';
      else if (req.file?.path) conv.avatar = req.file.path;
      await conv.save();
      emitToConv(conv._id, 'conv:updated', {
        conversationId: conv._id,
        name: conv.name,
        avatar: conv.avatar,
        disappearAfter: conv.disappearAfter,
      });
      res.json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Promote / demote group member (admin ↔ member) — only creator, existing admins, or platform admin
  router.patch('/conversations/:id/members/:userId/role', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, type: 'group' });
      if (!conv) return res.status(404).json({ message: 'Group not found' });

      const myId = String(me(req));
      const isPlatformAdmin = req.userRole === 'admin';
      const isGroupAdmin    = conv.admins.map(String).includes(myId);
      const isGroupCreator  = String(conv.createdBy) === myId;

      if (!isPlatformAdmin && !isGroupAdmin && !isGroupCreator) {
        return res.status(403).json({ message: 'Only admins can change roles' });
      }
      const { userId } = req.params;
      if (String(userId) === me(req)) return res.status(400).json({ message: 'Cannot change your own role' });
      if (String(conv.createdBy) === userId) return res.status(400).json({ message: "Cannot change the creator's role" });
      if (!conv.participants.map(String).includes(userId)) return res.status(400).json({ message: 'Not a member' });

      const wasAdmin = conv.admins.map(String).includes(userId);
      if (wasAdmin) {
        conv.admins = conv.admins.filter(a => String(a) !== userId);
      } else {
        conv.admins.push(userId);
      }
      await conv.save();

      // Broadcast updated admins list to all group members
      emitToConv(conv._id, 'conv:updated', { conversationId: conv._id, admins: conv.admins });

      // Post a system message so the history shows the change
      const [changer, target] = await Promise.all([
        User.findById(me(req)).select('name'),
        User.findById(userId).select('name'),
      ]);
      const txt = wasAdmin
        ? `${changer?.name || 'Someone'} removed ${target?.name || 'a user'} as admin`
        : `${changer?.name || 'Someone'} made ${target?.name || 'a user'} an admin`;
      const sysMsg = await ClassroomMessage.create({
        conversation: conv._id, sender: me(req), text: txt, type: 'system',
      });
      const populated = await populateMsg(ClassroomMessage.findById(sysMsg._id));
      emitToConv(conv._id, 'msg:new', { message: populated, conversationId: conv._id });

      res.json({ admins: conv.admins, isAdmin: !wasAdmin });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // ── Messages ──────────────────────────────────────────────────────────────
  router.get('/conversations/:id/messages', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      const page = parseInt(req.query.page) || 1;
      const limit = 40;
      const uid = String(me(req));
      const clearedEntry = (conv.clearedAt || []).find(c => String(c.user) === uid);
      const msgQuery = { conversation: req.params.id };
      if (clearedEntry?.at) msgQuery.createdAt = { $gt: clearedEntry.at };
      const msgs = await populateMsg(
        ClassroomMessage.find(msgQuery).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      );
      res.json(msgs.reverse());
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Set / clear disappearing messages timer (group: admins/creator only; DM: any participant)
  router.patch('/conversations/:id/disappear', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      if (conv.type === 'group') {
        const uid = String(me(req));
        const isPrivileged = String(conv.createdBy) === uid || (conv.admins || []).some(a => String(a) === uid);
        if (!isPrivileged) return res.status(403).json({ message: 'Only admins can change disappearing messages' });
      }
      const ms = req.body.disappearAfter ? Number(req.body.disappearAfter) : null;
      conv.disappearAfter = ms;
      await conv.save();
      emitToConv(conv._id, 'conv:updated', { conversationId: conv._id, disappearAfter: conv.disappearAfter });
      res.json({ ok: true, disappearAfter: conv.disappearAfter });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Hide / delete conversation from chat list for current user only
  router.delete('/conversations/:id', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      const uid = me(req);
      if (!(conv.hiddenFor || []).map(String).includes(uid)) {
        await ClassroomConversation.updateOne({ _id: conv._id }, { $addToSet: { hiddenFor: uid } });
      }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Clear chat for current user only (other participants unaffected)
  router.delete('/conversations/:id/messages', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      const uid = String(me(req));
      conv.clearedAt = (conv.clearedAt || []).filter(c => String(c.user) !== uid);
      conv.clearedAt.push({ user: uid, at: new Date() });
      await conv.save();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Mute conversation for current user
  router.patch('/conversations/:id/mute', async (req, res) => {
    try {
      const { duration } = req.body;
      const until = duration ? new Date(Date.now() + Number(duration)) : null;
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      conv.mutedBy = (conv.mutedBy || []).filter(m => String(m.user) !== me(req));
      conv.mutedBy.push({ user: me(req), until });
      await conv.save();
      res.json({ ok: true, until });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Unmute conversation for current user
  router.patch('/conversations/:id/unmute', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      conv.mutedBy = (conv.mutedBy || []).filter(m => String(m.user) !== me(req));
      await conv.save();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Pin / unpin a message in conversation
  router.patch('/conversations/:id/pin', async (req, res) => {
    try {
      const { messageId } = req.body;
      const conv = await ClassroomConversation.findOneAndUpdate(
        { _id: req.params.id, participants: me(req) },
        { $set: { pinnedMessage: messageId || null, pinnedBy: messageId ? me(req) : null } },
        { new: true }
      ).populate({ path: 'pinnedMessage', select: 'text sender attachments', populate: { path: 'sender', select: 'name' } });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });
      emitToConv(req.params.id, 'conv:updated', {
        conversationId: req.params.id,
        pinnedMessage: conv.pinnedMessage || null,
        pinnedBy: conv.pinnedBy || null,
      });
      res.json({ ok: true, pinnedMessage: conv.pinnedMessage || null });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Send message (text or attach)
  router.post('/conversations/:id/messages', upload.array('files', 10), async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ _id: req.params.id, participants: me(req) });
      if (!conv) return res.status(403).json({ message: 'Not in conversation' });

      // Belt-and-suspenders: student → student DM requires friendship
      if (conv.type === 'direct') {
        const otherId = conv.participants.find(p => String(p) !== me(req));
        const [sender, other] = await Promise.all([
          User.findById(me(req)).select('role'),
          User.findById(otherId).select('role'),
        ]);
        if (sender?.role === 'student' && other?.role === 'student' && !(await isFriend(me(req), otherId))) {
          return res.status(403).json({ message: 'You need to be friends to message this person' });
        }
      }

      const { text = '', replyTo, mentions, type, groupInvite } = req.body;
      const mentionArr = mentions ? JSON.parse(mentions) : [];
      const disappearAt = conv.disappearAfter ? new Date(Date.now() + conv.disappearAfter) : undefined;
      const msgType = (type && ['text', 'system', 'groupInvite'].includes(type)) ? type : 'text';

      const attachments = (req.files || []).map(f => ({
        url: f.path,
        name: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
        type: f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('audio/') ? 'voice' : 'file',
      }));

      const msgData = {
        conversation: conv._id, sender: me(req), text, attachments,
        mentions: mentionArr, replyTo: replyTo || null, disappearAt, type: msgType,
      };
      if (msgType === 'groupInvite' && groupInvite) {
        msgData.groupInvite = JSON.parse(groupInvite);
      }
      const msg = await ClassroomMessage.create(msgData);

      await populateMsg(ClassroomMessage.findById(msg._id)).then(async (populated) => {
        conv.lastMessage = msg._id;
        conv.lastActivity = new Date();
        await conv.save();
        // Un-hide the conversation for everyone — new message makes it reappear
        if (conv.hiddenFor && conv.hiddenFor.length) {
          await ClassroomConversation.updateOne({ _id: conv._id }, { $set: { hiddenFor: [] } });
        }

        emitToConv(conv._id, 'msg:new', { message: populated, conversationId: conv._id });

        // Push notifications + real-time socket to mentioned users
        if (mentionArr.length) {
          const { sendNotification } = await import('../index.js');
          const { emitToUser } = await import('../socket/classroomSocket.js');
          const senderUser = await User.findById(me(req)).select('name');
          // Resolve @username strings → participant user IDs
          const participantIds = conv.participants.filter(id => String(id) !== me(req));
          const participants = await User.find({ _id: { $in: participantIds } }).select('name _id');
          for (const mention of mentionArr) {
            const raw = (mention.startsWith('@') ? mention.slice(1) : mention).toLowerCase();
            const matched = participants.find(p => {
              const name = (p.name || '').toLowerCase();
              return name.replace(/\s+/g, '') === raw || name.split(' ')[0] === raw;
            });
            if (matched) {
              const matchedId = String(matched._id);
              sendNotification(matchedId, `${senderUser.name} mentioned you`, `/classroom`);
              emitToUser(io, matchedId, 'mention:new', {
                from: senderUser.name,
                conversationId: conv._id,
              });
            }
          }
        }
        res.status(201).json(populated);
      });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Edit message
  router.put('/conversations/:id/messages/:msgId', async (req, res) => {
    try {
      const msg = await ClassroomMessage.findOne({ _id: req.params.msgId, sender: me(req), deletedForEveryone: false });
      if (!msg) return res.status(404).json({ message: 'Message not found' });

      const seen = msg.seenBy.length > 0;
      const seenAt = seen ? msg.seenBy[0]?.at : null;
      const minsAfterSeen = seenAt ? (Date.now() - seenAt) / 60000 : 0;
      if (seen && minsAfterSeen > 5) return res.status(403).json({ message: 'Edit window expired (5 min after seen)' });

      msg.editHistory.push({ text: msg.text, editedAt: new Date() });
      msg.text = req.body.text;
      msg.edited = true;
      msg.editedAt = new Date();
      await msg.save();

      const populated = await populateMsg(ClassroomMessage.findById(msg._id));
      emitToConv(req.params.id, 'msg:edit', { message: populated, conversationId: req.params.id });
      res.json(populated);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Delete for everyone
  router.delete('/conversations/:id/messages/:msgId', async (req, res) => {
    try {
      const msg = await ClassroomMessage.findOne({ _id: req.params.msgId, conversation: req.params.id });
      if (!msg) return res.status(404).json({ message: 'Not found' });
      const conv = await ClassroomConversation.findById(req.params.id);
      const isAdmin = conv?.admins?.map(String).includes(me(req));
      if (String(msg.sender) !== me(req) && !isAdmin) return res.status(403).json({ message: 'Not your message' });
      msg.deletedForEveryone = true;
      msg.text = '';
      msg.attachments = [];
      await msg.save();
      emitToConv(req.params.id, 'msg:delete', { messageId: msg._id, conversationId: req.params.id });
      res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // React to message
  router.post('/conversations/:id/messages/:msgId/react', async (req, res) => {
    try {
      const { emoji } = req.body;
      const msg = await ClassroomMessage.findOne({ _id: req.params.msgId, conversation: req.params.id });
      if (!msg) return res.status(404).json({ message: 'Not found' });

      const existing = msg.reactions.find(r => r.emoji === emoji);
      if (existing) {
        const idx = existing.users.map(String).indexOf(me(req));
        if (idx >= 0) existing.users.splice(idx, 1);
        else existing.users.push(me(req));
        if (existing.users.length === 0) msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
      } else {
        msg.reactions.push({ emoji, users: [me(req)] });
      }
      await msg.save();
      emitToConv(req.params.id, 'msg:react', { messageId: msg._id, reactions: msg.reactions, conversationId: req.params.id });
      res.json(msg.reactions);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Get online users
  router.get('/online', async (req, res) => {
    try {
      const { getOnlineUsers } = await import('../socket/classroomSocket.js');
      const online = [...getOnlineUsers().keys()];
      res.json(online);
    } catch { res.json([]); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN-ONLY CLASSROOM MANAGEMENT ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  const adminOnly = (req, res, next) => {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin only' });
    next();
  };

  // Admin: classroom stats overview
  router.get('/admin/stats', adminOnly, async (req, res) => {
    try {
      const [totalConvs, totalGroups, totalDMs, totalMessages, pendingReports, totalReports, totalBlocks] = await Promise.all([
        ClassroomConversation.countDocuments(),
        ClassroomConversation.countDocuments({ type: 'group' }),
        ClassroomConversation.countDocuments({ type: 'direct' }),
        ClassroomMessage.countDocuments({ deletedForEveryone: { $ne: true } }),
        ClassroomReport.countDocuments({ status: 'pending' }),
        ClassroomReport.countDocuments(),
        ClassroomBlock.countDocuments(),
      ]);
      const today = new Date(); today.setHours(0,0,0,0);
      const messagesToday = await ClassroomMessage.countDocuments({ createdAt: { $gte: today }, deletedForEveryone: { $ne: true } });
      res.json({ totalConvs, totalGroups, totalDMs, totalMessages, pendingReports, totalReports, totalBlocks, messagesToday });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: list all reports
  router.get('/admin/reports', adminOnly, async (req, res) => {
    try {
      const { status } = req.query;
      const filter = status && status !== 'all' ? { status } : {};
      const reports = await ClassroomReport.find(filter)
        .populate('reporter', 'name email avatar role')
        .populate('reported', 'name email avatar role')
        .sort({ createdAt: -1 })
        .limit(200);
      res.json(reports);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: update report status
  router.put('/admin/reports/:id', adminOnly, async (req, res) => {
    try {
      const { status, adminNote } = req.body;
      const report = await ClassroomReport.findByIdAndUpdate(
        req.params.id,
        { status, ...(adminNote !== undefined && { adminNote }) },
        { new: true }
      ).populate('reporter', 'name email avatar role').populate('reported', 'name email avatar role');
      if (!report) return res.status(404).json({ message: 'Not found' });
      res.json(report);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: delete a report
  router.delete('/admin/reports/:id', adminOnly, async (req, res) => {
    try {
      await ClassroomReport.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: list all conversations
  router.get('/admin/conversations', adminOnly, async (req, res) => {
    try {
      const { type, search } = req.query;
      const filter = {};
      if (type && type !== 'all') filter.type = type;
      const convs = await ClassroomConversation.find(filter)
        .populate('participants', 'name avatar role email')
        .populate('createdBy', 'name email role')
        .populate('lastMessage', 'text createdAt sender')
        .sort({ lastActivity: -1 })
        .limit(300);
      const result = search
        ? convs.filter(c =>
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.participants?.some(p => p.name?.toLowerCase().includes(search.toLowerCase()))
          )
        : convs;
      res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: get messages of any conversation
  router.get('/admin/conversations/:id/messages', adminOnly, async (req, res) => {
    try {
      const { before } = req.query;
      const filter = { conversation: req.params.id };
      if (before) filter._id = { $lt: before };
      const msgs = await ClassroomMessage.find(filter)
        .populate('sender', 'name avatar role')
        .sort({ _id: -1 })
        .limit(40);
      res.json(msgs.reverse());
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: delete a conversation (groups only recommended, DMs allowed too)
  router.delete('/admin/conversations/:id', adminOnly, async (req, res) => {
    try {
      await ClassroomMessage.deleteMany({ conversation: req.params.id });
      await ClassroomConversation.findByIdAndDelete(req.params.id);
      res.json({ message: 'Conversation deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: list all blocks
  router.get('/admin/blocks', adminOnly, async (req, res) => {
    try {
      const blocks = await ClassroomBlock.find()
        .populate('blocker', 'name avatar role email')
        .populate('blocked', 'name avatar role email')
        .sort({ createdAt: -1 })
        .limit(300);
      res.json(blocks);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Admin: remove a block
  router.delete('/admin/blocks/:id', adminOnly, async (req, res) => {
    try {
      await ClassroomBlock.findByIdAndDelete(req.params.id);
      res.json({ message: 'Block removed' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  // Invite link info
  router.get('/conversations/invite/:code', async (req, res) => {
    try {
      const conv = await ClassroomConversation.findOne({ inviteCode: req.params.code })
        .select('name type participants').populate('participants', 'name avatar');
      if (!conv) return res.status(404).json({ message: 'Invalid invite' });
      res.json(conv);
    } catch (e) { res.status(500).json({ message: e.message }); }
  });

  return router;
};
