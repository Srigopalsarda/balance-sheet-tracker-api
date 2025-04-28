import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  email: text('email').notNull(),
  googleId: text('google_id'),
  googleName: text('google_name'),
  googlePicture: text('google_picture'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login')
}); 