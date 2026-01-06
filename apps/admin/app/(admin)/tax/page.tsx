import { redirect } from "next/navigation";

/**
 * Tax Management page - Redirects to Tax Rules as the default page
 */
export default function TaxPage() {
  redirect("/tax/rules");
}
