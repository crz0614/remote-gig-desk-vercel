export type WorkbenchUser = { displayName: string; email: string; fullName: string | null };

export async function getChatGPTUser(): Promise<WorkbenchUser | null> {
  const email = process.env.OWNER_EMAIL;
  if (!email) return null;
  return { displayName: "Vesper Chen", email, fullName: "Vesper Chen" };
}
