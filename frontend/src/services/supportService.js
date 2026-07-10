import { backendFetch } from '../utils/api';

export const createTicket = (title, category, description) =>
  backendFetch('/support/', {
    method: 'POST',
    body: JSON.stringify({ title, category, description }),
  });

export const getMyTickets = () => backendFetch('/support/me');

export const getTicketMessages = (ticketId) =>
  backendFetch(`/support/${ticketId}/messages`);

export const sendReply = (ticketId, content) =>
  backendFetch(`/support/${ticketId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
