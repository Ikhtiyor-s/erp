# T-140: QA — Sprint 4 review

**Wave:** 4E
**Owner:** qa-reviewer
**Size:** M
**Depends on:** T-100..T-135 (barcha Wave 4A-4D)

## Goal
Sprint 4 barcha ticket'larini BLOCKER/MAJOR/MINOR darajasida tekshirish.

## Review checklist
- [ ] `organization_id` filter — barcha yangi backend endpoint'larda mavjudmi?
- [ ] SENSITIVE_KEYS — yangi secret field'lar redact qilinganmi?
- [ ] `secret_box.encrypt()` — barcha provider credentials encrypt qilinganmi?
- [ ] RBAC — barcha yangi endpoint'larda permission check mavjudmi?
- [ ] Frontend `window.confirm()` ishlatilganmi? (BLOCKER — ConfirmDialog kerak)
- [ ] Frontend `e?.response?.data?.detail` pattern ishlatilganmi? (BLOCKER — getErrorMessage kerak)
- [ ] Hardcoded `grid-cols-N` (`sm:` prefix'siz)? (MAJOR)
- [ ] Menu items `permission` field'siz qo'shilganmi? (BLOCKER)
- [ ] WebAuthn T-104: iOS Safari'da crash bo'lmasmi?
- [ ] Barcode scanner T-102: memory leak (stream to'xtatilganmi)?
- [ ] 1C export T-105: UTF-8 BOM bormi?
- [ ] MXIK T-101: SQL injection yo'qmi? (text() + bound params)

## Output
BLOCKER / MAJOR / MINOR ro'yxati. 0 BLOCKER bo'lsa — deploy mumkin.

## How we'll know it's done
QA hisoboti chiqarilgan; 0 BLOCKER.
