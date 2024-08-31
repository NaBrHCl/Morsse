import postgres from "postgres";
import {
    camelToSnake,
    convertToCase,
    createUTCDate,
    snakeToCamel,
} from "../utils";

export interface LessonProps {
    id?: number;
    title: string;
    text: string;
    message: string;
    type: "send" | "receive";
    completionCount: number;
    difficulty: number;
    createdAt: Date;
    userId: number;
}

export default class Lesson {
    constructor(
        private sql: postgres.Sql<any>,
        public props: LessonProps,
    ) { }

    static async create(sql: postgres.Sql<any>, props: LessonProps) {
        const connection = await sql.reserve();

        props.createdAt = props.createdAt ?? createUTCDate();

        const [row] = await connection<LessonProps[]>`
        INSERT INTO lessons
            ${sql(convertToCase(camelToSnake, props))}
        RETURNING *
    `;

        await connection.release();

        return new Lesson(sql, convertToCase(snakeToCamel, row) as LessonProps);
    }

    static async read(sql: postgres.Sql<any>, id: number) {
        const connection = await sql.reserve();

        const [row] = await connection<LessonProps[]>`
            SELECT * FROM
            lessons WHERE id = ${id}
        `;

        await connection.release();

        return new Lesson(sql, convertToCase(snakeToCamel, row) as LessonProps);
    }

    static async readAll(
        sql: postgres.Sql<any>,
        reversed: boolean,
        userId?: number,
        sortBy?: string,
    ): Promise<Lesson[]> {
        const connection = await sql.reserve();

        const getSortBy = (sortBy: string | undefined) => {
            switch (sortBy) {
                case "difficulty":
                    return sql`difficulty`;
                case "completionCount":
                    return sql`completion_count`;
                default:
                    return sql`id`;
            }
        };

        const rows = await connection<LessonProps[]>`
        SELECT *
        FROM lessons
        ${userId ? sql`WHERE user_id = ${userId}` : sql``}
        ${sql`ORDER BY ${getSortBy(sortBy)} ${reversed ? sql`DESC` : sql``}`}
        `;

        await connection.release();

        return rows.map(
            (row) =>
                new Lesson(sql, convertToCase(snakeToCamel, row) as LessonProps),
        );
    }

    async checkCompletion(userId: number): Promise<boolean> {
        const connection = await this.sql.reserve();

        const lessonCompleted: boolean = (await connection`
            SELECT 1 FROM
            user_lesson WHERE
            user_id = ${userId} AND lesson_id = ${this.props.id}
        `).length > 0;

        await connection.release();

        return lessonCompleted;
    }

    async complete(userId: number) {
        const connection = await this.sql.reserve();

        await connection`
            INSERT INTO
            user_lesson (user_id, lesson_id)
            VALUES (${userId}, ${this.props.id})
        `;

        await connection`
            UPDATE lessons
            SET completion_count = completion_count + 1
            WHERE id = ${this.props.id}
        `;

        await connection`
            UPDATE users
            SET reputation = reputation + 1
            WHERE id = ${this.props.userId}
        `;

        await connection`
            UPDATE users
            SET completion_count = completion_count + 1
            WHERE id = ${userId}
        `;

        await connection.release();
    }
}