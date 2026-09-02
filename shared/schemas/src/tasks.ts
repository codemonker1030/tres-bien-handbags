import * as zod from "zod";

const taskShape = {
  id: zod.number(),
  title: zod.string(),
  description: zod.string().nullish(),
  status: zod.enum(["todo", "in_progress", "done"]),
  priority: zod.enum(["low", "medium", "high"]),
  dueDate: zod.string().nullish(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
};

export const ListTasksResponseItem = zod.object(taskShape);
export const ListTasksResponse = zod.array(ListTasksResponseItem);

export const CreateTaskBody = zod.object({
  title: zod.string().min(1),
  description: zod.string().optional(),
  status: zod.enum(["todo", "in_progress", "done"]).optional(),
  priority: zod.enum(["low", "medium", "high"]).optional(),
  dueDate: zod.string().optional(),
});

export const GetTaskParams = zod.object({ id: zod.coerce.number() });
export const GetTaskResponse = zod.object(taskShape);

export const UpdateTaskParams = zod.object({ id: zod.coerce.number() });
export const UpdateTaskBody = zod.object({
  title: zod.string().optional(),
  description: zod.string().optional(),
  status: zod.enum(["todo", "in_progress", "done"]).optional(),
  priority: zod.enum(["low", "medium", "high"]).optional(),
  dueDate: zod.string().optional(),
});
export const UpdateTaskResponse = zod.object(taskShape);

export const DeleteTaskParams = zod.object({ id: zod.coerce.number() });

export const CompleteTaskParams = zod.object({ id: zod.coerce.number() });
export const CompleteTaskResponse = zod.object(taskShape);
