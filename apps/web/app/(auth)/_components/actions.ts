"use server";

import { getServerSession, getAuthToken } from "@/lib/auth-server";
import { headers } from "next/headers";
import { createTicket } from "@/lib/desktop-auth";

export async function generateUserToken() {
  const reqHeaders = await headers();
  const session = await getServerSession(reqHeaders);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const token = (await getAuthToken()) || session.session?.id || session.user.id;
  return token;
}

export async function createDesktopSignInToken() {
  const reqHeaders = await headers();
  const session = await getServerSession(reqHeaders);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const token = (await getAuthToken()) || session.session?.id || session.user.id;
  const ticket = createTicket(session.user.id, token);

  return { token: ticket };
}
