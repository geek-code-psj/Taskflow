import { z } from 'zod';
export declare const SignupSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    email: string;
    password: string;
}, {
    username: string;
    email: string;
    password: string;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const CreateProjectSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export declare const UpdateProjectSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
}>;
export declare const AddMemberSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<["admin", "member"]>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "admin" | "member";
}, {
    email: string;
    role: "admin" | "member";
}>;
export declare const UpdateMemberRoleSchema: z.ZodObject<{
    role: z.ZodEnum<["admin", "member"]>;
}, "strip", z.ZodTypeAny, {
    role: "admin" | "member";
}, {
    role: "admin" | "member";
}>;
export declare const TaskStatusEnum: z.ZodEnum<["todo", "in_progress", "done"]>;
export declare const TaskPriorityEnum: z.ZodEnum<["low", "medium", "high"]>;
export declare const CreateTaskSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["todo", "in_progress", "done"]>>;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    due_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigned_to: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "todo" | "in_progress" | "done";
    title: string;
    priority: "low" | "medium" | "high";
    description?: string | undefined;
    due_date?: string | null | undefined;
    assigned_to?: string | null | undefined;
}, {
    title: string;
    status?: "todo" | "in_progress" | "done" | undefined;
    description?: string | undefined;
    priority?: "low" | "medium" | "high" | undefined;
    due_date?: string | null | undefined;
    assigned_to?: string | null | undefined;
}>;
export declare const UpdateTaskSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["todo", "in_progress", "done"]>>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>>;
    due_date: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    assigned_to: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    status?: "todo" | "in_progress" | "done" | undefined;
    description?: string | undefined;
    title?: string | undefined;
    priority?: "low" | "medium" | "high" | undefined;
    due_date?: string | null | undefined;
    assigned_to?: string | null | undefined;
}, {
    status?: "todo" | "in_progress" | "done" | undefined;
    description?: string | undefined;
    title?: string | undefined;
    priority?: "low" | "medium" | "high" | undefined;
    due_date?: string | null | undefined;
    assigned_to?: string | null | undefined;
}>;
export declare const UpdateTaskStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["todo", "in_progress", "done"]>;
}, "strip", z.ZodTypeAny, {
    status: "todo" | "in_progress" | "done";
}, {
    status: "todo" | "in_progress" | "done";
}>;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare const TaskFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["todo", "in_progress", "done"]>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>;
    assigned_to: z.ZodOptional<z.ZodString>;
    overdue: z.ZodOptional<z.ZodBoolean>;
    search: z.ZodOptional<z.ZodString>;
    sort: z.ZodDefault<z.ZodEnum<["created_at", "due_date", "priority", "status"]>>;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "status" | "priority" | "due_date" | "created_at";
    page: number;
    limit: number;
    order: "asc" | "desc";
    status?: "todo" | "in_progress" | "done" | undefined;
    priority?: "low" | "medium" | "high" | undefined;
    assigned_to?: string | undefined;
    overdue?: boolean | undefined;
    search?: string | undefined;
}, {
    sort?: "status" | "priority" | "due_date" | "created_at" | undefined;
    status?: "todo" | "in_progress" | "done" | undefined;
    priority?: "low" | "medium" | "high" | undefined;
    assigned_to?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    overdue?: boolean | undefined;
    search?: string | undefined;
    order?: "asc" | "desc" | undefined;
}>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;
export type TaskFilter = z.infer<typeof TaskFilterSchema>;
export type TaskStatus = z.infer<typeof TaskStatusEnum>;
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;
