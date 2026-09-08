import { redirect } from "next/navigation";

export default function LegacyPage() {
  redirect("/settings/thermal-risk");
}
