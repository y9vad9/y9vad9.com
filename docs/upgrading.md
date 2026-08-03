# Upgrading

Onvu is a template you fork and keep pulling from, not one you clone once and abandon. That only works if it is clear which files are yours and which are the engine's.

## Pulling updates

```bash
git fetch upstream
git merge upstream/main
```

If you cloned with the remote already named `origin`, rename it first:

```bash
git remote rename origin upstream
git remote add origin https://github.com/your-username/my-site.git
```

## The ownership boundary

| Path | Owner |
|:---|:---|
| `content/**` | You. Notes, navigation, landing composition, translations, theme. |
| `site.config.ts`, `site.<locale>.config.ts` | You. |
| `.github/workflows/**` | You. Deployment is per-site. |
| `src/**` | The template. |
| `messages/**` | The template. |
| `public/**` | Shared. You add files; the build owns `notes-assets/` and `_static/`. |

`.gitattributes` marks the first three groups `merge=ours`, so when both you and upstream have changed the same file, your version wins with no conflict to resolve.

For the first two the real protection is that upstream does not write to those paths, and the merge driver is only a backstop. The workflows are different: upstream does change them, and the driver is the whole mechanism. That is a deliberate trade. Your workflow carries a Cloudflare project name, a trigger you chose and whatever your hosting needs, none of which upstream can know, so a sync that overwrote it would break your deploy rather than improve it. The cost is that CI improvements stop arriving on their own. Read `git diff` on that file after a sync and apply what you want by hand.

Only `workflows/` is protected. The rest of `.github/` is boilerplate most forks never edit and usually want updated.

## The driver needs registering

`ours` is not one of git's built-in merge drivers. Those are `text`, `binary` and `union`. It has to be registered in repository config, and git falls back to a normal three-way merge silently when it is not:

```bash
git config merge.ours.driver true
```

`npm install` does this through the `prepare` script in `package.json`, so a normal setup arms it without you thinking about it. Run the command by hand if you install dependencies some other way.

`.gitattributes` cannot register the driver itself. That restriction is deliberate in git, so that cloning a repository cannot make it run arbitrary merge commands.

## What it does not cover

The driver only arbitrates when both sides changed a file. Everything else is resolved at the tree level, before any merge driver runs.

A file upstream adds still arrives. A file upstream deletes still goes. A file you deleted that upstream then edits is a modify/delete conflict, with upstream's copy left in your tree for you to decide about.

None of that is a defect in the setup, but it does mean `merge=ours` is not a promise that `git merge upstream/main` can never surprise you under `content/`.

## Two files that will drift

`content/landing.tsx` and `content/footer.tsx` import from `src/`. They are yours, so you stop receiving upstream changes to them, which means a component whose props change leaves your copy stale.

You find out at `tsc` rather than at a merge conflict. That is the better of the two failures, but run `npm run typecheck` after every sync and fix what it points at.

`content/noteView.tsx` has the same property if you fill it in. It ships empty, and an empty file cannot drift.

## Why `messages/` is not yours

It would be the obvious thing to protect, and protecting it is the trap. Upstream adds interface strings constantly, and `merge=ours` on `messages/` would mean you never receive a new one, so every new label in the UI would render as a raw key path.

Override from `content/i18n/<locale>.json` instead. It deep-merges over the framework messages, new keys are additive, and you will never conflict on a string. [Localisation](localisation.md) has the details.

## After a sync

```bash
npm install
npm run typecheck
npm test
npm run build:static
```

`npm install` first, because a sync may have changed dependencies and it also re-arms the merge driver. Then typecheck, which is where the drift described above surfaces.

`content/notes/en/template-reference.md` is a useful last check while you still have it: it exercises every renderer on one page and ends with a checklist.

## Contributing back

Fixes to `src/` belong upstream, not in your fork. A patch you keep locally is a merge conflict you keep forever.
