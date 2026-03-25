import { auth } from '../firebase';

export const getAuthToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      localStorage.setItem('bayano_sid', token);
      return token;
    } catch (e) {
      console.error("Failed to get ID token", e);
    }
  }
  return localStorage.getItem('bayano_sid');
};
