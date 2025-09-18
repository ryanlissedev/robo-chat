export async function fetchClient(input: RequestInfo, init?: RequestInit) {
  const csrf = document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrf_token='))
    ?.split('=')[1];

  // Check if user is a guest based on cookies
  const guestUserId = document.cookie
    .split('; ')
    .find((c) => c.startsWith('guest-user-id='));

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
    'x-csrf-token': csrf || '',
    'Content-Type': 'application/json',
  };

  // Add guest headers if guest user ID cookie exists
  if (guestUserId) {
    headers['x-guest-user'] = 'true';
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
