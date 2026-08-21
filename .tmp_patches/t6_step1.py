"""T-6 patch applied via inline script"""
import pathlib
p1 = pathlib.Path('apps/api/app/modules/customer_portal/auth.py')
c = p1.read_text(encoding='utf-8')
