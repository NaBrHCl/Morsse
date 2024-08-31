import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface UserProps {
	id?: number;
	email: string;
	name: string;
	reputation: number;
	password: string;
	createdAt: Date;
	editedAt?: Date;
	theme?: "dark" | "light";
	wpm: number;
}

export class DuplicateEmailError extends Error {
	constructor() {
		super("User with this email already exists.");
	}
}

export class DuplicateNameError extends Error {
	constructor() {
		super("User with this name already exists.");
	}
}

export class InvalidCredentialsError extends Error {
	constructor() {
		super("Invalid credentials.");
	}
}

export default class User {
	constructor(
		private sql: postgres.Sql<any>,
		public props: UserProps,
	) { }

	static async create(
		sql: postgres.Sql<any>,
		props: UserProps,
	): Promise<User> {
		const connection = await sql.reserve();

		const duplicateEmail: boolean = (await connection<UserProps[]>`
			SELECT 1 FROM
			users WHERE email = ${props.email}
		`).length > 0;

		if (duplicateEmail) {
			await connection.release();
			throw new DuplicateEmailError();
		}

		const duplicateName: boolean = (await connection<UserProps[]>`
			SELECT 1 FROM
			users WHERE name = ${props.name}
		`).length > 0;

		if (duplicateName) {
			await connection.release();
			throw new DuplicateNameError();
		}

		const [row] = await connection<UserProps[]>`
			INSERT INTO users
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;

		await connection.release();

		return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
	}

	static async login(
		sql: postgres.Sql<any>,
		usernameEmail: string,
		password: string,
	): Promise<User> {
		const connection = await sql.reserve();

		const [row] = await connection<UserProps[]>`
			SELECT * FROM
			users WHERE (email = ${usernameEmail} OR name = ${usernameEmail}) AND password = ${password}
		`;

		await connection.release();

		if (!row) {
			throw new InvalidCredentialsError();
		}

		return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
	}

	static async read(
		sql: postgres.Sql<any>,
		id: number,
	): Promise<User> {
		const connection = await sql.reserve();

		const [row] = await connection<UserProps[]>`
			SELECT * FROM
			users WHERE id = ${id}
		`;

		await connection.release();

		if (!row) {
			throw new InvalidCredentialsError();
		}

		return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
	}

	async delete() {
		const connection = await this.sql.reserve();

		await connection`
		DELETE FROM users
		WHERE id = ${this.props.id}
		`;

		await connection.release();
	}

	async update(updateProps: Partial<UserProps>) {
		const connection = await this.sql.reserve();

		const duplicateEmail: boolean = (await connection<UserProps[]>`
			SELECT 1 FROM
			users WHERE email = ${updateProps.email} AND id != ${this.props.id}
		`).length > 0;

		if (duplicateEmail) {
			await connection.release();
			throw new DuplicateEmailError();
		}

		const duplicateName: boolean = (await connection<UserProps[]>`
			SELECT 1 FROM
			users WHERE name = ${updateProps.name} AND id != ${this.props.id}
		`).length > 0;

		if (duplicateName) {
			await connection.release();
			throw new DuplicateNameError();
		}

		if (Object.keys(updateProps).length > 0) {
			let editedAt: Date = createUTCDate();

			const [row] = await connection`
		UPDATE users
		SET
			${this.sql(convertToCase(camelToSnake, updateProps))}, edited_at = ${editedAt}
		WHERE
			id = ${this.props.id}
		RETURNING *
		`;

			this.props = { ...this.props, ...convertToCase(snakeToCamel, row) };

			this.props.editedAt = editedAt;

			await connection.release();
		}
	}
}
