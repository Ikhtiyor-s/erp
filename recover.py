import os
import sys

CORRUPTED = [
    "apps/web/components/settings/SettingsForm.tsx",
    "apps/web/app/(dashboard)/reference/legal-entity/page.tsx",
    "apps/web/app/(dashboard)/reference/locations/page.tsx",
    "apps/web/app/(dashboard)/reference/natural-person/page.tsx",
    "apps/web/app/(dashboard)/reference/prices/page.tsx",
    "apps/web/app/(dashboard)/reference/units/page.tsx",
    "apps/web/app/(dashboard)/warehouse/write-off-reason/page.tsx",
    "apps/web/app/(dashboard)/warehouse/write-off/page.tsx",
    "apps/web/app/m/visits/page.tsx",
    "apps/web/app/(dashboard)/warehouse/types/page.tsx",
    "apps/web/app/m/settings/page.tsx",
    "apps/web/app/(dashboard)/warehouse/revision/page.tsx",
    "apps/web/app/(dashboard)/warehouse/recommended-stock/page.tsx",
    "apps/web/app/(dashboard)/warehouse/internal-transfers/page.tsx",
    "apps/web/app/m/courier/page.tsx",
    "apps/web/app/(dashboard)/tools/price/page.tsx",
    "apps/web/app/(dashboard)/tools/exports-center/page.tsx",
    "apps/web/app/m/cashbox/page.tsx",
    "apps/web/app/(dashboard)/tasks/page.tsx",
    "apps/web/app/(dashboard)/supply/purchases/page.tsx",
    "apps/web/app/(dashboard)/supply/purchase-order/page.tsx",
    "apps/web/app/(dashboard)/settings/users/page.tsx",
    "apps/web/app/(dashboard)/settings/devices/page.tsx",
    "apps/web/app/(dashboard)/settings/roles/page.tsx",
    "apps/web/app/(dashboard)/settings/print-templates/page.tsx",
    "apps/web/app/(dashboard)/settings/page.tsx",
    "apps/web/app/(dashboard)/sale/return-reason/page.tsx",
]

MARKER = "getErrorMessage(e, )"
ROOT = "D:/Docker/projects/erp"


def recover_text(text: str) -> str:
    parts = text.split(MARKER)
    # parts[0] is whatever was before the first marker (usually empty if file starts with corruption)
    # each subsequent part starts with the original char that followed the marker
    out = [parts[0]] if parts and parts[0] else []
    for p in parts[1:]:
        if not p:
            continue
        # take only the next single char (the marker reappears at every char position)
        out.append(p[0])
        # everything after p[0] until the next marker is extra junk from interleaving
        # but our split already handled that
    return "".join(out)


def is_corrupted(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            head = f.read(200)
        return MARKER.encode() in head and head.count(MARKER.encode()) >= 5
    except Exception:
        return False


changed = []
skipped = []
for rel in CORRUPTED:
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        skipped.append((rel, "not found"))
        continue
    if not is_corrupted(p):
        skipped.append((rel, "not corrupted"))
        continue
    with open(p, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    recovered = recover_text(text)
    # Backup original to .corrupted
    with open(p + ".corrupted", "w", encoding="utf-8") as f:
        f.write(text)
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(recovered)
    changed.append((rel, len(text), len(recovered)))

print("=== Recovered ===")
for rel, before, after in changed:
    print(f"  {rel}: {before} -> {after} bytes")
print(f"\n=== Skipped: {len(skipped)} ===")
for rel, reason in skipped:
    print(f"  {rel}: {reason}")
print(f"\nTotal recovered: {len(changed)}")
