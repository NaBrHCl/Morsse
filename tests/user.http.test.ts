import postgres from "postgres";
import User, { UserProps } from "../src/models/User";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import { createUTCDate } from "../src/utils";

describe("User HTTP operations", () => {
	const sql = postgres({
		database: "MorsseDB",
	});

	const server = new Server({
		host: "localhost",
		port: 3000,
		sql,
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

	beforeAll(async () => {
		await server.start();
	});

	/**
	 * Clean up the database after each test. This function deletes all the rows
	 * from the todos and subtodos tables and resets the sequence for each table.
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

		clearCookieJar();
	});

	test("User was created.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				name: "user",
				password: "password",
				confirmPassword: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("User created");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe("user@email.com");
		expect(body.payload.user.name).toBe("user");
		expect(body.payload.user.reputation).toBe(0);
		expect(body.payload.user.wpm).toBe(15);
		expect(body.payload.user.password).toBe("password");
		expect(body.payload.user.createdAt).not.toBeNull();
		expect(body.payload.user.editedAt).toBeNull();
	});

	test("User was not created due to missing email.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				name: "user",
				password: "password",
				confirmPassword: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("missing_email");
	});

	test("User was not created due to missing password.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				name: "user",
				confirmPassword: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toMatch("missing_password");
	});

	test("User was not created due to mismatched passwords.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				name: "user",
				password: "password",
				confirmPassword: "password123",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("password_mismatch");
	});

	test("User was not created due to duplicate email.", async () => {
		await createUser({ email: "user@email.com" });

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/users",
			{
				email: "user@email.com",
				name: "user",
				password: "password",
				confirmPassword: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("User with this email already exists.");
	});

	test("User was logged in with email.", async () => {
		const user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				usernameEmail: user.props.email,
				password: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Logged in successfully!");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe(user.props.email);
		expect(body.payload.user.name).toBe(user.props.name);
		expect(body.payload.user.reputation).toBe(user.props.reputation);
		expect(body.payload.user.wpm).toBe(user.props.wpm);
		expect(body.payload.user.password).toBe("password");
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeFalsy();
	});

	test("User was logged in with name.", async () => {
		const user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				usernameEmail: user.props.name,
				password: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Logged in successfully!");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe(user.props.email);
		expect(body.payload.user.name).toBe(user.props.name);
		expect(body.payload.user.reputation).toBe(user.props.reputation);
		expect(body.payload.user.wpm).toBe(user.props.wpm);
		expect(body.payload.user.password).toBe("password");
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeFalsy();
	});

	test("User was not logged in due to invalid email.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				usernameEmail: "nonexistentemail",
				password: "password",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid credentials.");
	});

	test("User was not logged in due to invalid password.", async () => {
		const user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/login",
			{
				usernameEmail: user.props.email,
				password: "invalidpassword",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid credentials.");
	});

	test("User was found.", async () => {
		const user = await createUser();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/users/${user.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("User found");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe("user@email.com");
		expect(body.payload.user.name).toBe("user");
		expect(body.payload.user.reputation).toBe(20);
		expect(body.payload.user.wpm).toBe(10);
		expect(body.payload.user.password).toBe("password");
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeFalsy();
	});

	test("User was not found.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/users/1",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("User not found");
	});

	test("User was updated.", async () => {
		const user = await createUser();

		await makeHttpRequest("POST", "/login", {
			usernameEmail: user.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/users/${user.props.id}`,
			{
				email: "newemail@email.com",
				name: "newuser",
				password: "newpassword",
				wpm: 36,
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("User updated");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.email).toBe("newemail@email.com");
		expect(body.payload.user.name).toBe("newuser");
		expect(body.payload.user.wpm).toBe(36);
		expect(body.payload.user.password).toBe("newpassword");
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeTruthy();
	});

	test("User was not updated without being logged in.", async () => {
		await createUser();

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/users/1",
			{
				email: "newemail@email.com",
				name: "newuser",
				password: "newpassword",
				wpm: 36,
			},
		);

		expect(statusCode).toBe(StatusCode.Forbidden);
		expect(body.message).toBe("Unauthorized");
	});

	test("User was not updated due to invalid user ID.", async () => {
		const user = await createUser();

		await makeHttpRequest("POST", "/login", {
			usernameEmail: user.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/users/abc",
			{
				email: "newemail@email.com",
				name: "newuser",
				password: "newpassword",
				wpm: 36,
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid user ID");
	});

	test("User was not updated due to duplicate email.", async () => {
		const user1 = await createUser({ email: "user1@email.com", name: "user1" });
		const user2 = await createUser({ email: "user2@email.com", name: "user2" });

		await makeHttpRequest("POST", "/login", {
			usernameEmail: user1.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/users/${user1.props.id}`,
			{
				email: user2.props.email,
				name: "newuser",
				password: "newpassword",
				wpm: 36,
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("User with this email already exists.");
	});

	test("User was not updated due to duplicate name.", async () => {
		const user1 = await createUser({ email: "user1@email.com", name: "user1" });
		const user2 = await createUser({ email: "user2@email.com", name: "user2" });

		await makeHttpRequest("POST", "/login", {
			usernameEmail: user1.props.email,
			password: "password",
		});

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/users/${user1.props.id}`,
			{
				email: "newemail@email.com",
				name: user2.props.name,
				password: "newpassword",
				wpm: 36,
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("User with this name already exists.");
	});

	test("User was able to toggle darkmode.", async () => {
		const user = await createUser();

		await makeHttpRequest("POST", "/login", {
			usernameEmail: user.props.email,
			password: "password",
		});

		let { statusCode, body, cookies }: HttpResponse =
			await makeHttpRequest("PUT", `/users/${user.props.id}`, {
				email: "newemail@email.com",
				name: "newuser",
				password: "newpassword",
				wpm: 36,
			});

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("User updated");
		expect(Object.keys(body.payload).includes("user")).toBe(true);
		expect(body.payload.user.createdAt).toBeTruthy();
		expect(body.payload.user.editedAt).toBeTruthy();
		expect(body.payload.user.theme).toBe("light");

		const response: HttpResponse =
			await makeHttpRequest("PUT", `/users/${user.props.id}`, {
				email: "newemail@email.com",
				name: "newuser",
				password: "newpassword",
				wpm: 36,
				darkmode: "on",
			});

		expect(response.body.payload.user.theme).toBe("dark");
	});
});
