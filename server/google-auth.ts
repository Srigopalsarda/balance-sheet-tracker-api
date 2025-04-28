import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';
import { generateToken } from './auth';

// Initialize the Google OAuth client
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
);

// Function to get the Google OAuth URL
export function getGoogleAuthUrl(): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent'
  });
}

// Function to handle Google OAuth callback
export async function handleGoogleCallback(code: string) {
  try {
    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info from Google
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Failed to get user info from Google');
    }

    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists in our database
    let user = await storage.getUserByGoogleId(googleId);

    if (!user) {
      // Create a new user if they don't exist
      user = await storage.createUser({
        username: email!.split('@')[0], // Use part of email as username
        email: email!,
        googleId,
        googleName: name,
        googlePicture: picture
      });
    }

    // Generate JWT token for the user
    const token = generateToken({ id: user.id, username: user.username });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };
  } catch (error) {
    console.error('Google authentication error:', error);
    throw error;
  }
} 