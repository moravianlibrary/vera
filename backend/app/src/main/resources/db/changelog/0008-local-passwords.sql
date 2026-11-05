--liquibase formatted sql
-- ACCESS-local-account; ACCESS-sign-up; ACCESS-verify-email; ACCESS-password-reset.

--changeset vera:0008-local-passwords
CREATE TABLE local_passwords (
  instance_id text NOT NULL,
  username text NOT NULL,
  hash text NOT NULL,
  PRIMARY KEY (instance_id, username)
);
COMMENT ON TABLE local_passwords IS 'VERA keeps local accounts'' passwords here, hashed with Argon2id by login; a plugin only checks one through its context.';
CREATE TABLE pending_sign_ups (
  token_hash text PRIMARY KEY,
  instance_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL,
  used_at timestamptz
);
COMMENT ON TABLE pending_sign_ups IS 'ACCESS-sign-up: an account waiting for its email; its token only as SHA-256. The password is kept hashed here until the email is verified, then moves to local_passwords.';
CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id text NOT NULL,
  created_at timestamptz NOT NULL,
  used_at timestamptz
);
COMMENT ON TABLE password_resets IS 'ACCESS-password-reset: a link good for an hour and once.';
--rollback DROP TABLE password_resets; DROP TABLE pending_sign_ups; DROP TABLE local_passwords;
