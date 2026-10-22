// Request validation schemas, shared so the client can reuse them for forms.
import { z } from 'zod'
import { LIST_TYPES } from './constants'

// Optional free text: trimmed, empty string stored as null, null clears the value on update
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === '' ? null : v))

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const listQuerySchema = z.object({
  type: z.enum(LIST_TYPES).optional(),
})

export const createListSchema = z.object({
  type: z.enum(LIST_TYPES),
  name: z.string().trim().min(1).max(100),
})

export const updateListSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export const createItemSchema = z.object({
  text: z.string().trim().min(1).max(200),
  quantity: optionalText(50),
  reason: optionalText(500),
})

export const updateItemSchema = z
  .object({
    text: z.string().trim().min(1).max(200),
    quantity: optionalText(50),
    reason: optionalText(500),
    done: z.boolean(),
    position: z.number().int().min(0),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })

export type CreateListInput = z.input<typeof createListSchema>
export type UpdateListInput = z.input<typeof updateListSchema>
export type CreateItemInput = z.input<typeof createItemSchema>
export type UpdateItemInput = z.input<typeof updateItemSchema>
