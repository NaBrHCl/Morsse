import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import { getPath } from "../url";
import Cookie from "../auth/Cookie";
import SessionManager from "../auth/SessionManager";
import Session from "../auth/Session";
import User from "../models/User";
import Lesson, { LessonProps } from "../models/Lesson";
import { createUTCDate, sendError } from "../utils";

export default class AuthController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	registerRoutes(router: Router) {
		router.get("/lessons", this.getLessonList);
		router.get("/lessons/new", this.getNewLessonForm);
		router.post("/lessons", this.createLesson);

		router.get("/lessons/:id/overview", this.getLessonOverview);
		router.get("/lessons/:id", this.getLesson);
		router.get("/lessons/:id/complete", this.completeLesson);
	}

	getNewLessonForm = async (req: Request, res: Response) => {
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

		await res.send({
			statusCode: StatusCode.OK,
			message: "New Lesson Form Retrieved",
			payload: {},
			template: "NewFormView",
		});
	};

	createLesson = async (req: Request, res: Response) => {
		let error: string | undefined;

		if (!this.isValidLessonProps(req.body))
			error = "Request body must include title, text, message, type and difficulty";
		else if (req.body.title.length > 100)
			error = "Title cannot exceed 100 characters";
		else if (req.body.text.length > 255)
			error = "Text cannot exceed 100 characters";
		else if (!req.body.text.match(/[\w,.!?"';() ]+/))
			error = "Text contains invalid character";
		else if (req.body.message.length > 500)
			error = "Message cannot exceed 500 characters";
		else {
			let difficulty: number = Number(req.body.difficulty);

			if (difficulty < 1 || difficulty > 5)
				error = "Difficulty must be between 1 and 5 inclusively";
		}

		if (error) {
			await sendError(req, res, StatusCode.BadRequest, error);

			return;
		}

		let userId: number = req.getSession().data["userId"];

		if (!userId) {
			await sendError(req, res, StatusCode.Unauthorized, "Unauthorized");

			return;
		}

		let lesson: Lesson | null = null;
		let lessonProps: LessonProps = {
			title: req.body.title,
			text: req.body.text,
			message: req.body.message,
			type: req.body.type,
			completionCount: 0,
			difficulty: req.body.difficulty,
			createdAt: createUTCDate(),
			userId,
		};

		try {
			lesson = await Lesson.create(this.sql, lessonProps);
		} catch (error) {
			const message = `Error while creating lesson: ${error}`;
			console.error(message);
			await sendError(req, res, StatusCode.InternalServerError, message);

			return;
		}

		if (!lesson) {
			await sendError(req, res, StatusCode.InternalServerError, "Error while creating todo");

			return;
		}

		await res.send({
			statusCode: StatusCode.Created,
			message: "Lesson created successfully!",
			redirect: getPath(`lessons/${lesson.props.id}/overview`),
		});
	}

	getLesson = async (req: Request, res: Response) => {
		const id: number = req.getId();

		if (isNaN(id)) {
			await sendError(req, res, StatusCode.BadRequest, "Invalid ID");

			return;
		}

		let userId: number = req.getSession().data["userId"];

		if (!userId) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				payload: {},
				redirect: getPath("login"),
			})

			return;
		}

		let user: User = await User.read(this.sql, userId);

		let lesson: Lesson | undefined;

		try {
			lesson = await Lesson.read(this.sql, id);
		} catch (error) {
			const message = `Error while reading lesson: ${error}`;
			console.error(message);
			await sendError(req, res, StatusCode.InternalServerError, message);

			return;
		}

		if (lesson) {
			await res.send({
				statusCode: StatusCode.OK,
				message: "Lesson retrieved",
				payload: {
					lesson: lesson.props,
					wpm: user.props.wpm,
				},
				template: (lesson.props.type === "send") ? "LessonSendView" : "LessonReceiveView",
			})
		} else {
			await sendError(req, res, StatusCode.NotFound, "Lesson Not Found");
		}
	}

	completeLesson = async (req: Request, res: Response) => {
		const id: number = req.getId();

		if (isNaN(id)) {
			await sendError(req, res, StatusCode.BadRequest, "Invalid ID");

			return;
		}

		let userId: number = req.getSession().data["userId"];

		if (!userId) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				payload: {},
				redirect: getPath("login"),
			})

			return;
		}

		let user: User = await User.read(this.sql, userId);

		let lesson: Lesson | undefined;

		try {
			lesson = await Lesson.read(this.sql, id);
		} catch (error) {
			const message = `Error while reading lesson: ${error}`;
			console.error(message);
			await sendError(req, res, StatusCode.InternalServerError, message);

			return;
		}

		let lessonCompleted: boolean = await lesson.checkCompletion(userId);

		if (!lessonCompleted)
			await lesson.complete(userId);

		if (lesson) {
			await res.send({
				statusCode: StatusCode.OK,
				message: "Lesson completed",
				redirect: getPath(`lessons/${lesson.props.id}/overview`),
			})
		} else {
			await sendError(req, res, StatusCode.NotFound, "Lesson Not Found");
		}
	}

	getLessonOverview = async (req: Request, res: Response) => {
		const id: number = req.getId();

		if (isNaN(id)) {
			await sendError(req, res, StatusCode.BadRequest, "Invalid ID");

			return;
		}

		let userId: number = req.getSession().data["userId"];

		if (!userId) {
			res.setCookie(new Cookie("unauthorized", "true"));

			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				payload: {},
				redirect: getPath("login"),
			})

			return;
		}

		let lesson: Lesson | undefined;

		try {
			lesson = await Lesson.read(this.sql, id);
		} catch (error) {
			const message = `Error while reading lesson: ${error}`;
			console.error(message);
			await sendError(req, res, StatusCode.InternalServerError, message);

			return;
		}

		let lessonCompleted: boolean = await lesson.checkCompletion(userId);
		let creator: User = await User.read(this.sql, lesson.props.userId);

		if (lesson) {
			await res.send({
				statusCode: StatusCode.OK,
				message: "Lesson retrieved",
				payload: {
					lesson: lesson.props,
					creator: {
						name: creator.props.name,
						reputation: creator.props.reputation,
					},
					isCreator: lesson.props.userId === userId,
					completed: lessonCompleted,
				},
				template: "LessonOverview",
			})
		} else {
			await sendError(req, res, StatusCode.NotFound, "Lesson Not Found");
		}
	}

	getLessonList = async (req: Request, res: Response) => {
		const queryParams = req.getSearchParams();

		let error: string | null = null;

		const reversed = queryParams.get("reversed");
		const userId = queryParams.get("userId");
		const sortBy = queryParams.get("sortBy");

		if (reversed && reversed !== "true" && reversed !== "false")
			error = "Invalid reversed value";
		else if (userId && isNaN(Number(userId)))
			error = "Invalid user Id";
		else if (sortBy && sortBy !== "difficulty" && sortBy !== "completionCount")
			error = "Invalid sort by";

		if (error) {
			await sendError(req, res, StatusCode.BadRequest, error);

			return;
		}

		let lessons: Lesson[];

		try {
			lessons = await Lesson.readAll(
				this.sql,
				reversed === "true",
				Number(userId),
				(sortBy === null) ? undefined : sortBy
			);
		} catch (error) {
			const message = `Error while getting todo list: ${error}`;
			console.error(error);
			await sendError(req, res, StatusCode.InternalServerError, message);
			return;
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "Lesson list retrieved",
			payload: {
				lessons: lessons.map(lesson => lesson.props),
			},
			template: "LessonListView",
		})
	}

	isValidLessonProps = (props: any): props is LessonProps => {
		return (
			props.hasOwnProperty("title") &&
			props.hasOwnProperty("text") &&
			props.hasOwnProperty("message") &&
			props.hasOwnProperty("type") &&
			props.hasOwnProperty("difficulty") &&
			typeof props.title === "string" &&
			typeof props.text === "string" &&
			typeof props.message === "string" &&
			(props.type === "send" || props.type === "receive") &&
			!isNaN(Number(props.difficulty))
		);
	}
}