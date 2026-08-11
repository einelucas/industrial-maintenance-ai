import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

export async function pdfResponse(document: ReactElement, filename: string): Promise<Response> {
  const buffer = await renderToBuffer(document);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
