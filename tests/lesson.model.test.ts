import postgres from "postgres";
import Lesson, { LessonProps } from "../src/models/Lesson";
import { test, describe, expect, afterEach, beforeEach } from "vitest";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";

describe("Todo CRUD operations", () => {
	// Set up the connection to the DB.
	const sql = postgres({
		database: "MorsseDB",
	});

	/**
	 * Helper function to create a Todo with default or provided properties.
	 * @see https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR#short-circuit_evaluation
	 * @param props The properties of the Todo.
	 * @default title: "Test Todo"
	 * @default description: "This is a test todo"
	 * @default status: "incomplete"
	 * @default dueAt: A week from today
	 * @default createdAt: The current date/time
	 * @returns A new Todo object that has been persisted in the DB.
	 */
	const createLesson = async (props: Partial<LessonProps> = {}) => {
		const lessonProps: LessonProps = {
			title: props.title || "Test lesson",
			text: props.text || "Test text",
			message: props.message || "This is a test lesson",
			type: props.type || "receive",
			completionCount: props.completionCount || 0,
			difficulty: props.difficulty || 3,
			createdAt: props.createdAt || createUTCDate(),
			userId: props.userId || 1,
		};

		return await Lesson.create(sql, lessonProps);
	};

	const createUser = async (props: Partial<UserProps> = {}) => {
		return await User.create(sql, {
			email: props.email || "user@email.com",
			name: props.name || "user",
			reputation: 20,
			password: props.password || "password",
			createdAt: props.createdAt || createUTCDate(),
			wpm: 10,
		});
	};

	beforeEach(async () => {
		await createUser();
	});

	/**
	 * Clean up the database after each test. This function deletes all the rows
	 * from the lessons and users tables and resets the sequence for each table.
	 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
	 */
	afterEach(async () => {
		const tables = ["lessons", "users"];

		try {
			for (const table of tables) {
				await sql.unsafe(`DELETE FROM ${table}`);
				await sql.unsafe(
					`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`,
				);
			}
		} catch (error) {
			console.error(error);
		}
	});

	test("Lesson was created.", async () => {
		const lesson = await createLesson({ title: "Test Lesson 2", text: "alpha", message: "beta", type: "send", completionCount: 42, difficulty: 4, userId: 1 });

		expect(lesson.props.title).toBe("Test lesson");
		expect(lesson.props.text).toBe("Test text");
		expect(lesson.props.message).toBe("This is a test lesson");
		expect(lesson.props.type).toBe("receive");
		expect(lesson.props.completionCount).toBe(0);
		expect(lesson.props.difficulty).toBe(3);
		expect(lesson.props.userId).toBe(1);
	});

	test("Lesson was retrieved.", async () => {
		const lesson = await createLesson();

		/**
		 * ! is a non-null assertion operator. It tells TypeScript that the value is not null or undefined.
		 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator
		 */
		const readLesson = await Lesson.read(sql, lesson.props.id!);

		/**
		 * ?. is the optional chaining operator. It allows reading the value of a property
		 * located deep within a chain of connected objects without having to expressly validate that each reference in the chain is valid.
		 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
		 */
		expect(lesson.props.title).toBe("Test lesson");
		expect(lesson.props.text).toBe("Test text");
		expect(lesson.props.message).toBe("This is a test lesson");
		expect(lesson.props.type).toBe("receive");
		expect(lesson.props.completionCount).toBe(0);
		expect(lesson.props.difficulty).toBe(3);
		expect(lesson.props.userId).toBe(1);
	});

	test("Lessons were listed.", async () => {
		const lesson1 = await createLesson();
		const lesson2 = await createLesson();
		const lesson3 = await createLesson();

		const lessons = await Lesson.readAll(sql, false);

		expect(lessons).toBeInstanceOf(Array);
		expect(lessons).toContainEqual(lesson1);
		expect(lessons).toContainEqual(lesson2);
		expect(lessons).toContainEqual(lesson3);
	});

	test("Lessons were listed by userId.", async () => {
		await createUser();

		const lesson1 = await createLesson();
		const lesson2 = await createLesson({ userId: 2 });
		const lesson3 = await createLesson();

		const lessonsByUser1 = await Lesson.readAll(sql, false, 1);

		expect(lessonsByUser1).toBeInstanceOf(Array);
		expect(lessonsByUser1).toContainEqual(lesson1);
		expect(lessonsByUser1).not.toContainEqual(lesson2);
		expect(lessonsByUser1).toContainEqual(lesson3);

		const completeTodos = await Lesson.readAll(sql, false, 2);

		expect(completeTodos).toBeInstanceOf(Array);
		expect(lessonsByUser1).not.toContainEqual(lesson1);
		expect(completeTodos).toContainEqual(lesson2);
		expect(lessonsByUser1).not.toContainEqual(lesson3);
	});

	test("Todo was marked as complete.", async () => {
		// Create a new todo.
		const todo = await createLesson();

		// Check if the status of the todo is incomplete.
		expect(todo.props.status).toBe("incomplete");

		// Mark the todo as complete.
		await todo.markComplete();

		// Read the completed todo from the database.
		const completedTodo = await Todo.read(sql, todo.props.id!);

		// Check if the status of the todo is complete.
		expect(completedTodo?.props.status).toBe("complete");
	});
});
