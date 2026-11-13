const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    const result: { error?: string } = await response.json();
    throw new Error(result.error || "The request could not be completed.");
  }
  return response;
}
