import axios from "axios";

export async function getUserActivityReport({ username, fromUtc, toUtc }) {
  const params = new URLSearchParams({ username, fromUtc, toUtc });
  const { data } = await axios.get(`/reports/user-activity?${params.toString()}`);
  return data;
}
