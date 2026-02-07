import { getViewerCount } from "@/lib/action-bus";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ count: getViewerCount() });
}
