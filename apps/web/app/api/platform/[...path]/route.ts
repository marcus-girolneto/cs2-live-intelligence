// Thin route: the handler lives in src/server (security logic is unit-tested there).
export { GET, POST, PUT, PATCH, DELETE } from "@/server/handlers/platformProxy";
