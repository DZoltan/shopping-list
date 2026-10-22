// Request validation schemas, shared so the client can reuse them for forms.
import { z } from 'zod'
import { HOUSEHOLD_ROLES, LIST_TYPES } from './constants'

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
  // Optional when the user belongs to exactly one household
  householdId: z.number().int().positive().optional(),
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

// --- auth ---

const personName = z.string().trim().min(1).max(50)
const token = z.string().min(20).max(200)

export const householdNameSchema = z.string().trim().min(1).max(60)

// The `user` object of a WebAuthn registration request. Exactly one way in:
// an invite token, the admin setup token, or an existing session (adding a passkey).
export const registerUserSchema = z
  .object({
    userName: personName,
    displayName: personName.optional(),
    inviteToken: token.optional(),
    setupToken: token.optional(),
    householdName: householdNameSchema.optional(),
  })
  .refine((v) => !(v.inviteToken && v.setupToken), { message: 'Use either an invite or the setup token' })

export const tokenQuerySchema = z.object({ token })

export const createInviteSchema = z
  .object({
    name: personName,
    // null: the invitee starts a new household of their own
    householdId: z.number().int().positive().nullable(),
    role: z.enum(HOUSEHOLD_ROLES),
  })
  .refine((v) => v.householdId !== null || v.role === 'owner', {
    message: 'A new household needs an owner',
    path: ['role'],
  })

export const createDeviceLinkSchema = z.object({
  // Omitted: a link for yourself. Set (admin only): a recovery link for another user
  userId: z.number().int().positive().optional(),
})

export const redeemDeviceLinkSchema = z.object({ token })

export const credentialParamsSchema = z.object({
  id: z.string().min(1).max(1024),
})

export type CreateListInput = z.input<typeof createListSchema>
export type UpdateListInput = z.input<typeof updateListSchema>
export type CreateItemInput = z.input<typeof createItemSchema>
export type UpdateItemInput = z.input<typeof updateItemSchema>
export type RegisterUserInput = z.input<typeof registerUserSchema>
export type CreateInviteInput = z.input<typeof createInviteSchema>
