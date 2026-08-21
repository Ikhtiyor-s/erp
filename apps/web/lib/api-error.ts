import { AxiosError } from "axios";

/**
 * Human-readable error message for any backend/network failure.
 * Use everywhere instead of `e?.response?.data?.detail || "Xato"`.
 */
export function getErrorMessage(e: unknown, fallback = "Kutilmagan xato"): string {
  if (e instanceof AxiosError) {
    if (e.code === "ECONNABORTED") {
      return "Server javob bermadi. Internet aloqasini tekshiring.";
    }
    if (e.code === "ERR_NETWORK") {
      return "Tarmoq xatosi. Internet aloqasini tekshiring.";
    }
    const status = e.response?.status;
    if (status === 401) return "Sessiya tugagan. Qayta kiring.";
    if (status === 403) return "Sizda bu amalni bajarish uchun ruxsat yo'q.";
    if (status === 404) return "Ma'lumot topilmadi.";
    if (status === 409) {
      const detail = e.response?.data?.detail;
      return typeof detail === "string" ? detail : "Konflikt: ma'lumot mavjud yoki band.";
    }
    if (status === 410) {
      const detail = e.response?.data?.detail;
      return typeof detail === "string" ? detail : "Ma'lumot endi mavjud emas.";
    }
    if (status === 422) {
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        return detail
          .map((d: any) => `${d.loc?.[d.loc.length - 1] || "maydon"}: ${d.msg}`)
          .join("; ");
      }
      return typeof detail === "string" ? detail : "Ma'lumotlar formati noto'g'ri.";
    }
    if (status === 429) return "Juda ko'p so'rov yuborildi. Bir necha soniya kuting.";
    if (status === 500) return "Server xatosi. Administrator bilan bog'laning.";
    if (status === 503) return "Xizmat hozir mavjud emas. Birozdan keyin urinib ko'ring.";
    const detail = e.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
