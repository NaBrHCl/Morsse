import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, { UserProps, DuplicateEmailError, DuplicateNameError } from "../models/User";
import { getPath } from "../url";
import { createUTCDate } from "../utils";
import Cookie from "../auth/Cookie";
import { Exception } from "handlebars";
import { userInfo } from "os";
import { sendError } from "../utils";

/**
 * Controller for handling User CRUD operations.
 * Routes are registered in the `registerRoutes` method.
 * Each method should be called when a request is made to the corresponding route.
 */
export default class UserController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	registerRoutes(router: Router) {
		router.post("/users", this.createUser);
		router.get("/users/:id/edit", this.getProfileForm);
		router.get("/users/:id", this.getUser);
		router.put("/users/:id", this.updateUser);
		router.delete("/users/:id", this.deleteUser);

		// Any routes that include an `:id` parameter should be registered last.
	}

	/**
	 * TODO: Upon form submission, this controller method should
	 * validate that no fields are blank/missing, that the passwords
	 * match, and that there isn't already a user with the given email.
	 * If there are any errors, redirect back to the registration form
	 * with an error message.
	 * @param req
	 * @param res
	 */
	createUser = async (req: Request, res: Response) => {
		let body = req.body;

		let error: string | null = null;

		if (!body["email"])
			error = "missing_email";
		else if (String(body["email"]).length > 100)
			error = "long_email";
		else if (!body["name"])
			error = "missing_name";
		else if (String(body["name"]).length > 50)
			error = "long_name";
		else if (!body["password"])
			error = "missing_password";
		else if (String(body["password"]).length > 255)
			error = "long_password";
		else if (!body["confirmPassword"])
			error = "missing_confirm_password";
		else if (body["password"] != body["confirmPassword"])
			error = "password_mismatch";
		else if (body["email"] && typeof body["email"] === "string" && !/.+@.+/.test(body["email"]))
			error = "invalid_email";

		if (error) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: error,
				redirect: getPath(`register?error=${error}`),
			});

			return;
		}

		try {
			let user: User = await User.create(this.sql, {
				email: body["email"],
				name: body["name"],
				reputation: 0,
				password: body["password"],
				createdAt: createUTCDate(),
				theme: "dark",
				wpm: 15,
			});

			res.setCookie(new Cookie("registered", "true"));

			await res.send({
				statusCode: StatusCode.Created,
				message: "User created",
				payload: {
					user: user.props
				},
				redirect: getPath("login")
			});
		} catch (error: unknown) {
			if (error instanceof DuplicateEmailError)
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: error.message,
					redirect: getPath("register?error=duplicate_email")
				});
			else if (error instanceof DuplicateNameError)
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: error.message,
					redirect: getPath("register?error=duplicate_name")
				});
		}
	}

	deleteUser = async (req: Request, res: Response) => {
		let userId: number = req.getSession().data["userId"];

		if (!userId) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.Forbidden,
				message: "Unauthorized",
				redirect: getPath("login"),
			});

			return;
		}

		if (userId !== req.getId()) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid user ID",
				redirect: getPath("login"),
			});

			return;
		}

		let user: User;

		try {
			user = await User.read(this.sql, userId);
		} catch {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid user ID",
				redirect: getPath("login"),
			});

			return;
		}

		await user.delete();

		let session = req.getSession();

		session.destroy();
		res.setCookie(session.cookie);

		await res.send({
			statusCode: StatusCode.OK,
			message: "User deleted",
			redirect: getPath(),
		});
	}

	getProfileForm = async (req: Request, res: Response) => {
		let error: string | null = req.getSearchParams().get("error");

		let errorMessage: string | null = null;

		if (error) {
			switch (error) {
				case "missing_email":
					errorMessage = "Email is required.";
					break;

				case "missing_name":
					errorMessage = "Username is required.";
					break;

				case "missing_wpm":
					errorMessage = "WPM is required.";
					break;

				case "duplicate_email":
					errorMessage = "Email is already in use.";
					break;

				case "duplicate_name":
					errorMessage = "Username is already in use.";
					break;

				case "invalid_email":
					errorMessage = "Email is invalid.";
					break;

				case "invalid_wpm":
					errorMessage = "WPM is invalid.";
					break;

				case "long_email":
					errorMessage = "Email has to be shorter than 100 characters.";
					break;

				case "long_name":
					errorMessage = "Username has to be shorter than 50 characters.";
					break;

				case "long_password":
					errorMessage = "Email has to be shorter than 255 characters.";
					break;
			}
		}

		let user: User;

		try {
			let userId: number = req.getSession().data["userId"];

			let urlUserId: number = req.getId();

			if (!userId || !urlUserId || userId !== urlUserId)
				throw new Error();

			user = await User.read(this.sql, req.getId());
		} catch {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: getPath("login"),
			});

			return;
		}

		let message: string | null =
			(req.getSearchParams().get("message") === "user_updated") ? "User updated successfully!" : null;

		await res.send({
			statusCode: StatusCode.OK,
			message: "Profile Form Retrieved",
			payload: {
				message,
				error: errorMessage,
				email: user.props.email,
				name: user.props.name,
				wpm: user.props.wpm,
			},
			template: "ProfileFormView"
		});
	}

	getUser = async (req: Request, res: Response) => {
		let user: User;

		try {
			user = await User.read(this.sql, req.getId());
		} catch {
			await sendError(req, res, StatusCode.NotFound, "User not found");

			return;
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "User found",
			payload: {
				user: user.props,
			},
			template: "ProfileView",
		});
	}

	updateUser = async (req: Request, res: Response) => {
		let userId: number = req.getSession().data["userId"];

		if (!userId) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.Forbidden,
				message: "Unauthorized",
				redirect: getPath("login"),
			});

			return;
		}

		if (userId !== req.getId()) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid user ID",
				redirect: getPath("login"),
			});

			return;
		}

		let user: User;

		try {
			user = await User.read(this.sql, userId);
		} catch {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid user ID",
				redirect: getPath("login"),
			});

			return;
		}

		let body = req.body;
		let error: string | null = null;

		if (!body["email"])
			error = "missing_email";
		else if (String(body["email"]).length > 50)
			error = "long_email";
		else if (!body["name"])
			error = "missing_name";
		else if (String(body["name"]).length > 50)
			error = "long_name";
		else if (!body["wpm"])
			error = "missing_wpm";
		else if (body["email"] && typeof body["email"] === "string" && !/.+@.+/.test(body["email"]))
			error = "invalid_email";
		else if (body["password"] && String(body["password"]).length > 255)
			error = "long_password";
		else {
			let wpm: number = Number(body["wpm"]);

			if (Number.isNaN(wpm) || wpm < 1 || wpm > 60)
				error = "invalid_wpm";
		}

		if (error) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: error,
				redirect: getPath(`users/${userId}/edit?error=${error}`)
			});

			return;
		}

		let updatedProps: Partial<UserProps> = {
			email: body["email"],
			name: body["name"],
			wpm: Number(body["wpm"]),
			theme: (body["darkmode"] === "on") ? "dark" : "light",
		};

		if (body["password"])
			updatedProps.password = body["password"];

		try {
			await user.update(updatedProps);

			req.session.data["darkmode"] = user.props.theme === "dark";
		} catch (error: unknown) {
			if (error instanceof DuplicateEmailError)
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "User with this email already exists.",
					redirect: getPath(`users/${user.props.id}/edit?error=duplicate_email`)
				});
			else if (error instanceof DuplicateNameError)
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "User with this name already exists.",
					redirect: getPath(`users/${user.props.id}/edit?error=duplicate_name`)
				});

			return;
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "User updated",
			payload: {
				user: user.props,
			},
			redirect: getPath(`users/${user.props.id}/edit?message=user_updated`)
		});
	}
}