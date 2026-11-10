-- An optional password per account (src/passwords.ts), set after a sign-in
-- code proves the address. Null until then; Google sign-in never needs one.
ALTER TABLE users ADD COLUMN password_hash TEXT;
