import { prisma } from "@/lib/db/client";

export const humanReviewRepository = {
  findForIncident: (thermalIncidentId: string) =>
    prisma.humanReview.findMany({
      where: { thermalIncidentId },
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { id: true, name: true } } },
    }),
};
