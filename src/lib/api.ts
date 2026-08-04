import axios from "axios";
import { supabase } from "./supabase";

export const api = axios.create({ baseURL: "/api", timeout: 20_000 });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) config.headers.Authorization = `Bearer ${data.session.access_token}`;
  return config;
});
