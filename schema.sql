CREATE TABLE todoLists (
  id serial PRIMARY KEY,
  title text UNIQUE NOT NULL,
  username text NOT NULL
);

CREATE TABLE todos (
  id serial PRIMARY KEY,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  username text NOT NULL,
  todolist_id integer
    NOT NULL
    REFERENCES todoLists (id)
    ON DELETE CASCADE
);

CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL
);