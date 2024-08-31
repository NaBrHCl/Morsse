import { test, expect } from "@playwright/test";
import { getPath } from "../src/url";
import postgres from "postgres";
import { createUTCDate } from "../src/utils";
import User, { UserProps } from "../src/models/User";

let sql = postgres({
	database: "TodoDB",
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

/**
 * Clean up the database after each test. This function deletes all the rows
 * from the lessons and users tables and resets the sequence for each table.
 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
 */
test.afterEach(async () => {
	const tables = ["lessons", "users"];

	try {
		for (const table of tables) {
			await sql.unsafe(`DELETE FROM ${table}`);
			await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
		}
	} catch (error) {
		console.error(error);
	}
});

test("User was registered.", async ({ page }) => {
	await page.goto(`register`);

	await page.fill('form#register-form input[name="email"]', "user@email.com");
	await page.fill('form#register-form input[name="name"]', "user");
	await page.fill('form#register-form input[name="password"]', "Password123");
	await page.fill(
		'form#register-form input[name="confirmPassword"]',
		"Password123",
	);
	await page.click("form#register-form #register-form-submit-button");

	expect(await page?.url()).toBe(getPath("login"));
});

test("User was not registered with blank email.", async ({ page }) => {
	await page.goto(`register`);

	await page.fill('form#register-form input[name="name"]', "user");
	await page.fill('form#register-form input[name="password"]', "Password123");
	await page.fill(
		'form#register-form input[name="confirmPassword"]',
		"Password123",
	);
	await page.click("form#register-form #register-form-submit-button");

	expect(await page?.url()).toMatch(getPath("register"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Email is required");
});

test("User was not registered with mismatched passwords.", async ({ page }) => {
	await page.goto(`register`);

	await page.fill('form#register-form input[name="email"]', "user@email.com");
	await page.fill('form#register-form input[name="name"]', "user");
	await page.fill('form#register-form input[name="password"]', "Password123");
	await page.fill(
		'form#register-form input[name="confirmPassword"]',
		"Password124",
	);
	await page.click("form#register-form #register-form-submit-button");

	expect(await page?.url()).toMatch(getPath("register"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Passwords do not match");
});

test("User was logged in.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/`);

	let loginElement = await page.$(`nav a[href="${getPath("login")}"]`);
	let logoutElement = await page.$(`nav a[href="${getPath("logout")}"]`);

	expect(await loginElement).toBeTruthy();
	expect(await logoutElement).toBeFalsy();

	await loginElement?.click();

	await page.fill('form#login-form input[name="usernameEmail"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath());

	loginElement = await page.$(`nav a[href="${getPath("login")}"]`);
	logoutElement = await page.$(`nav a[href="${getPath("logout")}"]`);

	expect(await loginElement).toBeFalsy();
	expect(await logoutElement).toBeTruthy();
});

test("User was not logged in with blank email.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toMatch(getPath("login"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Email is required.");
});

test("User was not logged in with incorrect password.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="usernameEmail"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password124");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toMatch(getPath("login"));

	const errorElement = await page.$("#error");

	expect(await errorElement?.innerText()).toMatch("Invalid credentials.");
});

test("User was logged out.", async ({ page, context }) => {
	const user = await createUser({ password: "Password123" });

	expect((await context.cookies()).length).toBe(0);

	await page.goto(`/login`);

	expect((await context.cookies()).length).toBe(1);

	await page.fill('form#login-form input[name="usernameEmail"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath());

	const logoutElement = await page.$(`nav a[href="${getPath("logout")}"]`);

	await logoutElement?.click();

	expect(await page?.url()).toBe(getPath());

	const loginElement = await page.$(`nav a[href="${getPath("login")}"]`);

	expect(await loginElement).toBeTruthy();
});

test("User's email was remembered.", async ({ page }) => {
	const user = await createUser({ email: "user@email.com" });
	await page.goto(`/login`);

	await page.fill('form#login-form input[name="usernameEmail"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "password");
	await page.check('form#login-form input[name="remember"]');
	await page.click("form#login-form #login-form-submit-button");

	const cookies = await page.context().cookies();

	const emailCookie = cookies.find((cookie) => cookie.name === "email");

	expect(emailCookie).toBeTruthy();
	expect(emailCookie?.value).toBe(user.props.email);
});

test("User was updated.", async ({ page }) => {
	const user = await createUser({ password: "Password123" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="usernameEmail"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "Password123");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath());

	await page.goto(`/users/${user.props.id}/edit`);

	await page.fill(
		'form#edit-user-form input[name="email"]',
		"updateduser@email.com",
	);
	await page.fill(
		'form#edit-user-form input[name="name"]',
		"updateduser",
	);
	await page.fill(
		'form#edit-user-form input[name="password"]',
		"newpassword",
	);
	await page.fill(
		'form#edit-user-form input[name="wpm"]',
		"5",
	);
	await page.click("form#edit-user-form #edit-user-form-submit-button");

	expect(await page?.url()).toMatch(getPath(`users/${user.props.id}/edit`));
	expect(await page?.textContent("body")).toMatch(
		"User updated successfully!",
	);

	const updatedUser = await User.read(sql, user.props.id!);

	expect(updatedUser?.props.email).toBe("updateduser@email.com");
	expect(updatedUser?.props.name).toBe("updateduser");
	expect(updatedUser?.props.wpm).toBe(5);
	expect(updatedUser?.props.password).toBe("newpassword");
	expect(updatedUser?.props.editedAt).toBeTruthy();
});

test("User was not updated with duplicate email.", async ({ page }) => {
	const user1 = await createUser({ email: "user1@email.com" });
	const user2 = await createUser({ email: "user2@email.com" });

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="usernameEmail"]', user1.props.email);
	await page.fill('form#login-form input[name="password"]', "password");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath());

	await page.goto(`/users/${user1.props.id}/edit`);

	await page.fill(
		'form#edit-user-form input[name="email"]',
		user2.props.email,
	);

	await page.click("form#edit-user-form #edit-user-form-submit-button");

	expect(await page?.url()).toMatch(getPath(`users/${user1.props.id}/edit`));
	expect(await page?.textContent("body")).toMatch(
		"Email is already in use",
	);
});

test("User was able to toggle darkmode.", async ({ page, context }) => {
	const user = await createUser();

	await page.goto(`/login`);

	await page.fill('form#login-form input[name="usernameEmail"]', user.props.email);
	await page.fill('form#login-form input[name="password"]', "password");
	await page.click("form#login-form #login-form-submit-button");

	expect(await page?.url()).toBe(getPath());

	await page.goto(`/users/${user.props.id}/edit`);

	await page.check('form#edit-user-form input[name="darkmode"]');
	await page.click("form#edit-user-form #edit-user-form-submit-button");

	expect(await page.isChecked('form#edit-user-form input[name="darkmode"]')).toBe(true);

	// Toggle darkmode off
	await page.uncheck('form#edit-user-form input[name="darkmode"]');
	await page.click("form#edit-user-form #edit-user-form-submit-button");

	expect(await page.isChecked('form#edit-user-form input[name="darkmode"]')).toBe(false);
});