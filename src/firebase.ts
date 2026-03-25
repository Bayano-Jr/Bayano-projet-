import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
