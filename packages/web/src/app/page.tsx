import { redirect } from "next/navigation";

export default function Home() {
  // Middleware handles auth-based redirect.
  // This is a fallback for authenticated users.
  redirect("/dashboard");
}
