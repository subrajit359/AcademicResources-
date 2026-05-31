import { io } from 'socket.io-client';

let socket = null;

export function getClassroomSocket(token) {
  if (socket && socket.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  const base = import.meta.env.VITE_API_URL || '';
  socket = io(`${base}/classroom`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function disconnectClassroomSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
