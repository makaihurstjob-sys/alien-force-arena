# Approved main-menu designs

The owner approved approved-mobile.png (Arcade cover-flow) and approved-desktop.png (Classic fullscreen) on September 16, 2026. Mobile was implemented first; the desktop redesign is now implemented following the approved fullscreen reference.

Mobile: drifting original enemy ships, gray player ship without a white background, game-palette title gradient, swipeable angled gameplay cards, caption plates, pagination, Arcade 1v1/2v2 concept controls, persistent Create Room and Join Room actions. Default to playable Classic; Arcade remains Coming Soon. Preserve existing Practice access as a third card. Use real game rendering rather than the generated mockup artwork. Practice uses its own renderer for a static gameplay preview. Arcade preview markers illustrate planned features only.

Desktop: immersive Classic gameplay backdrop, left-side title and Play Classic action, small mode previews below, room actions at lower right. Implemented at widths of 768px and above, with Classic, Arcade (Coming Soon), and Practice selection, keyboard arrow navigation, and the shared immediate room creation/invite flow. The industrial canvas backdrop is a decorative attract scene using original ship sprites, not a recording of playable Classic. Mobile retains its cover-flow layout.

The approved gray ship and gradient supersede the older white-background landing-logo requirement in branding.md. Favicon and install icons are outside this change.


Mobile room flow: Create Room immediately requests a room and shows an animated loading ring. Close is disabled during the request to avoid abandoning an in-flight creation. Loaded rooms expose native sharing, copy-link and a selectable URL. Invite URLs use /#room=CODE and open Join Room with the code prefilled. Verified against the live backend using two independent browser sessions; the test room was left afterward.

Menu entrance: gray fullscreen backdrop with ships at full opacity while sprite/font assets load, 1.1-second introductory flight, then 850ms menu fade and 900ms ship fade to 28% opacity. Five-second fallback prevents a stuck entrance. Shared invites skip the extra pause; reduced-motion skips transitions. Menu controls are inert until revealed.

Desktop verification: TypeScript, production build, browser layouts at 768/1024/1366/1920px and mobile regression at 320/390px; mode links, disabled Arcade action, Join Room dialog and reduced motion. Live desktop room test verified a single create request, rotating loader, copied invite link, and two independent sessions reaching 2/2 players; both left afterward.
