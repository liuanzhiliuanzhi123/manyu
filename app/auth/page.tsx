import { Suspense } from "react"
import { AuthPageClient } from "@/components/travel/auth/auth-page-client"

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageClient />
    </Suspense>
  )
}
