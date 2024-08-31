import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import { getPath } from "../url";
import Cookie from "../auth/Cookie";
import SessionManager from "../auth/SessionManager";
import Session from "../auth/Session";
import User from "../models/User";

export default class AuthController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	registerRoutes(router: Router) {
		router.get("/register", this.getRegistrationForm);
		router.get("/login", this.getLoginForm);
		router.post("/login", this.login);
		router.get("/logout", this.logout);
	}

	/**
	 * TODO: Render the registration form.
	 */
	getRegistrationForm = async (req: Request, res: Response) => {
		let error: string | null = req.getSearchParams().get("error");

		let errorMessage: string | null = null;

		if (error) {
			switch (error) {
				case "missing_email":
					errorMessage = "Email is required.";
					break;

				case "invalid_email":
					errorMessage = "Email is invalid.";
					break;

				case "missing_name":
					errorMessage = "Username is required.";
					break;

				case "missing_password":
					errorMessage = "Password is required.";
					break;

				case "missing_confirm_password":
					errorMessage = "Confirm password is required.";
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

				case "duplicate_email":
					errorMessage = "Email is already in use.";
					break;

				case "duplicate_name":
					errorMessage = "Username is already in use.";
					break;

				case "password_mismatch":
					errorMessage = "Passwords do not match.";
					break;
			}
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Registration Form Retrieved",
			payload: {
				error: errorMessage
			},
			template: "RegistrationFormView"
		});
	};

	/**
	 * TODO: Render the login form.
	 */
	getLoginForm = async (req: Request, res: Response) => {
		let error: string | null = req.getSearchParams().get("error");

		let errorMessage: string | null = null;

		if (error) {
			switch (error) {
				case "missing_email":
					errorMessage = "Email is required.";
					break;

				case "missing_password":
					errorMessage = "Password is required.";
					break;

				case "invalid_credentials":
					errorMessage = "Invalid credentials.";
					break;
			}
		}

		let message: string | undefined;

		let isUnauthorizedCookie: Cookie | undefined = req.findCookie("unauthorized");

		if (isUnauthorizedCookie) {
			errorMessage = "Unauthorized request, please log in.";

			isUnauthorizedCookie.setExpires();

			res.setCookie(isUnauthorizedCookie);
		}

		let isRegisteredCookie: Cookie | undefined = req.findCookie("registered");

		if (isRegisteredCookie) {
			message = "User registered successfully!";

			isRegisteredCookie.setExpires();

			res.setCookie(isRegisteredCookie);
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Login Form Retrieved",
			payload: {
				error: errorMessage,
				email: req.findCookie("email")?.value ?? null,
				message
			},
			template: "LoginFormView"
		});
	};

	/**
	 * TODO: Handle login form submission.
	 */
	login = async (req: Request, res: Response) => {
		let body = req.body;

		let error: string | null = null;

		if (!body["usernameEmail"])
			error = "missing_usernameEmail";
		else if (!body["password"])
			error = "missing_password";

		if (error) {
			await res.send({
				statusCode: StatusCode.Redirect,
				message: "Error!",
				redirect: getPath(`login?error=${error}`)
			});

			return;
		}

		try {
			let user = await User.login(this.sql, body["usernameEmail"], body["password"]);

			let session: Session = req.getSession();
			session.data["userId"] = user.props.id;
			session.data["darkmode"] = user.props.theme === "dark";

			res.setCookie(
				new Cookie(
					"email",
					user.props.email,
					(body["remember"] === "on") ? 2592000000 : 0
				)
			);

			res.setCookie(session.cookie);
			res.send({
				statusCode: StatusCode.OK,
				message: "Logged in successfully!",
				payload: {
					user: {
						email: user.props.email,
						name: user.props.name,
						password: user.props.password,
						reputation: user.props.reputation,
						wpm: user.props.wpm,
						createdAt: user.props.createdAt
					}
				},
				redirect: getPath()
			});
		} catch {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid credentials.",
				redirect: getPath("login?error=invalid_credentials")
			});
		}
	};

	/**
	 * TODO: Handle logout.
	 */
	logout = async (req: Request, res: Response) => {
		let session: Session = req.getSession();

		session.destroy();
		res.setCookie(session.cookie);

		res.send({
			statusCode: StatusCode.Redirect,
			message: "Logout successful!",
			redirect: getPath("")
		})
	};
}
