// src/api/fetchAxiosShim.js
import { API_BASE } from "./base";
import axios from "axios";

// Make raw axios(...) and axios.get/post... default to our API base
axios.defaults.baseURL = API_BASE;

// Wrap window.fetch to rewrite '/api/...'
const originalFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  try {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = API_BASE + input.replace(/^\/api/, "");
    } else if (input && typeof input.url === "string" && input.url.startsWith("/api/")) {
      input = new Request(API_BASE + input.url.replace(/^\/api/, ""), input);
    }
  } catch {}
  return originalFetch(input, init);
};
