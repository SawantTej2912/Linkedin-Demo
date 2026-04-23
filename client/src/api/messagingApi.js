// ─────────────────────────────────────────────────────────
//  Messaging API — client-side helper functions
//
//  All functions here talk to the Messaging Service (port 3004)
//  via the API Gateway (port 3000).
//
//  How to use:
//    import { openThread, sendMessage, listMessages } from '../api/messagingApi';
//    const { data } = await openThread(['user-id-1', 'user-id-2']);
// ─────────────────────────────────────────────────────────

import api from './apiClient';

// Open (or find an existing) conversation thread between two users.
// participant_ids: array of user ID strings
// Returns: { thread_id }
export const openThread = (participant_ids) =>
  api.post('/threads/open', { participant_ids });

// Get metadata for a single thread (participants, last message, timestamps).
// Returns: { thread_id, participant_ids, last_message, created_at, updated_at }
export const getThread = (thread_id) =>
  api.post('/threads/get', { thread_id });

// List all threads for a user (their inbox).
// Returns: { results: [...threads], page, limit }
export const threadsByUser = (user_id, page = 1, limit = 20) =>
  api.post('/threads/byUser', { user_id, page, limit });

// Send a message in a thread.
// thread_id: the thread to send in
// sender_id: the user sending the message
// message_text: the text content
// Returns: { message_id }
export const sendMessage = (thread_id, sender_id, message_text) =>
  api.post('/messages/send', {
    thread_id,
    sender_id,
    message_text,
    // idempotency_key prevents duplicate messages if the request is retried
    idempotency_key: crypto.randomUUID(),
  });

// List messages in a thread, oldest first.
// Returns: { results: [...messages], page, limit }
export const listMessages = (thread_id, page = 1, limit = 50) =>
  api.post('/messages/list', { thread_id, page, limit });
