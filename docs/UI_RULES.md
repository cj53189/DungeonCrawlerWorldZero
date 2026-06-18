# Dungeon Crawler World Zero UI Rules

Issue: #99 Mobile UI rules and landscape usability pass

## Mobile-first baseline

Mobile layouts are first-class game layouts, not compressed desktop layouts. Any new menu, overlay, HUD widget, or virtual control must be reviewed at phone portrait and phone landscape sizes before it ships.

Use dynamic viewport units (`100dvh`, `100dvw`) for mobile overlays. Avoid `100vh` for phone modal sizing because browser chrome can make it inaccurate.

## Touch target rule

- Minimum interactive target: **48 × 48 px**.
- Preferred target for critical controls: **56 × 56 px**.
- Visual artwork may be smaller than the tap target, but the actual button box must meet the minimum.
- Do not use tiny circular close buttons on mobile.

## Close and combat preferred size

Close buttons and combat controls should use the preferred **56 × 56 px** target on mobile. The close button can keep a circular X style, but the button box must be easy to tap and consistently placed in the panel header area.

## Shared modal shell rules

Large panels should use the shared mobile modal shell:

- Respect safe-area insets on all sides.
- Use full-screen or near full-screen sizing on phone portrait and landscape.
- Include a clear header/title area.
- Keep the close button reachable in the top-right corner.
- Keep the main panel content scrollable with momentum scrolling.
- Keep primary footer actions, such as **Done** or **Take All**, sticky and reachable.
- Maintain readable text and avoid shrinking labels below mobile readability floors.

Panels covered by this rule include Settings, Inventory, Loot, Log, Recap, Skills, Merchant, and Multiplayer.

## Mobile landscape breakpoint

Use the strong landscape phone breakpoint for short viewports:

```css
@media (orientation: landscape) and (max-height: 540px),
       (hover: none) and (pointer: coarse) and (orientation: landscape) {
}
```

Inside this breakpoint, menus should be near full-screen, scrollable, and readable. Inventory may use two columns when width allows, but must not shrink controls or labels below the touch and readability rules.

## Portrait rule

Portrait must be usable. Do not silently reuse a broken landscape layout. Menus should become full-screen or near full-screen, readable, and scrollable. Gameplay may remain available when possible, but readable menus, compact HUD, bottom controls, and safe close buttons take priority.

Do not add a new permanent portrait blocker. If another system intentionally blocks portrait, do not make that behavior more restrictive.

## Compact HUD rule

On mobile, the HUD should prioritize:

- Floor
- Coins
- HP
- XP
- Collapse timer

When space is tight, hide or reduce lower-priority lines such as weapon, pet, stair text, and extra flavor/meta lines if they overlap controls or commentary.

## Virtual control thumb-zone rule

- Left side: movement joystick.
- Right side: attack, dodge, interact, and weapon controls.
- Top-right: INV, NEW, RECAP, and LOG shortcuts, while leaving room for Settings.
- All virtual buttons must be at least 48 × 48 px.
- Primary combat buttons should be 56 × 56 px or larger.
- Controls must respect safe-area insets.

## Readability minimums

- Body text in mobile menus should be at least 12 px.
- Important labels and item names should be at least 13 px where possible.
- Tiny 7–8 px labels should not be used in mobile modal layouts.
- Button labels should remain readable and should not require precision tapping.

## Manual test checklist

- [ ] iPhone Safari landscape.
- [ ] iPhone Safari portrait.
- [ ] Android Chrome landscape.
- [ ] Android Chrome portrait.
- [ ] Desktop browser.
- [ ] Inventory open, tab, item, equip, drop.
- [ ] Loot open, take, take all, close.
- [ ] Settings open, scroll, toggle, done, close.
- [ ] Log and recap open/close.
- [ ] Combat controls while HUD/commentary are visible.
- [ ] Verify no important interactive control is below 48 × 48 px.
- [ ] Verify close buttons are easy to tap and visually consistent.
- [ ] Verify no console errors.
