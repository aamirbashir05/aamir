#!/usr/bin/env python3
import csv, json, gzip, base64, sys, random, string
from collections import OrderedDict

UP = "/root/.claude/uploads/4aa428b6-0cb1-53dc-83cd-8c3482bb143b/"
TX = UP + "8fe32f46-7b0398b5udhaar_all_transactions_FRESH.csv"
SUM = UP + "9d40d148-098ce346udhaar_customer_summary_FRESH.csv"

# ---- summary: name -> phone, expected balance, count ----
summary = OrderedDict()
with open(SUM, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        nm = r['Customer Name'].strip()
        summary[nm] = {
            'phone': (r['Phone Number'] or '').strip(),
            'bal': round(float(r['Current Balance'] or 0)),
            'count': int(r['Transaction Count'] or 0),
        }

# ---- transactions grouped in CSV order ----
groups = OrderedDict()
with open(TX, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        nm = r['Customer Name'].strip()
        groups.setdefault(nm, []).append(r)

def uid_gen():
    n = 0
    alph = string.digits + string.ascii_lowercase
    while True:
        # deterministic-ish unique short id
        n += 1
        yield 'im' + format(n, 'x') + ''.join(random.choice(alph) for _ in range(4))

gen = uid_gen()

def rid():
    return next(gen)

customers = []
errors = []
tot_txn = 0
for nm, rows in groups.items():
    info = summary.get(nm, {'phone': '', 'bal': None, 'count': None})
    txns = []
    running = 0
    for idx, r in enumerate(rows):
        day = r['Date'].strip()
        typ = r['Type'].strip()
        amt = round(float(r['Amount'] or 0))
        is_debit = typ.startswith('Udhaar')  # Udhaar (Given) = debit ; Jama (Received) = credit
        running += amt if is_debit else -amt
        # verify running balance matches CSV column
        csv_run = round(float(r['Running Balance'] or 0))
        if csv_run != running:
            errors.append(f"{nm} row{idx}: computed {running} != csv {csv_run}")
        # time: noon + idx seconds -> unique, monotonic, same day
        secs = idx
        hh = 12 + secs // 3600
        mm = (secs % 3600) // 60
        ss = secs % 60
        date = f"{day}T{hh:02d}:{mm:02d}:{ss:02d}.000Z"
        txns.append({
            'id': rid(),
            'amount': amt,
            'type': 'debit' if is_debit else 'credit',
            'note': '',
            'date': date,
            'img': ''
        })
    tot_txn += len(txns)
    # validate final balance & count against summary
    if info['bal'] is not None and running != info['bal']:
        errors.append(f"{nm}: final {running} != summary {info['bal']}")
    if info['count'] is not None and len(txns) != info['count']:
        errors.append(f"{nm}: count {len(txns)} != summary {info['count']}")
    customers.append({
        'id': rid(),
        'name': nm,
        'phone': info['phone'],
        'txns': txns,
        'quotes': []
    })

dataset = {
    'customers': customers,
    'suppliers': [],
    'items': [],
    'updatedAt': '2026-07-21T00:00:00.000Z'
}

print(f"customers={len(customers)} txns={tot_txn} errors={len(errors)}")
for e in errors[:30]:
    print("  ERR", e)

j = json.dumps(dataset, ensure_ascii=False, separators=(',', ':'))
print(f"json bytes = {len(j.encode('utf-8'))}")

# gzip + base64
gz = gzip.compress(j.encode('utf-8'), 9)
b64 = base64.b64encode(gz).decode('ascii')
print(f"gzip bytes = {len(gz)}  base64 chars = {len(b64)}")

with open("/home/user/aamir/data/altariq-final.txt", 'w') as f:
    f.write(b64)
print("wrote data/altariq-final.txt")
