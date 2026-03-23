import { formatDistanceToNow, format } from 'date-fns';

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'p');
}

export function formatDate(timestamp: number): string {
  const today = new Date();
  const messageDate = new Date(timestamp);

  if (
    today.getDate() === messageDate.getDate() &&
    today.getMonth() === messageDate.getMonth() &&
    today.getFullYear() === messageDate.getFullYear()
  ) {
    return format(messageDate, 'h:mm a');
  }

  return format(messageDate, 'MMM d, yyyy');
}

export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(timestamp, { addSuffix: true });
}

export function truncateMessage(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.slice(0, maxLength) + '...';
}

export function formatRoomName(roomId: string, roomName?: string): string {
  if (roomName) {
    return roomName;
  }

  // Try to extract a name from the room ID
  const aliasMatch = roomId.match(/#([^:]+):/);
  if (aliasMatch) {
    return aliasMatch[1];
  }

  return roomId.slice(0, 10) + '...';
}

export function getRoomIcon(roomId: string): string {
  // Return a color based on room ID for consistent icons
  const colors = [
    '#ED4245',
    '#FAA61A',
    '#3BA55C',
    '#5865F2',
    '#EB459E',
    '#FEE75C',
    '#00B0F0',
    '#9475F5',
  ];

  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = roomId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  if (!name) {
    return '?';
  }
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

export function sanitizeHtml(html: string): string {
  // Basic sanitization - in production, use a proper library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/g, '');
}

export function isUrl(text: string): boolean {
  const urlRegex =
    /(?:(?:https?|ftp):\/\/)?[\w/\-?=%.]+\.[\w/\-?=%.]+/;
  return urlRegex.test(text);
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(?:(?:https?|ftp):\/\/)?[\w/\-?=%.]+/g;
  return text.match(urlRegex) || [];
}