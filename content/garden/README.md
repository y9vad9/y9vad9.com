# Garden intro

Put a file here named after a locale (`en.md`, `de.md`, `uk.md`) and its
contents render at the top of that locale's note index, above the pinned
notes.

It is ordinary markdown. Links, emphasis, lists and images all work, wiki
links resolve against your notes, and relative image paths resolve against
this directory.

The first prose paragraph also becomes the index's meta description, stripped
of markdown and clipped to 160 characters. Write the intro and the description
takes care of itself.

There is no default. A locale with no file here shows no intro at all, which
is deliberate: a generic sentence shipped by the template would stand in for
your voice and read as filler. Write one, or leave it blank.

This README is never rendered. Only `<locale>.md` files are.
