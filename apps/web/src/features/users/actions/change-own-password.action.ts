"use server";

import { userService } from "@/features/users/services/user.service";
import { requireUser } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type ChangePasswordFormState = { error?: string; success?: boolean };

export async function changeOwnPasswordAction(
  _prevState: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  try {
    const user = await requireUser();
    const raw = Object.fromEntries(formData.entries());
    await userService.changeOwnPassword(user.id, raw);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  return { success: true };
}
