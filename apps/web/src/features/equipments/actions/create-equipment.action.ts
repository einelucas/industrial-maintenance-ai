"use server";

import { revalidatePath } from "next/cache";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type EquipmentFormState = { error?: string; success?: boolean };

export async function createEquipmentAction(
  _prevState: EquipmentFormState,
  formData: FormData
): Promise<EquipmentFormState> {
  try {
    const user = await requirePermission("equipment:manage");

    const raw = Object.fromEntries(formData.entries());
    const equipment = await equipmentService.create(raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "Equipment",
        entityId: equipment.id,
        action: "CREATE",
        metadata: { tag: equipment.tag },
      },
    });

    revalidatePath("/equipments");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
