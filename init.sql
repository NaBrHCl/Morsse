DROP DATABASE IF EXISTS "MorsseDB";
CREATE DATABASE "MorsseDB";

\c MorsseDB;

DROP TYPE IF EXISTS "user_theme";
CREATE TYPE "user_theme" AS ENUM ('light', 'dark');

DROP TYPE IF EXISTS "lesson_type";
CREATE TYPE "lesson_type" AS ENUM ('send', 'receive');

DROP TABLE IF EXISTS "users";
CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "email" VARCHAR(100) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "wpm" SMALLINT NOT NULL DEFAULT 15,
    "completion_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP,
    "theme" user_theme NOT NULL DEFAULT 'dark'
);

DROP TABLE IF EXISTS "lessons";
CREATE TABLE "lessons" (
    "id" SERIAL PRIMARY KEY,
    "title" VARCHAR(100) NOT NULL,
    "text" VARCHAR(255) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "type" lesson_type NOT NULL,
    "completion_count" INTEGER NOT NULL DEFAULT 0,
    "difficulty" SMALLINT NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS "user_lesson";
CREATE TABLE "user_lesson" (
    "user_id" INTEGER REFERENCES users(id) ON DELETE CASCADE,
    "lesson_id" INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, lesson_id)
);