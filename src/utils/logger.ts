export const logError = async (message: string, error?: any, context?: any) => {
  try {
    const stack = error instanceof Error ? error.stack : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const sid = localStorage.getItem('bayano_sid');
    if (sid) {
      headers['Authorization'] = `Bearer ${sid}`;
    }
    await fetch('/api/log-error', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        message,
        stack,
        context
      })
    });
  } catch (e) {
    console.error('Failed to log error to server', e);
  }
};
