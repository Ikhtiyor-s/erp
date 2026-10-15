# MA-5 — Catalog (product + category) CRUD screens

**Owner role**: flutter-dev
**Depends on**: MA-1 (frozen endpoint + permission-code contract), MA-3 (shell/nav/auth it
builds inside of)

## Goal

Build product list/detail and category list/edit screens against the existing `warehouse`
module endpoints, with mutation actions (create/edit/delete) hidden for any role lacking the
relevant `warehouse.product.*`/confirmed-category permission code.

## Files likely touched

- `apps/merchant-admin/lib/services/menu_service.dart`
- `apps/merchant-admin/lib/screens/menu/product_list_screen.dart`
- `apps/merchant-admin/lib/screens/menu/product_detail_screen.dart`
- `apps/merchant-admin/lib/screens/menu/category_list_screen.dart`
- `apps/merchant-admin/lib/screens/menu/category_edit_screen.dart`

## How we'll know it's done

- Against the real backend: creating a category and a product from the app, then opening
  `apps/web/(dashboard)/warehouse/products` in the browser, shows the same new rows — proof
  of single shared backend, no shadow data.
- Deleting a product from the app removes it from the web admin's list too.
- Mutation buttons (create/edit/delete) are hidden (not just disabled-but-visible) for a
  role whose `GET /rbac/me/permissions` response lacks the permission code
  `DESIGN-merchant-admin.md` names for product/category mutation.
- No modifier/variant screen is built (SPEC §7 WON'T DO — ERP has no equivalent concept;
  do not fold BOM/manufacturing screens in here either, that's a different feature).
- Changed files reported.

## Owner role

flutter-dev

## Depends on

MA-1, MA-3
