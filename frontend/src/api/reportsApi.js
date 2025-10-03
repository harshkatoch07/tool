import { http, authHeaders } from "./http";

export async function getUserActivityReport({ username, fromUtc, toUtc }) {
  const params = new URLSearchParams({ username, fromUtc, toUtc });
  const { data } = await http.get(`/reports/user-activity?${params.toString()}`, {
    headers: authHeaders(),
  });
  return data;
}
