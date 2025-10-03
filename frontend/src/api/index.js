// src/api/index.js
// Central API export for use in components
import axios from "axios";
import { API_BASE } from "./base";
axios.defaults.baseURL = API_BASE;

// Simple wrapper for get/post/put/delete
const api = {
	get: axios.get,
	post: axios.post,
	put: axios.put,
	delete: axios.delete,
};

export default api;
