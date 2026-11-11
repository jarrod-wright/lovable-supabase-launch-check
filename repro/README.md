# Synthetic demo. Built to be broken. No client data, no real keys.

`run_checks.py` is the fixed check list in runnable form: the first version of
the scanner. It reads an app tree (default `../before`), prints one evidence row
per finding in the fixed-list order, and exits 1 while a defect stands.

```bash
python repro/run_checks.py            # checks the demo app in before/
python repro/run_checks.py --target <path-to-your-export>
```

Standard library only; no install step. The checks it runs are the same seven
items, in the same order, as the Launch Check report and the terms section 1.
