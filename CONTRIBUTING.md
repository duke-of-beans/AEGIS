# Contributing to AEGIS

## Development

### Lint

AEGIS enforces zero lint warnings at all times. Run lint before pushing:

```
npm run lint
```

This is enforced automatically by a git pre-push hook. Any push with lint errors
will be blocked with the offending lines printed to the terminal.

To bypass in a genuine emergency only:

```
git push --no-verify
```

### Typecheck

```
npx tsc --noEmit
```

Both lint and typecheck must pass before any commit reaches CI.

### Commit messages

Write commit messages via `commit-msg.txt` and use:

```
"D:\Program Files\Git\cmd\git.exe" commit -F commit-msg.txt
```

This keeps commit messages clean and avoids shell escaping issues on Windows.
