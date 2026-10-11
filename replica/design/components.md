# Components

Tokens live in `tokens.json` and `tokens.css`. Components use the variables only (`var(--accent)`), never a raw hex.

Tailwind-equivalent names, if a utility layer is added later: `bg-bg`, `bg-surface`, `text-text`, `text-muted`, `border-border`, `bg-accent text-on-accent`, `text-danger`, `text-success`. Not wired, on purpose (decision 13).

Tap target is `--tap` (48px). Body text is 16px so a phone does not zoom the field on focus. Motion is `--motion-fast` / `--motion-base`. `@media (prefers-reduced-motion: reduce)` drops transitions.

## Button
  variants  primary, secondary, ghost, danger
  sizes     md 48px height, block optional
  states    default, hover, active, focus-visible (2px accent ring, 2px offset), disabled, loading (aria-busy, label stays)
  tokens    primary: bg accent, text on-accent, radius md, soft inner highlight. secondary: glass-strong, text text, glass border. ghost: transparent. danger: text danger. Glass surfaces sit on the dusk atmosphere so frost reads.
  a11y      real button, type=button unless it submits, visible focus, disabled not clickable
  used on   S01–S14

## Text field
  variants  text, tel, email, password, number, date
  states    default, focus-visible, error (aria-invalid + role=alert under it), disabled
  tokens    bg surface, text text, border border-input, radius sm, padding space-3
  a11y      label element wrapped around the control, or htmlFor. Error announced.
  used on   S02 S03 S05 S08 S13

## Textarea
  variants  notes, terms
  states    default, focus-visible
  tokens    same as text field, min-height 96px
  a11y      labelled
  used on   S05 S13

## Chip
  variants  saved line
  states    default, focus-visible, pressed
  tokens    bg surface, border border, radius pill, text sm
  a11y      button with the item name
  used on   S05

## Card
  variants  list row, document, price
  states    default
  tokens    bg surface, border border, radius md, no shadow, padding space-4
  a11y      article or li, heading inside when it is a section
  used on   S01 S04 S06 S07 S08 S10 S12

## Banner
  variants  error, offline, success
  states    visible
  tokens    error text danger on surface; offline text text on surface; success text success
  a11y      role=alert for errors, role=status for sync
  used on   app shell, forms

## Sync status
  variants  Synced, Waiting to sync, On this phone
  states    reflects navigator.onLine and the outbox count
  tokens    text xs, text muted, weight 600
  a11y      role=status, aria-live=polite
  used on   app shell

## Line editor
  variants  one row inside a fieldset named Line N
  states    filled, invalid
  tokens    field tokens
  a11y      legend, labelled description, qty, price
  used on   S05

## Photo tray
  variants  empty, 1–3 thumbnails, capped
  states    the 4th file is refused with an alert
  tokens    72px thumb, radius sm
  a11y      img alt "Quote photo N", remove button
  used on   S05 S06 S07

## Totals
  variants  subtotal, tax, total, paid, balance
  states    open, partial, paid
  tokens    text base, total text lg
  a11y      a definition list
  used on   S06 S07 S08 S09

## Share links
  variants  Text, WhatsApp, Email
  states    real anchors with sms:, https://wa.me/, mailto:
  tokens    secondary button
  a11y      the accessible name is the channel
  used on   S06 S08 S12

## Activity list
  variants  status events newest first
  states    empty (hidden), filled
  tokens    text sm, text muted
  a11y      an ordered list
  used on   S06

## App shell
  variants  bottom nav under 900px, sidebar from 900px
  states    current item aria-current=page
  tokens    header height, nav height, surface bar, border
  a11y      nav landmark, main landmark, skip link
  used on   S04–S06 S08 S10–S13

## Empty state
  variants  one sentence and one primary action
  states    empty
  tokens    text muted, space-5
  a11y      paragraph plus a link or button
  used on   S04 S10 S12

## Skeleton
  variants  two text bars
  states    loading while IndexedDB or a public fetch is in flight
  tokens    surface on bg, radius sm
  a11y      aria-busy on the region
  used on   S04 S07 S10
