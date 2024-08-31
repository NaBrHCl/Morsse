import postgres from "postgres";
import { test, describe, expect, afterEach } from "vitest";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";

describe("User CRUD operations", () => {
	// Set up the connection to the DB.
	const sql = postgres({
		database: "MorsseDB",
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

	test("User was created.", async () => {
		const user = await createUser({ password: "Password123" });

		expect(user.props.email).toBe("user@email.com");
		expect(user.props.name).toBe("user");
		expect(user.props.reputation).toBe(20);
		expect(user.props.password).toBe("Password123");
		expect(user.props.wpm).toBe(10);
		expect(user.props.createdAt).toBeTruthy();
		expect(user.props.editedAt).toBeFalsy();
	});

	test("User was not created with duplicate email.", async () => {
		await createUser({ email: "user@email.com" });

		await expect(async () => {
			await createUser({ email: "user@email.com" });
		}).rejects.toThrow("User with this email already exists.");
	});

	test("User was logged in.", async () => {
		const user = await createUser({ password: "Password123" });
		const loggedInUser = await User.login(
			sql,
			user.props.email,
			"Password123",
		);

		expect(loggedInUser?.props.email).toBe("user@email.com");
		expect(loggedInUser?.props.name).toBe("user");
		expect(loggedInUser?.props.reputation).toBe(20);
		expect(loggedInUser?.props.password).toBe("Password123");
		expect(loggedInUser?.props.wpm).toBe(10);
	});

	test("User was not logged in with invalid password.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, user.props.email, "wrongpassword");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was not logged in with invalid email.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, "invalid@email.com", "password");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was not logged in with invalid email and password.", async () => {
		const user = await createUser({ password: "Password123" });

		await expect(async () => {
			await User.login(sql, "invalid@email.com", "wrongpassword");
		}).rejects.toThrow("Invalid credentials.");
	});

	test("User was read.", async () => {
		const user = await createUser({ password: "Password123" });
		const readUser = await User.read(sql, user.props.id!);

		expect(readUser?.props.email).toBe("user@email.com");
		expect(readUser?.props.name).toBe("user");
		expect(readUser?.props.reputation).toBe(20);
		expect(readUser?.props.password).toBe("Password123");
		expect(readUser?.props.wpm).toBe(10);
	});

	test("User was updated.", async () => {
		const user = await createUser({ password: "Password123" });

		await user.update({
			email: "updated@email.com",
			name: "updated",
			reputation: 40,
			password: "newpassword",
			wpm: 20,
		});

		expect(user.props.email).toBe("updated@email.com");
		expect(user.props.name).toBe("updated");
		expect(user.props.reputation).toBe(40);
		expect(user.props.password).toBe("newpassword");
		expect(user.props.wpm).toBe(20);
		expect(user.props.editedAt).toBeTruthy();
	});

	test("User was not updated with duplicate email.", async () => {
		const user1 = await createUser({ email: "user1@email.com", name: "user1" });
		const user2 = await createUser({ email: "user2@email.com", name: "user2" });

		await expect(async () => {
			await user2.update({ email: "user1@email.com" });
		}).rejects.toThrow("User with this email already exists.");

		expect(user2.props.email).not.toBe(user1.props.email);
	});
});
