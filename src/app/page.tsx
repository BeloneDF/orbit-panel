import { ControlRoom } from "@/components/control-room";
import { getConnection } from "@/lib/session";
import { currentActor } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const connection = await getConnection();
  return <ControlRoom initialView="overview" initialConnection={connection ? { connected: true, baseUrl: connection.baseUrl } : { connected: false }} actor={actor} />;
}
